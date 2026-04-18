# Phase B — Run & Evaluate: Implementation Plan

> **For Lovable hand-off:** each task below contains a self-contained "Lovable prompt" block. Paste it into Lovable verbatim. After Lovable ships, verify the acceptance criteria in the browser and commit before moving to the next task.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the eval-running surface — wire informational/latency results into the run detail, replace the ad-hoc summary with a real `EvalRunSummaryCard`, fix the two outstanding suggestions bugs (field-name mismatch and fast-path patches), add a Standard/Deep mode toggle on improvements, and add a cross-version "New Eval Run" dialog. Add the Eval Runs sidebar entry.

**Architecture:** All work in the existing `agent-contract-studio` repo. New types added to `src/lib/types.ts` (created in Plan A Task 1). API wrappers in `src/lib/api.ts` updated in place. New components in `src/components/eval/` and `src/components/improvements/`. Existing `EvalRunHistory.tsx` and `AgentDetail.tsx` pages extended in place — no new pages.

**Tech Stack:** React + Vite + TypeScript + Tailwind + shadcn-ui + React Query + React Router.

**Spec reference:** `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` §3 (Phase B items) and §5 (cross-cutting).

**Plan A dependencies (must already be merged):**
- `ApiError` class exported from `src/lib/api.ts` and `request<T>` throws it (Plan A Task 1).
- `src/lib/types.ts` exists with `FailureCategory` (Plan A Task 1).
- `src/components/EmptyState.tsx` exists (Plan A Task 1).
- `AppSidebar.tsx` already gained the "Test Cases" entry; this plan adds "Eval Runs" alongside it.

**Backend (verified on `agentops-backend@v2-behavioral-contracts`):**
- `POST /agents/{id}/versions/{vid}/improvements?eval_run_id={runId}&mode=standard|deep` → `{suggestions: Suggestion[], mode: "standard" | "deep"}`. `services/improvement_suggester.py:270-286` confirms the `Suggestion` shape: `{id, failure_pattern, description, schema_change, prompt_patch, fixes_watching, must_hold_risk, confidence}`. The router docstring at `routers/improvements.py:6` mentions `affects_cases` but it is **stale** — the LLM template at `services/improvement_suggester.py:281` returns `fixes_watching`. Trust the template.
- `POST /agents/{id}/versions/{vid}/improvements/apply` → body `{accepted_fix_ids: string[], eval_run_id: string, label?: string, accepted_patches?: Record<string,string>}`. When `accepted_patches` is supplied, the backend uses the fast path (skips the second LLM call) AND filters by `accepted_fix_ids`. Both fields are sent (`routers/improvements.py:118-128`).
- `POST /agents/{id}/versions/{vid}/eval-runs` (V2) — body `{run_type: "full", test_case_source_version_id?: string}`. Synchronous — long mutation. Returns `{eval_run, summary}` where `eval_run.id` is what the frontend should navigate to (`routers/eval_runs_v2.py:15-128`).
- `GET /eval-runs/{run_id}` (legacy) returns `{eval_run, summary, results}` with `summary = {total, passed, failed, deterministic: {total, passed}, semantic: {total, passed}}`. **The GET handler does NOT read the stored `summary_json`** (`routers/runs.py:270-334`) — so `pass_rate`, `avg_latency_ms`, and the latency budget breakdown must be derived on the frontend from `results`. No backend ask required for B.3.
- `EvalResult.result_type` is a free-form string in the model. Common values: `"deterministic"`, `"semantic"`, `"informational"`. Informational rows carry `latency_ms` and have `passed = within_budget`. They are excluded from pass/fail counts in the V2 POST summary (`routers/eval_runs_v2.py:128-133`).
- Legacy `GET /eval-runs` returns `EvalRun[]` whose model (`models.py:80-86`) does **not** include `test_case_source_version_id`. Cross-version badge column on the list is therefore a **soft blocker** (see Phase B blockers below).

---

## File map

**Create:**
- `src/components/eval/EvalRunSummaryCard.tsx` (Task 3)
- `src/components/eval/LatencyBudgetCard.tsx` (Task 2)
- `src/components/eval/NewEvalRunDialog.tsx` (Task 5)
- `src/components/improvements/SuggestionCard.tsx` (Task 1)

**Modify:**
- `src/lib/types.ts` (Tasks 1, 2, 3, 5)
- `src/lib/api.ts` (Tasks 1, 5)
- `src/components/AppSidebar.tsx` (Task 1)
- `src/pages/AgentDetail.tsx` (Tasks 1, 4, 5)
- `src/pages/EvalRunHistory.tsx` (Tasks 2, 3, 5)

---

## Task 1: B.1 — Cleanup prelude (types, suggestions field rename, sidebar)

Combines spec B.1 items: typed `Suggestion`, fixed `applySuggestions` signature with `accepted_patches` fast path, sidebar "Eval Runs" entry, and the `failure_pattern` / `fixes_watching` rename inside the existing improvements panel.

**Files:**
- Modify: `src/lib/types.ts` — add `Suggestion`, `SchemaChange`, `ApplySuggestionsRequest`, `ApplySuggestionsResponse` types
- Modify: `src/lib/api.ts` — type `getSuggestions` and `applySuggestions`; add `accepted_patches` to the request type and call; pre-add the optional `mode` parameter to `getSuggestions` (used by Task 4)
- Modify: `src/components/AppSidebar.tsx` — add "Eval Runs" item below "Test Cases"
- Modify: `src/pages/AgentDetail.tsx` — rename `affected_cases` reads to `fixes_watching`; type `suggestions: Suggestion[]` (drop `any`); when calling `applySuggestions`, build `accepted_patches` from accepted suggestions
- Create: `src/components/improvements/SuggestionCard.tsx` — extract the per-suggestion render block out of `AgentDetail.tsx` so it's typed and reusable

### Lovable prompt

````
Do five small things in this single change.

1. In src/lib/types.ts, add these types below FailureCategory:

   export interface SchemaChange {
     field: string;
     operation: "add" | "update" | "remove" | string;
     value?: unknown;
   }

   export interface Suggestion {
     id: string;
     failure_pattern: string;
     description: string;
     schema_change?: SchemaChange | null;
     prompt_patch?: string;
     fixes_watching?: string[];     // backend returns this; NOT affects_cases (router docstring is stale)
     must_hold_risk?: "None" | "Low" | "Medium" | string;
     confidence?: number;
   }

   export interface ApplySuggestionsRequest {
     accepted_fix_ids: string[];
     eval_run_id: string;
     label?: string;
     accepted_patches?: Record<string, string>;   // fast-path: {fix_id: prompt_patch}
   }

   export interface ApplySuggestionsResponse {
     // Backend returns the new AgentVersion; existing code re-fetches versions instead of
     // typing this strictly, so leave it open. Tighten later if needed.
     [key: string]: unknown;
   }

2. In src/lib/api.ts, replace the existing getSuggestions and applySuggestions wrappers (currently lines 308-322 with `any` typing) with these typed versions, and add the import:

   import { AgentSchema, Suggestion, ApplySuggestionsRequest, ApplySuggestionsResponse } from "./types";
   // (merge with the AgentSchema import added in Plan A Task 2 — keep one import line)

   getSuggestions: (agentId: string, versionId: string, evalRunId: string, mode: "standard" | "deep" = "standard") =>
     request<{ suggestions: Suggestion[]; mode: "standard" | "deep" }>(
       `/agents/${agentId}/versions/${versionId}/improvements?eval_run_id=${evalRunId}&mode=${mode}`,
       { method: "POST" }
     ),

   applySuggestions: (agentId: string, versionId: string, body: ApplySuggestionsRequest) =>
     request<ApplySuggestionsResponse>(
       `/agents/${agentId}/versions/${versionId}/improvements/apply`,
       { method: "POST", body: JSON.stringify(body) }
     ),

   Note: the `mode` parameter is added now so Task 4 doesn't need another wrapper change.

3. In src/components/AppSidebar.tsx, add an "Eval Runs" nav item between "Test Cases" and "Behavioral Check":
   - Label: "Eval Runs"
   - Path: "/eval-runs"
   - Icon: PlayCircle (from lucide-react — add the import)
   - Active when: path.startsWith("/eval-runs")
   So the final order is: Agents → Test Cases → Eval Runs → Behavioral Check.

4. Create src/components/improvements/SuggestionCard.tsx. This extracts the existing per-suggestion block from AgentDetail.tsx (currently lines ~743-790 inside the `suggestions.map`) into a typed component. Use the existing visual styling — do not redesign:

   import { Check, XCircle } from "lucide-react";
   import { Suggestion } from "@/lib/types";

   interface Props {
     suggestion: Suggestion;
     accepted: boolean;
     rejected: boolean;
     onAccept: () => void;
     onReject: () => void;
   }

   export function SuggestionCard({ suggestion: s, accepted, rejected, onAccept, onReject }: Props) {
     const watching = s.fixes_watching ?? [];
     return (
       <div className="border border-border rounded bg-background p-3 space-y-2">
         <div className="flex items-center gap-2">
           <button
             onClick={onAccept}
             className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border transition-colors ${
               accepted
                 ? "bg-success/15 text-success border-success/30"
                 : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
             }`}
           >
             <Check className="w-3 h-3" />
             Accept
           </button>
           <button
             onClick={onReject}
             className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border transition-colors ${
               rejected
                 ? "bg-destructive/15 text-destructive border-destructive/30"
                 : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
             }`}
           >
             <XCircle className="w-3 h-3" />
             Reject
           </button>
           {s.confidence != null && (
             <span className="ml-auto text-[10px] font-mono text-muted-foreground">
               {Math.round(s.confidence * 100)}% confidence
             </span>
           )}
         </div>
         <p className="text-sm font-semibold text-foreground">{s.failure_pattern}</p>
         <p className="text-xs text-muted-foreground">{s.description}</p>
         {s.prompt_patch && (
           <pre className="p-2 text-xs font-mono bg-muted/50 border border-border rounded overflow-x-auto max-w-full text-foreground leading-relaxed whitespace-pre-wrap break-words">
             <code>{s.prompt_patch}</code>
           </pre>
         )}
         {watching.length > 0 && (
           <div className="flex flex-wrap gap-1 items-center">
             <span className="text-[10px] text-muted-foreground">Watching {watching.length} cases:</span>
             {watching.map((w, i) => (
               <span key={i} className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                 {w}
               </span>
             ))}
           </div>
         )}
         {s.must_hold_risk && s.must_hold_risk !== "None" && (
           <p className="text-[10px] text-amber-500">
             Must-hold risk: {s.must_hold_risk}
           </p>
         )}
       </div>
     );
   }

5. In src/pages/AgentDetail.tsx, make these in-place changes:

   a. Add the imports at the top:

      import { Suggestion } from "@/lib/types";
      import { SuggestionCard } from "@/components/improvements/SuggestionCard";

   b. Change the suggestions state typing (currently around line 47):

      const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

   c. In handleApplyFixes (currently around lines 287-315), replace the body of the try block up to the api.applySuggestions call with this — it adds `accepted_patches` for the fast path and uses the typed request body:

      const acceptedIds = suggestions
        .filter(s => !rejectedSuggestionIds.has(s.id))
        .map(s => s.id);

      const acceptedPatches: Record<string, string> = {};
      for (const s of suggestions) {
        if (!rejectedSuggestionIds.has(s.id) && s.prompt_patch) {
          acceptedPatches[s.id] = s.prompt_patch;
        }
      }

      await api.applySuggestions(id, activeVersion.id, {
        accepted_fix_ids: acceptedIds,
        eval_run_id: latestRun.id,
        label: "Improved from eval results",
        accepted_patches: Object.keys(acceptedPatches).length > 0 ? acceptedPatches : undefined,
      });

      Leave the rest of handleApplyFixes (re-fetching versions, setting state, etc.) unchanged.

   d. Replace the per-suggestion render block (currently lines ~743-790, the entire body of `suggestions.map((s: any) => { ... return (<div ...>...)})`) with calls to the new SuggestionCard:

      {suggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          accepted={acceptedSuggestionIds.has(s.id)}
          rejected={rejectedSuggestionIds.has(s.id)}
          onAccept={() => handleAcceptSuggestion(s.id)}
          onReject={() => handleRejectSuggestion(s.id)}
        />
      ))}

      Make sure no `any` annotations remain in the map callback. Remove the now-unused `Check`/`XCircle` imports from AgentDetail.tsx if they have no other consumers in the file (check with a search before deleting).

   e. Search the file for any remaining reference to `affected_cases` or `affectedCases` and remove it — the field does not exist in the backend response.

Do not modify any other behavior. The improvements panel UI stays the same; only the field names, typing, and request body change.
````

### Acceptance criteria

- [ ] `npm run build` passes with no TypeScript errors
- [ ] `Suggestion` type is exported from `src/lib/types.ts`
- [ ] `getSuggestions` accepts an optional `mode` argument (default `'standard'`); call with `mode='deep'` produces a URL containing `&mode=deep`
- [ ] `applySuggestions` request body includes `accepted_patches` when at least one accepted suggestion has `prompt_patch`; the wrapper omits the field otherwise
- [ ] Sidebar shows four nav items in order: Agents → Test Cases → Eval Runs → Behavioral Check; clicking "Eval Runs" navigates to `/eval-runs`
- [ ] Improvements panel still renders accepted/rejected toggles; suggestion title reads `failure_pattern` and the watch list reads `fixes_watching`
- [ ] No `affected_cases` references remain in `AgentDetail.tsx` (grep should return zero)
- [ ] Network tab on "Apply fixes" shows both `accepted_fix_ids` (array of ids) and `accepted_patches` (object) in the POST body

### Commit

```bash
git add -A
git commit -m "Phase B.1: typed suggestions, fast-path patches, Eval Runs sidebar"
```

---

## Task 2: B.2 — Informational results in eval run detail

Splits eval results into deterministic / semantic / informational. Adds a `LatencyBudgetCard` for informational rows.

**Files:**
- Modify: `src/lib/types.ts` — add `EvalResult` type with `result_type` enum and `latency_ms`
- Create: `src/components/eval/LatencyBudgetCard.tsx`
- Modify: `src/pages/EvalRunHistory.tsx` — bucket results into three groups; render the new card below the existing results table

### Lovable prompt

````
Add informational/latency-budget rendering to the eval run detail view.

1. In src/lib/types.ts, add (below the Suggestion types from Task 1):

   export type EvalResultType = "deterministic" | "semantic" | "informational" | string;

   export interface EvalResult {
     id?: string;
     test_case_id: string;
     scenario?: string;
     assertion_id?: string | null;
     result_type: EvalResultType;
     passed: boolean;
     reason?: string | null;
     latency_ms?: number | null;
     regression_type?: "STABLE" | "REGRESSION" | "IMPROVEMENT" | "NO_PROGRESS" | string | null;
   }

2. Create src/components/eval/LatencyBudgetCard.tsx:

   import { Clock, CheckCircle2, AlertCircle } from "lucide-react";
   import { EvalResult } from "@/lib/types";

   interface Props {
     informational: EvalResult[];
     scenarioMap?: Record<string, string>;   // test_case_id -> scenario; falls back to result.scenario
   }

   function formatLatency(ms: number): string {
     if (ms < 1000) return `${Math.round(ms)}ms`;
     return `${(ms / 1000).toFixed(2)}s`;
   }

   export function LatencyBudgetCard({ informational, scenarioMap = {} }: Props) {
     if (informational.length === 0) return null;   // hide entirely when no informational results

     const within = informational.filter(r => r.passed === true).length;
     const over = informational.filter(r => r.passed === false).length;

     return (
       <div className="border border-border rounded bg-card mt-6">
         <div className="border-b border-border px-3 py-2 flex items-center gap-2">
           <Clock className="w-4 h-4 text-muted-foreground" />
           <h3 className="text-sm font-semibold text-foreground">Latency Budget</h3>
           <span className="ml-auto text-xs text-muted-foreground">
             {within} within · {over} over
           </span>
         </div>
         <table className="w-full text-sm">
           <thead>
             <tr className="border-b border-border bg-muted/30">
               <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scenario</th>
               <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-24">Measured</th>
               <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-28">Result</th>
               <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Reason</th>
             </tr>
           </thead>
           <tbody>
             {informational.map((r, i) => {
               const scenario = scenarioMap[r.test_case_id] || r.scenario || `Test ${r.test_case_id.slice(0, 10)}…`;
               return (
                 <tr key={r.id ?? `${r.test_case_id}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                   <td className="px-3 py-2 text-xs text-foreground truncate max-w-[280px]" title={scenario}>{scenario}</td>
                   <td className="px-3 py-2 text-right text-xs font-mono text-foreground">
                     {r.latency_ms != null ? formatLatency(r.latency_ms) : "—"}
                   </td>
                   <td className="px-3 py-2">
                     {r.passed ? (
                       <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] bg-success/15 text-success border border-success/30 rounded-sm">
                         <CheckCircle2 className="w-3 h-3" /> Within budget
                       </span>
                     ) : (
                       <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded-sm">
                         <AlertCircle className="w-3 h-3" /> Over budget
                       </span>
                     )}
                   </td>
                   <td className="px-3 py-2 text-xs text-muted-foreground max-w-[300px] truncate" title={r.reason ?? ""}>
                     {r.reason || "—"}
                   </td>
                 </tr>
               );
             })}
           </tbody>
         </table>
       </div>
     );
   }

3. In src/pages/EvalRunHistory.tsx, do these changes inside the detail view (currently around lines 198-350):

   a. Import the new component and the type at the top of the file:

      import { LatencyBudgetCard } from "@/components/eval/LatencyBudgetCard";
      import { EvalResult } from "@/lib/types";

   b. Replace the line:

      const results: any[] = detailData?.results ?? [];

      with:

      const allResults: EvalResult[] = (detailData?.results ?? []) as EvalResult[];
      const passFailResults = allResults.filter(r => r.result_type !== "informational");
      const informationalResults = allResults.filter(r => r.result_type === "informational");
      const results = passFailResults;   // existing pass/fail render below already iterates `results`

      Leave every downstream usage of `results` alone — they now operate on the pass/fail subset, which is the correct behavior (informational rows are excluded from the pass/fail table per backend reality).

   c. Update the fallback pass/fail counts (currently lines 203-206) to use `passFailResults` so informational rows don't inflate the totals:

      const total = summary.total ?? passFailResults.length;
      const passed = summary.passed ?? passFailResults.filter(r => r.passed === true).length;
      const failed = summary.failed ?? passFailResults.filter(r => r.passed === false).length;

   d. Update `groupByTestCase(results)` line to:

      const grouped = groupByTestCase(passFailResults);

   e. Build a `scenarioMap` for the latency card from the existing `scenarioMap` variable already present on the page (it's keyed by test_case_id elsewhere on the file). If a scenarioMap is not in scope at this point in the file, build a quick local one:

      const localScenarioMap: Record<string, string> = {};
      for (const r of allResults) {
        if (r.test_case_id && r.scenario) localScenarioMap[r.test_case_id] = r.scenario;
      }

      Reuse the file's existing scenarioMap if it covers the same ids; otherwise use localScenarioMap.

   f. Below the existing results table (after the closing `</div>` of the table wrapper around line 350), add:

      <LatencyBudgetCard informational={informationalResults} scenarioMap={scenarioMap ?? localScenarioMap} />

      The card hides itself when `informational.length === 0`, so no conditional needed at the call site.

Do not modify the list view, the header, the delete modal, or any other behavior. Only the detail view's results bucketing and the new card below the table change.
````

### Acceptance criteria

- [ ] `EvalResult` type defined in `src/lib/types.ts` with `result_type` field
- [ ] On a run that has only deterministic + semantic results: detail view looks identical to before (no card rendered)
- [ ] On a run that has informational results: a "Latency Budget" card appears below the results table with one row per informational result
- [ ] Each latency row shows scenario, measured latency formatted (e.g., `850ms` or `1.20s`), within-budget / over-budget badge, and reason
- [ ] Card header summary reads `{withinCount} within · {overCount} over`
- [ ] Pass/fail counts in the existing header (passed/total) exclude informational rows (i.e. counts match what the user sees in the main table, not the latency card)
- [ ] No TypeScript errors; no console errors; existing detail view interactions (back button, expand reason) still work

### Commit

```bash
git add -A
git commit -m "Phase B.2: latency budget card and informational result bucket"
```

---

## Task 3: B.3 — Eval run summary card

Replaces the inline summary block in the eval run detail header with a real `EvalRunSummaryCard` that derives `pass_rate` and latency tile counts on the frontend (backend GET handler does not surface stored `summary_json`).

**Files:**
- Modify: `src/lib/types.ts` — add `EvalRunSummary` type
- Create: `src/components/eval/EvalRunSummaryCard.tsx`
- Modify: `src/pages/EvalRunHistory.tsx` — replace the existing inline summary breakdown (lines ~245-270) with the card

### Lovable prompt

````
Replace the inline summary block on the eval run detail with a real summary card.

1. In src/lib/types.ts, add (below the EvalResult type):

   export interface BucketCount { total: number; passed: number; }

   export interface EvalRunSummary {
     total: number;
     passed: number;
     failed: number;
     deterministic?: BucketCount;
     semantic?: BucketCount;
   }

2. Create src/components/eval/EvalRunSummaryCard.tsx:

   import { CheckCircle2, XCircle, Clock, TrendingUp } from "lucide-react";
   import { EvalResult, EvalRunSummary } from "@/lib/types";

   interface Props {
     summary: EvalRunSummary;
     results: EvalResult[];   // used to derive informational counts (backend GET omits the latency breakdown)
   }

   function formatLatency(ms: number): string {
     if (ms < 1000) return `${Math.round(ms)}ms`;
     return `${(ms / 1000).toFixed(2)}s`;
   }

   function Tile({ label, value, icon: Icon, accent }: {
     label: string; value: string; icon: React.ElementType; accent?: "success" | "destructive" | "warning" | "muted";
   }) {
     const tone = {
       success: "text-success",
       destructive: "text-destructive",
       warning: "text-amber-500",
       muted: "text-muted-foreground",
     }[accent ?? "muted"];
     return (
       <div className="border border-border rounded bg-card px-3 py-2.5 flex flex-col gap-1">
         <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
           <Icon className={`w-3 h-3 ${tone}`} />
           {label}
         </div>
         <div className="text-base font-semibold text-foreground">{value}</div>
       </div>
     );
   }

   export function EvalRunSummaryCard({ summary, results }: Props) {
     const informational = results.filter(r => r.result_type === "informational");
     const within = informational.filter(r => r.passed === true).length;
     const over = informational.filter(r => r.passed === false).length;
     const hasInformational = informational.length > 0;

     const total = summary.total ?? 0;
     const passed = summary.passed ?? 0;
     const failed = summary.failed ?? 0;
     const passRate = total > 0 ? `${Math.round((passed / total) * 100)}%` : "—";

     // Average latency derived from informational rows; if backend omits informational,
     // fall back to averaging latency_ms across all results that have a value.
     const latencyPool = informational.length > 0
       ? informational
       : results.filter(r => typeof r.latency_ms === "number");
     const avgLatency = latencyPool.length > 0
       ? latencyPool.reduce((acc, r) => acc + (r.latency_ms ?? 0), 0) / latencyPool.length
       : null;

     return (
       <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-6">
         <Tile label="Total" value={String(total)} icon={TrendingUp} accent="muted" />
         <Tile label="Passed" value={String(passed)} icon={CheckCircle2} accent="success" />
         <Tile label="Failed" value={String(failed)} icon={XCircle} accent={failed > 0 ? "destructive" : "muted"} />
         <Tile label="Pass rate" value={passRate} icon={TrendingUp} accent={passed === total && total > 0 ? "success" : "muted"} />
         {avgLatency != null && (
           <Tile label="Avg latency" value={formatLatency(avgLatency)} icon={Clock} accent="muted" />
         )}
         {hasInformational && (
           <>
             <Tile label="Within budget" value={String(within)} icon={CheckCircle2} accent="success" />
             <Tile label="Over budget" value={String(over)} icon={Clock} accent={over > 0 ? "warning" : "muted"} />
           </>
         )}
       </div>
     );
   }

3. In src/pages/EvalRunHistory.tsx detail view (around lines 232-270), make these changes:

   a. Import at the top:

      import { EvalRunSummaryCard } from "@/components/eval/EvalRunSummaryCard";
      import { EvalRunSummary } from "@/lib/types";

   b. Just below the existing `const summary = detailData?.summary ?? {};` line, type-assert it:

      const summaryTyped: EvalRunSummary = summary as EvalRunSummary;

   c. Delete the existing "Summary breakdown" block (currently lines ~261-270, the `<div className="flex items-center gap-4 text-xs text-muted-foreground">` containing Deterministic / Semantic / Failed spans).

   d. Delete the inline pass-count summary line in the header (currently around lines 245-258, the flex container with the `{passed}/{total} passed ({pct}%)` and the avg latency `<div>`). The card replaces both.

   e. Just before the results table (`{results.length === 0 ? ... : ...}` around line 274), insert the card:

      <EvalRunSummaryCard summary={summaryTyped} results={allResults} />

      `allResults` was introduced in Task 2 (the unfiltered list). If Task 2 named it differently, use that name.

   f. Keep the run header (run number, run_type badge, status badge, version badge, agent name, started_at date) — those are identity info, not summary. Only the summary numbers and breakdown are replaced by the card.

Do not modify the list view, delete modal, or results table.
````

### Acceptance criteria

- [ ] `EvalRunSummary` type defined in `src/lib/types.ts`
- [ ] On run detail: 4-tile grid renders (Total, Passed, Failed, Pass rate); when results have any latency data, an "Avg latency" tile appears
- [ ] On runs with informational results: two extra tiles render — "Within budget" and "Over budget"
- [ ] Pass rate displays as a percentage (`Math.round((passed/total)*100)%`) or `—` when total is 0
- [ ] Failed tile uses destructive color when `failed > 0`
- [ ] The old inline "X/Y passed (Z%)" header line and "Deterministic / Semantic / Failed" breakdown line are gone
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase B.3: EvalRunSummaryCard with derived pass_rate and latency tiles"
```

---

## Task 4: B.4 — Deep mode toggle on improvements panel

Adds a Standard / Deep tab pair above the improvements panel; passes the selected mode through `getSuggestions`; shows a longer-loading state for deep mode.

**Files:**
- Modify: `src/pages/AgentDetail.tsx` — add a `mode` state, render shadcn `<Tabs>` above the suggestions list, pass mode to `getSuggestions`, switch the loading copy when deep is selected

### Lovable prompt

````
Add a Standard / Deep mode toggle to the existing improvements panel.

1. In src/pages/AgentDetail.tsx, near the other improvements state declarations (around lines 46-53), add:

   const [improvementMode, setImprovementMode] = useState<"standard" | "deep">("standard");

2. Update handleSuggestImprovements (currently around lines 255-273) to pass the mode:

   const result = await api.getSuggestions(id, activeVersion.id, latestRun.id, improvementMode);

   The wrapper signature was already updated in Task 1 to accept the mode parameter.

3. In the improvements panel JSX (the `showImprovements && (<div ...>...)` block, currently starting around line 710), insert a Tabs component just below the panel header (above the loading/error/suggestions blocks). Use shadcn Tabs:

   import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
   import { Sparkles, Brain } from "lucide-react";

   ...inside the panel, right after the header `<div>` that contains the title and close button:

   <Tabs value={improvementMode} onValueChange={(v) => setImprovementMode(v as "standard" | "deep")} className="mb-3">
     <TabsList className="grid grid-cols-2 w-full max-w-xs">
       <TabsTrigger value="standard" className="text-xs">
         <Sparkles className="w-3 h-3 mr-1" /> Standard
       </TabsTrigger>
       <TabsTrigger value="deep" className="text-xs">
         <Brain className="w-3 h-3 mr-1" /> Deep
       </TabsTrigger>
     </TabsList>
   </Tabs>

   {improvementMode === "deep" && (
     <p className="text-xs text-muted-foreground mb-2">
       Deep mode runs a dual-model A/B critique-refine pass — takes ~30-60s longer.
     </p>
   )}

4. Update the loading copy. Find the existing loading block in the panel (currently around lines 726-732, the spinner shown while `loadingSuggestions` is true). Change the copy to reflect mode:

   {loadingSuggestions && (
     <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
       <Loader2 className="w-4 h-4 animate-spin" />
       {improvementMode === "deep" ? "Running deep analysis…" : "Generating suggestions…"}
     </div>
   )}

5. Update the trigger button label to reflect mode. Find the "Suggest Improvements" button (currently around lines 698-706). Replace its label/state:

   <button
     onClick={handleSuggestImprovements}
     disabled={loadingSuggestions}
     className={...keep existing classes...}
   >
     {loadingSuggestions
       ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {improvementMode === "deep" ? "Deep analysis…" : "Analyzing…"}</>
       : <><Sparkles className="w-3.5 h-3.5" /> Suggest Improvements</>}
   </button>

6. After a successful deep run, fire a toast so the user gets confirmation since the wait was long. In handleSuggestImprovements, in the success path right after `setSuggestions(result.suggestions);`, add:

   import { useToast } from "@/components/ui/use-toast";
   const { toast } = useToast();   // place near the top of the component if not already there

   if (improvementMode === "deep") {
     toast({ title: "Deep analysis complete", description: `${result.suggestions.length} suggestions ready for review.` });
   }

   Verify the response also includes `result.mode` (echoed by the backend); no UI change needed for it, but log it to the console in dev for sanity:
   if (import.meta.env.DEV) console.log("Improvement mode echoed:", result.mode);

Do not change the suggestion card rendering, accept/reject behavior, or apply-fixes flow.
````

### Acceptance criteria

- [ ] Tabs render above the suggestions area with Standard selected by default
- [ ] Switching to Deep shows the explanatory note "Deep mode runs a dual-model A/B critique-refine pass — takes ~30-60s longer."
- [ ] Clicking "Suggest Improvements" while Standard is active fires `POST /improvements?...&mode=standard`
- [ ] Clicking "Suggest Improvements" while Deep is active fires `POST /improvements?...&mode=deep` (verify in network tab)
- [ ] Loading copy on the button reads "Deep analysis…" while a deep request is in flight, "Analyzing…" otherwise
- [ ] On deep success, toast appears: "Deep analysis complete — N suggestions ready for review."
- [ ] No TypeScript errors; no console errors
- [ ] Switching tabs while a request is in flight is allowed (it does not cancel; the in-flight request still resolves with the previously selected mode — the response's `mode` field reflects what was actually run)

### Commit

```bash
git add -A
git commit -m "Phase B.4: Standard/Deep mode toggle on improvements panel"
```

---

## Task 5: B.5 — Cross-version eval (NewEvalRunDialog)

Replaces the immediate-POST "Run Eval" button with a dialog that lets the user pick a `test_case_source_version_id`. Cross-version eval is the only new behavior; same-version eval remains the default.

**Files:**
- Modify: `src/lib/types.ts` — add `CreateEvalRunRequest` and `CreateEvalRunResponse` types
- Modify: `src/lib/api.ts` — add `createEvalRun` wrapper; remove `runEvalV2` after migration
- Create: `src/components/eval/NewEvalRunDialog.tsx`
- Modify: `src/pages/AgentDetail.tsx` — replace the "Run Eval" button with the dialog trigger; navigate to `/eval-runs?selected={id}` on success
- Modify: `src/pages/EvalRunHistory.tsx` — read `?selected=...` from the URL and open that run's detail view if present

### Lovable prompt

````
Add a New Eval Run dialog with cross-version support, and migrate the existing Run Eval button.

1. In src/lib/types.ts, add (below the EvalRunSummary type):

   export interface CreateEvalRunRequest {
     run_type: "full";
     test_case_source_version_id?: string;
   }

   export interface CreateEvalRunResponse {
     eval_run: {
       id: string;
       agent_id: string;
       agent_version_id: string;
       run_type: string;
       status: string;
       started_at: string;
       completed_at?: string | null;
     };
     summary: EvalRunSummary & { pass_rate?: number; avg_latency_ms?: number; latency?: { within_budget: number; over_budget: number } };
   }

2. In src/lib/api.ts, add the new wrapper near the existing runEvalV2 (line 280) and merge the type imports:

   import {
     AgentSchema, Suggestion, ApplySuggestionsRequest, ApplySuggestionsResponse,
     CreateEvalRunRequest, CreateEvalRunResponse,
   } from "./types";
   // (merge with the existing types import — keep one line)

   createEvalRun: (agentId: string, versionId: string, body: CreateEvalRunRequest) =>
     request<CreateEvalRunResponse>(
       `/agents/${agentId}/versions/${versionId}/eval-runs`,
       { method: "POST", body: JSON.stringify(body) }
     ),

   Leave `runEvalV2` in place for now — Step 5 below removes it after migrating the only call site.

3. Create src/components/eval/NewEvalRunDialog.tsx:

   import { useState } from "react";
   import {
     Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
   } from "@/components/ui/dialog";
   import { Button } from "@/components/ui/button";
   import { Label } from "@/components/ui/label";
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
   import { Loader2, AlertCircle } from "lucide-react";
   import { useToast } from "@/components/ui/use-toast";
   import { api, type AgentVersion } from "@/lib/api";

   interface Props {
     open: boolean;
     onOpenChange: (open: boolean) => void;
     agentId: string;
     targetVersion: AgentVersion;       // the version whose prompt will run (right-hand side)
     allVersions: AgentVersion[];       // selectable test-case sources
     onSuccess: (newRunId: string) => void;
   }

   export function NewEvalRunDialog({ open, onOpenChange, agentId, targetVersion, allVersions, onSuccess }: Props) {
     const { toast } = useToast();
     const [sourceVersionId, setSourceVersionId] = useState<string>(targetVersion.id);
     const [running, setRunning] = useState(false);
     const isCrossVersion = sourceVersionId !== targetVersion.id;

     const sourceVersionLabel = (vid: string) => {
       const v = allVersions.find(x => x.id === vid);
       return v ? `v${v.version_number}${v.label ? ` — ${v.label}` : ""}` : vid.slice(0, 8);
     };

     async function handleSubmit() {
       setRunning(true);
       try {
         const body: CreateEvalRunRequest = isCrossVersion
           ? { run_type: "full", test_case_source_version_id: sourceVersionId }
           : { run_type: "full" };
         const res = await api.createEvalRun(agentId, targetVersion.id, body);
         toast({ title: "Eval run complete", description: `${res.summary.passed}/${res.summary.total} passed` });
         onSuccess(res.eval_run.id);
         onOpenChange(false);
       } catch (err) {
         const message = err instanceof Error ? err.message : "Failed to start eval run";
         toast({ title: "Eval failed", description: message, variant: "destructive" });
       } finally {
         setRunning(false);
       }
     }

     return (
       <Dialog open={open} onOpenChange={(v) => !running && onOpenChange(v)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>New eval run</DialogTitle>
             <DialogDescription>
               Run version <strong>v{targetVersion.version_number}</strong> against test cases from a chosen version.
             </DialogDescription>
           </DialogHeader>

           <div className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="source-version">Test cases from version</Label>
               <Select value={sourceVersionId} onValueChange={setSourceVersionId} disabled={running}>
                 <SelectTrigger id="source-version">
                   <SelectValue placeholder="Pick a version" />
                 </SelectTrigger>
                 <SelectContent>
                   {allVersions.map(v => (
                     <SelectItem key={v.id} value={v.id}>
                       v{v.version_number}{v.label ? ` — ${v.label}` : ""}{v.id === targetVersion.id ? " (this version)" : ""}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             {isCrossVersion && (
               <div className="flex items-start gap-2 px-3 py-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded text-amber-600">
                 <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                 <span>
                   Cross-version eval — running v{targetVersion.version_number}'s prompt against test cases from {sourceVersionLabel(sourceVersionId)}.
                 </span>
               </div>
             )}

             <p className="text-xs text-muted-foreground">
               Eval runs are synchronous and may take 30+ seconds. The dialog will close on completion.
             </p>
           </div>

           <DialogFooter>
             <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
               Cancel
             </Button>
             <Button onClick={handleSubmit} disabled={running}>
               {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Running eval…</> : "Run eval"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     );
   }

   Note: also import `CreateEvalRunRequest` from "@/lib/types" at the top of this file.

4. In src/pages/AgentDetail.tsx, migrate the existing Run Eval button (currently around lines 686 — onClick={handleRunEval}):

   a. Add state for the dialog:

      const [newEvalDialogOpen, setNewEvalDialogOpen] = useState(false);

   b. Add the import:

      import { NewEvalRunDialog } from "@/components/eval/NewEvalRunDialog";
      import { useNavigate } from "react-router-dom";

      const navigate = useNavigate();   // place near the top of the component if not already declared

   c. Replace the existing onClick on the Run Eval button so it opens the dialog instead of calling handleRunEval directly:

      onClick={() => setNewEvalDialogOpen(true)}

      Also remove `disabled={runningEval}` if present and the inline spinner — the dialog manages its own state. The button now just opens the dialog.

   d. Just before the closing tag of the AgentDetail JSX (above the Delete Modal block), render the dialog:

      {activeVersion && (
        <NewEvalRunDialog
          open={newEvalDialogOpen}
          onOpenChange={setNewEvalDialogOpen}
          agentId={id!}
          targetVersion={activeVersion}
          allVersions={versions}
          onSuccess={(newRunId) => navigate(`/eval-runs?selected=${newRunId}`)}
        />
      )}

   e. Delete the now-unused `handleRunEval` function and the `runningEval` state — verify there are no other call sites with a search before deleting.

5. In src/lib/api.ts, remove `runEvalV2` (around lines 280-284). Verify zero call sites first:

   grep -rn "runEvalV2" src/   →   should return nothing after AgentDetail's handleRunEval is gone.

   If any other call sites remain, do NOT delete — fix them first to use createEvalRun.

6. In src/pages/EvalRunHistory.tsx, support the `?selected=` URL param so the dialog's onSuccess navigation lands on the correct detail view:

   a. Add the imports near the top:

      import { useSearchParams } from "react-router-dom";

   b. Inside the component, near the existing view-state declaration:

      const [searchParams, setSearchParams] = useSearchParams();

   c. After the runs query resolves (in whatever effect populates `runs`), add an effect that reads ?selected= and opens that run's detail view if found:

      useEffect(() => {
        const selectedId = searchParams.get("selected");
        if (selectedId && runs.some(r => r.id === selectedId)) {
          setView({ type: "detail", runId: selectedId });
          // Clear the param so back-button navigation doesn't re-open it.
          searchParams.delete("selected");
          setSearchParams(searchParams, { replace: true });
        }
      }, [runs, searchParams, setSearchParams]);

   Use the existing `runs` variable name from the file; if the runs list is named differently, adapt accordingly.
````

### Acceptance criteria

- [ ] `CreateEvalRunRequest` and `CreateEvalRunResponse` types exist in `src/lib/types.ts`
- [ ] `api.createEvalRun(agentId, versionId, body)` is wired and typed; `runEvalV2` is removed
- [ ] Clicking "Run Eval" on `AgentDetail` opens the `NewEvalRunDialog` instead of firing a POST
- [ ] Source version select defaults to the active version (labelled "(this version)")
- [ ] Selecting a different version shows the amber cross-version note with the right text
- [ ] Submitting the dialog fires `POST /eval-runs` with body `{run_type: "full"}` (same-version) or `{run_type: "full", test_case_source_version_id: "..."}` (cross-version) — verify in network tab
- [ ] The dialog cannot be dismissed while the request is in flight; "Cancel" and the close button are disabled
- [ ] On success, toast appears with the pass count and the user is navigated to `/eval-runs?selected={newRunId}`
- [ ] Landing on `/eval-runs?selected={id}` opens that run's detail view automatically; the URL param is then removed
- [ ] On failure, destructive toast appears and the dialog stays open
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase B.5: NewEvalRunDialog with cross-version source select"
```

---

## End-of-phase smoke test

Run all of these in the browser before declaring Phase B complete:

1. **Sidebar:** Four entries — Agents, Test Cases, Eval Runs, Behavioral Check. Eval Runs entry navigates to `/eval-runs`.
2. **Improvements panel — typed suggestions:** Click "Suggest Improvements" on an agent with a recent eval run. Verify each card shows `failure_pattern` as the title and the watch list pill reads "Watching N cases" (not "Affects N cases"). Confidence shown as a percentage when present.
3. **Improvements — apply fast path:** Accept ≥1 suggestion that has a `prompt_patch`. Confirm the apply request body in the network tab includes both `accepted_fix_ids` and `accepted_patches`. New version is created and the panel re-renders against the new version.
4. **Eval run detail — informational rows:** Open an eval run that has at least one informational result. Verify the "Latency Budget" card appears below the main results table; pass/fail counts in the header exclude informational rows.
5. **Eval run detail — summary card:** Verify the 4-tile summary grid (Total/Passed/Failed/Pass rate) replaces the old inline X/Y line. On a run with informational results, two extra latency tiles appear.
6. **Improvements — deep mode:** Switch to Deep tab; click Suggest Improvements; confirm `mode=deep` in the request URL; loading state reads "Deep analysis…"; toast on completion.
7. **New Eval Run dialog — same version:** Open dialog from AgentDetail. Submit without changing the source version. Network tab shows `{run_type: "full"}`. Navigates to `/eval-runs?selected=...` on success and the detail view opens automatically.
8. **New Eval Run dialog — cross-version:** Open dialog. Pick a different source version. Amber note appears. Submit. Network tab shows `test_case_source_version_id` in the body. Same successful navigation.
9. **No regressions:** AgentList, AgentDetail (other panels), AgentUpload, TestCaseAgentList, TestCaseDetail, RegressionDashboard, all Phase A surfaces still load without console errors.
10. **Build:** `npm run build` exits 0 with no TypeScript errors.

## Phase B blockers (carried to follow-up)

- **B.5 cross-version badge in list:** `GET /eval-runs` returns `EvalRun[]` without `agent_version_id` or `test_case_source_version_id`. Adding a "cross-version" badge column on the list requires the backend to extend the legacy `EvalRun` model — not in scope for this plan. Documented in spec §5.4.
