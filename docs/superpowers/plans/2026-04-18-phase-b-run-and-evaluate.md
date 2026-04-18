# Phase B — Run & Evaluate: Implementation Plan

> **For Lovable hand-off:** each task below contains a self-contained "Lovable prompt" block. Paste it into Lovable verbatim. After Lovable ships, verify acceptance criteria in the browser and commit before moving to the next task.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the eval-running surface — informational results, real summary card, deep-mode improvements toggle, and cross-version eval. Fix two outstanding bugs (suggestions fast-path; suggestion field-name mismatch). Add the Eval Runs sidebar entry.

**Architecture:** Builds on the shared infrastructure (types.ts, EmptyState, ApiError) created in Plan A Task 1. Modifies `EvalRunHistory.tsx` heavily. Modifies the improvements panel inside `AgentDetail.tsx`. Adds one new component (`NewEvalRunDialog`).

**Tech Stack:** Same as Plan A.

**Spec reference:** `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` §1 (conventions) and §3 (Phase B items).

**Pre-requisites:** Plan A must be merged. This plan reuses `ApiError`, `EmptyState`, and `src/lib/types.ts`.

**Backend blockers:** None anticipated. Two backend verifications needed before starting:
- B.1: confirm exact field names returned by `/improvements` endpoint (`pattern` vs `failure_pattern`, `cases` vs `affected_cases`). 30-second backend code check on `services/deep_improvement_suggester.py`.
- B.5: confirm `POST /agents/{id}/versions/{vid}/eval-runs` accepts `test_case_source_version_id` in the body.

---

## File map

**Create:**
- `src/components/eval/EvalRunSummaryCard.tsx` (Task 3)
- `src/components/eval/NewEvalRunDialog.tsx` (Task 5)

**Modify:**
- `src/components/AppSidebar.tsx` (Task 1) — add "Eval Runs" nav item
- `src/lib/api.ts` (Tasks 1, 4, 5) — fix `applySuggestions`, add `mode` to `getSuggestions`, replace `runEvalV2` with version that accepts source version id
- `src/lib/types.ts` (Tasks 1, 2, 3) — add `Suggestion`, `EvalRunSummary`, extend `EvalResult`
- `src/pages/AgentDetail.tsx` (Tasks 1, 4) — fix suggestion reader field names, fix applySuggestions call to pass accepted_patches, add deep mode toggle to improvements panel
- `src/pages/EvalRunHistory.tsx` (Tasks 2, 3, 5) — split results into 3 buckets, replace recomputed summary with `EvalRunSummaryCard`, replace immediate "New Eval Run" POST with `NewEvalRunDialog`

---

## Task 1: B.1 — Cleanup prelude (sidebar, fast-path, field-name fix)

**Files:**
- Modify: `src/components/AppSidebar.tsx` — add "Eval Runs" nav item below "Test Cases"
- Modify: `src/lib/api.ts` — change `applySuggestions` signature to accept optional `accepted_patches`
- Modify: `src/lib/types.ts` — add `Suggestion` type
- Modify: `src/pages/AgentDetail.tsx` — improvements panel: read verified field names; pass `accepted_patches` to `applySuggestions`

**Pre-task verification:** Run a single eval run improvements call against the backend and inspect the response shape (network tab or curl). Identify the exact field names. The Lovable prompt below assumes the backend uses `pattern` and `cases` per the spec — **if backend uses `failure_pattern`/`affected_cases`, swap the names in the type and the reader before pasting.**

### Lovable prompt

```
Three small fixes:

1. In src/components/AppSidebar.tsx, add a new nav item below "Test Cases" (which was added in Plan A):
   - Label: "Eval Runs"
   - Path: "/eval-runs"
   - Icon: PlayCircle (lucide-react — add the import)
   - Active when: path.startsWith("/eval-runs")
   Order should be: Agents → Test Cases → Eval Runs → Behavioral Check.

2. In src/lib/types.ts, add the Suggestion type. **Verify the field names against the backend before pasting** — if backend returns `failure_pattern` and `affected_cases`, use those names instead of `pattern` and `cases`:

   export interface SuggestedPatch {
     id: string;
     description: string;
     prompt_patch: string;          // diff or replacement string
     // (other fields the backend may return — keep this open by allowing extra keys via Record-like access in components)
   }

   export interface Suggestion {
     id: string;
     pattern: string;               // human-readable failure pattern (verify name with backend)
     cases: string[];               // affected test case ids (verify name with backend)
     failure_category: string;
     suggested_patches: SuggestedPatch[];
   }

3. In src/lib/api.ts, replace the existing applySuggestions wrapper (currently around lines 314-322) with a version that takes optional accepted_patches for the fast path:

   applySuggestions: (
     agentId: string,
     versionId: string,
     data: {
       eval_run_id: string;
       label: string;
       accepted_fix_ids?: string[];                 // legacy slow path (re-runs suggester)
       accepted_patches?: Record<string, unknown>;  // fast path: skips re-running suggester
     }
   ) =>
     request<any>(
       `/agents/${agentId}/versions/${versionId}/improvements/apply`,
       { method: "POST", body: JSON.stringify(data) }
     ),

   Both keys are optional so existing call sites do not break, but the new code in step 4 will always send accepted_patches.

4. In src/pages/AgentDetail.tsx, locate the improvements panel block (currently around lines 740-815). Make these changes:

   (a) Remove `any` types on suggestion variables. Type them as `Suggestion[]` (import from @/lib/types).

   (b) The current code reads `s.failure_pattern` and `s.affected_cases`. Replace those reads with `s.pattern` and `s.cases` (or the verified field names).

   (c) When the user clicks "Apply suggestions", build accepted_patches from the user's selections in the panel state. Shape the body as:

       accepted_patches: {
         [suggestionId]: { selected_patch_ids: string[] }
       }

       (If your existing UI tracks selections differently — e.g. as a flat array of patch ids — convert to this shape before sending.)

   Then call:

       api.applySuggestions(agentId, versionId, {
         eval_run_id: evalRunId,
         label: newVersionLabel,                // existing variable
         accepted_patches: builtAcceptedPatches,
       })

   Do NOT also send accepted_fix_ids — the fast path only needs accepted_patches.

   (d) Verify in the network tab that the POST body now includes `accepted_patches`.

Do not change anything else in this task. Deep mode toggle is Task 4.
```

### Acceptance criteria

- [ ] Sidebar shows four entries in order: Agents → Test Cases → Eval Runs → Behavioral Check
- [ ] Clicking "Eval Runs" navigates to `/eval-runs` and shows the existing `EvalRunHistory` page
- [ ] On the improvements panel of an agent with eval results: each suggestion's failure pattern and affected test cases display correctly (no "undefined" in the UI)
- [ ] Clicking "Apply suggestions" sends a POST body containing `accepted_patches` (verify in network tab); the request succeeds and a new version is created
- [ ] No TypeScript errors; no `any` left in the improvements panel suggestion code
- [ ] No regressions on other pages

### Commit

```bash
git add -A
git commit -m "Phase B.1: sidebar Eval Runs, suggestions fast-path, field names"
```

---

## Task 2: B.2 — Informational results in eval run detail

**Files:**
- Modify: `src/lib/types.ts` — extend `EvalResult` with `result_type` enum and `latency_ms`, `budget_ms`, `within_budget` (the informational shape)
- Modify: `src/pages/EvalRunHistory.tsx` — split results into 3 buckets; add the Latency Budget card

### Lovable prompt

```
Add a third result bucket for latency-budget informational results.

1. In src/lib/types.ts, add or extend EvalResult (it may currently be in api.ts — if so, leave api.ts version alone for now and add a parallel EvalResultV2 here, then have the page import from types.ts):

   export type ResultType = "deterministic" | "semantic" | "informational";

   export interface EvalResultV2 {
     id: string;
     run_id: string;
     test_case_id: string;
     test_case_input?: string;       // joined from test case for display; backend may include it
     assertion_id: string | null;
     passed: boolean | null;
     reason: string;
     result_type: ResultType;
     // Informational-only fields:
     latency_ms?: number;
     budget_ms?: number;
     within_budget?: boolean;
   }

2. In src/pages/EvalRunHistory.tsx, find the existing logic at lines 130-131 that splits results into `deterministic` and `semantic`. Replace with three buckets:

   const deterministic = results.filter((r) => r.result_type === "deterministic");
   const semantic = results.filter((r) => r.result_type === "semantic");
   const informational = results.filter((r) => r.result_type === "informational");

   (Cast results to EvalResultV2[] at the boundary if needed.)

3. Below the existing Deterministic and Semantic cards in the same page, add a third card "Latency Budget" — but only render it when informational.length > 0 (do NOT render an empty state; informational results are optional).

   The card body lists each informational row:

   <Card>
     <CardHeader>
       <CardTitle className="text-sm">Latency Budget</CardTitle>
       <CardDescription>{informational.length} measurements</CardDescription>
     </CardHeader>
     <CardContent className="space-y-2">
       {informational.map((r) => (
         <div key={r.id} className="flex items-center justify-between text-xs border-b border-border last:border-0 pb-2">
           <div className="flex-1 truncate text-muted-foreground" title={r.test_case_input ?? r.test_case_id}>
             {r.test_case_input ? (r.test_case_input.length > 60 ? r.test_case_input.slice(0, 60) + "…" : r.test_case_input) : `Case ${r.test_case_id}`}
           </div>
           <div className="flex items-center gap-3 shrink-0">
             <span className="font-mono">{r.latency_ms}ms</span>
             <span className="text-muted-foreground">/ {r.budget_ms}ms</span>
             <Badge variant={r.within_budget ? "secondary" : "destructive"} className="text-[10px]">
               {r.within_budget ? "✓ within budget" : "✗ over budget"}
             </Badge>
           </div>
         </div>
       ))}
     </CardContent>
   </Card>

4. Make sure the existing Deterministic and Semantic cards still render unchanged.

Do not change the summary stats at the top of the page in this task — that is Task 3.
```

### Acceptance criteria

- [ ] Open an eval run that has informational results → "Latency Budget" card appears with one row per informational result
- [ ] Each row shows truncated test case input, measured latency_ms, budget_ms, and a green "within budget" or red "over budget" badge
- [ ] Open an eval run with NO informational results → "Latency Budget" card is hidden (not an empty state, just absent)
- [ ] Deterministic and Semantic cards still render correctly with the same content as before
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase B.2: render informational latency-budget results"
```

---

## Task 3: B.3 — Eval run summary card

**Files:**
- Modify: `src/lib/types.ts` — add `EvalRunSummary`
- Modify: `src/lib/api.ts` — type `getEvalRunDetail` to return `EvalRunDetail` containing `summary_json`
- Create: `src/components/eval/EvalRunSummaryCard.tsx`
- Modify: `src/pages/EvalRunHistory.tsx` — replace any client-side recomputation of pass rate / counts with `<EvalRunSummaryCard summary={...} />`

### Lovable prompt

```
Replace client-side summary recomputation with the backend's summary_json.

1. In src/lib/types.ts, add:

   export interface EvalRunLatencySummary {
     within_budget: number;
     over_budget: number;
   }

   export interface EvalRunSummary {
     total: number;
     pass: number;
     fail: number;
     pass_rate: number; // 0..1
     latency?: EvalRunLatencySummary;
   }

   export interface EvalRunDetail {
     id: string;
     agent_id: string;
     agent_version_id: string;
     baseline_version_id: string | null;
     run_type: string;
     status: "PASS" | "FAIL" | "PENDING" | "RUNNING";
     started_at: string;
     finished_at: string | null;
     summary_json: EvalRunSummary | null;
   }

2. In src/lib/api.ts, replace getEvalRunDetail with:

   import { EvalRunDetail } from "./types";

   getEvalRunDetail: (runId: string) =>
     request<EvalRunDetail>(`/eval-runs/${runId}`),

3. Create src/components/eval/EvalRunSummaryCard.tsx:

   import { Card, CardContent } from "@/components/ui/card";
   import { Alert, AlertDescription } from "@/components/ui/alert";
   import { EvalRunSummary } from "@/lib/types";

   interface Props {
     summary: EvalRunSummary | null;
   }

   export function EvalRunSummaryCard({ summary }: Props) {
     if (!summary) {
       return (
         <Alert>
           <AlertDescription className="text-xs">
             Summary unavailable for this run (likely created before summaries were stored).
           </AlertDescription>
         </Alert>
       );
     }

     const passRatePct = Math.round(summary.pass_rate * 100);

     return (
       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
         <Tile label="Total cases" value={summary.total.toString()} />
         <Tile label="Pass" value={summary.pass.toString()} accent="text-green-600" />
         <Tile label="Fail" value={summary.fail.toString()} accent="text-destructive" />
         <Tile label="Pass rate" value={`${passRatePct}%`} />
         {summary.latency && (
           <>
             <Tile label="Within latency budget" value={summary.latency.within_budget.toString()} accent="text-green-600" />
             <Tile label="Over latency budget" value={summary.latency.over_budget.toString()} accent="text-destructive" />
           </>
         )}
       </div>
     );
   }

   function Tile({ label, value, accent }: { label: string; value: string; accent?: string }) {
     return (
       <Card>
         <CardContent className="pt-4">
           <div className="text-xs text-muted-foreground">{label}</div>
           <div className={`text-2xl font-semibold mt-1 ${accent ?? ""}`}>{value}</div>
         </CardContent>
       </Card>
     );
   }

4. In src/pages/EvalRunHistory.tsx, find any code that computes pass count, fail count, or pass rate from the results array (look for filter().length, percentage calculations, etc.). Replace those derived values and the UI elements that show them with:

   <EvalRunSummaryCard summary={runDetail?.summary_json ?? null} />

   Place this card just below the page header for the selected eval run. If runDetail is loading, render a <Skeleton className="h-24" /> in its place.

   The runDetail variable should come from a useQuery using api.getEvalRunDetail(selectedRunId). If such a query does not yet exist on this page, add it (key: ['eval-run', selectedRunId]).

5. Remove any now-unused result-counting helpers that the page used to compute summary stats from results.

Do not touch the three result-bucket cards from Task 2 in this task.
```

### Acceptance criteria

- [ ] Open an eval run with `summary_json` populated → summary tiles show total / pass / fail / pass rate (and latency tiles if `summary.latency` is present)
- [ ] Open an old eval run with `summary_json: null` → "Summary unavailable for this run" alert renders; no crash; no recomputation
- [ ] Tile values match what the backend returns (no client-side recomputation visible on the page)
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase B.3: eval run summary card from backend summary_json"
```

---

## Task 4: B.4 — Deep mode toggle on improvements panel

**Files:**
- Modify: `src/lib/api.ts` — `getSuggestions` accepts `mode` parameter
- Modify: `src/pages/AgentDetail.tsx` — add Standard/Deep tabs at the top of the improvements panel; pass mode through; show extra info copy for deep mode; longer-loading state

### Lovable prompt

```
Add a Standard/Deep mode toggle to the improvements panel.

1. In src/lib/api.ts, replace getSuggestions with:

   getSuggestions: (
     agentId: string,
     versionId: string,
     evalRunId: string,
     mode: "standard" | "deep" = "standard"
   ) =>
     request<{ suggestions: Suggestion[] }>(
       `/agents/${agentId}/versions/${versionId}/improvements?eval_run_id=${evalRunId}&mode=${mode}`,
       { method: "POST" }
     ),

   Import Suggestion from "./types".

2. In src/pages/AgentDetail.tsx improvements panel:

   (a) Add a piece of component state at the top of the improvements section:

       const [improvementMode, setImprovementMode] = useState<"standard" | "deep">("standard");

   (b) Above the existing "Get suggestions" trigger button, render a shadcn <Tabs> control:

       <Tabs value={improvementMode} onValueChange={(v) => setImprovementMode(v as "standard" | "deep")} className="mb-3">
         <TabsList>
           <TabsTrigger value="standard">Standard</TabsTrigger>
           <TabsTrigger value="deep">Deep</TabsTrigger>
         </TabsList>
       </Tabs>

       Below the tabs, when improvementMode === "deep", show:
       <p className="text-xs text-muted-foreground mb-3">
         Deep mode runs dual-model A/B critique-refine. Adds ~30-60s per analysis.
       </p>

   (c) Update the suggestions fetch to pass the mode. If the panel uses useMutation, change the mutationFn to:

       mutationFn: () => api.getSuggestions(agentId, versionId, evalRunId, improvementMode)

       Make sure the React Query key (if useQuery is used) includes improvementMode so switching modes triggers a fresh fetch.

   (d) The "Get suggestions" button label and disabled-loading state should reflect the mode:

       <Button disabled={mutation.isPending}>
         {mutation.isPending
           ? (improvementMode === "deep" ? "Running deep analysis…" : "Analyzing…")
           : (improvementMode === "deep" ? "Run deep analysis" : "Get suggestions")}
       </Button>

   (e) When switching from deep back to standard while a request is pending: do nothing special — let the in-flight request complete; the next click will use the new mode.

Do not change anything outside the improvements panel in this task.
```

### Acceptance criteria

- [ ] Improvements panel header shows two tabs: "Standard" (selected by default) and "Deep"
- [ ] Switching to "Deep" reveals the inline note about ~30-60s extra time
- [ ] Clicking the action button sends a POST to `/improvements?eval_run_id=...&mode=standard` (or `mode=deep`); verify in network tab
- [ ] During deep-mode pending state, button label reads "Running deep analysis…" and is disabled
- [ ] After deep-mode completes, suggestions render the same as standard mode (same `Suggestion` type)
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase B.4: deep mode toggle on improvements panel"
```

---

## Task 5: B.5 — Cross-version eval

**Pre-task verification:** Confirm `POST /agents/{id}/versions/{vid}/eval-runs` accepts `{test_case_source_version_id}` in the body. Quick check with curl. If the backend does not accept it (or returns 422), file a backend ask and skip Task 5.

**Files:**
- Modify: `src/lib/api.ts` — replace `runEvalV2` with `createEvalRun` that accepts the body parameter; keep `runEvalV2` only as a thin alias if other callers exist (or migrate them)
- Modify: `src/lib/types.ts` — add `EvalRun` (or extend existing) with `agent_version_id`, `baseline_version_id`, and `test_case_source_version_id`
- Create: `src/components/eval/NewEvalRunDialog.tsx`
- Modify: `src/pages/EvalRunHistory.tsx` — replace any direct "New Eval Run" POST with the dialog; add cross-version badge to list rows

### Lovable prompt

```
Add cross-version eval support.

1. In src/lib/types.ts, add (or extend the existing EvalRun type if you find one already):

   export interface EvalRunV2 {
     id: string;
     agent_id: string;
     agent_version_id: string;
     baseline_version_id: string | null;
     test_case_source_version_id: string;   // version whose test cases were used
     run_type: string;
     status: "PASS" | "FAIL" | "PENDING" | "RUNNING";
     started_at: string;
     pass_count: number;
     total_count: number;
   }

2. In src/lib/api.ts, add (alongside the existing runEvalV2):

   import { EvalRunV2 } from "./types";

   createEvalRun: (
     agentId: string,
     versionId: string,
     body: { test_case_source_version_id?: string; run_type?: string }
   ) =>
     request<EvalRunV2>(
       `/agents/${agentId}/versions/${versionId}/eval-runs`,
       { method: "POST", body: JSON.stringify({ run_type: "full", ...body }) }
     ),

   Leave runEvalV2 in place for any existing callers; new code uses createEvalRun.

3. Create src/components/eval/NewEvalRunDialog.tsx:

   import { useState } from "react";
   import { useMutation, useQuery } from "@tanstack/react-query";
   import { useNavigate } from "react-router-dom";
   import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
   import { Button } from "@/components/ui/button";
   import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
   import { useToast } from "@/components/ui/use-toast";
   import { api } from "@/lib/api";
   import { ReactNode } from "react";

   interface Props {
     agentId: string;
     versionId: string;       // target version (whose prompt will be evaluated)
     trigger: ReactNode;
   }

   export function NewEvalRunDialog({ agentId, versionId, trigger }: Props) {
     const [open, setOpen] = useState(false);
     const [sourceVersionId, setSourceVersionId] = useState<string>(versionId);
     const nav = useNavigate();
     const { toast } = useToast();

     const versions = useQuery({
       queryKey: ['agent', agentId, 'versions'],
       queryFn: () => api.getAgentVersions(agentId),
     });

     const mutation = useMutation({
       mutationFn: () => api.createEvalRun(agentId, versionId, { test_case_source_version_id: sourceVersionId }),
       onSuccess: (run) => {
         toast({ title: "Eval run started" });
         setOpen(false);
         nav(`/eval-runs?selected=${run.id}`);
       },
       onError: (err: Error) => {
         toast({ title: "Failed to start eval run", description: err.message, variant: "destructive" });
       },
     });

     const isCrossVersion = sourceVersionId !== versionId;

     return (
       <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>{trigger}</DialogTrigger>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>New eval run</DialogTitle>
             <DialogDescription>
               Run version's prompt against a chosen set of test cases.
             </DialogDescription>
           </DialogHeader>

           <div className="space-y-3 py-2">
             <div>
               <label className="text-xs font-medium mb-1 block">Test cases from version</label>
               <Select value={sourceVersionId} onValueChange={setSourceVersionId}>
                 <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                 <SelectContent>
                   {(versions.data ?? []).map((v) => (
                     <SelectItem key={v.id} value={v.id}>
                       v{v.version_number} {v.id === versionId ? "(current)" : ""}{v.label ? ` — ${v.label}` : ""}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>

             {isCrossVersion && (
               <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded">
                 Cross-version eval — running this version's prompt against test cases authored on the selected version.
               </p>
             )}
           </div>

           <DialogFooter>
             <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>Cancel</Button>
             <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
               {mutation.isPending ? "Starting…" : "Start run"}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     );
   }

4. In src/pages/EvalRunHistory.tsx:

   (a) Find the existing "New Eval Run" / "Run eval" trigger (button that currently fires a POST directly). Wrap it in <NewEvalRunDialog ...> as the trigger. The page will need agentId and versionId — if it does not currently know an active version, add a small version dropdown above the list (sourcing from api.getAgentVersions for the selected agent), defaulting to the latest version.

   (b) For each row in the eval-runs list, when run.test_case_source_version_id !== run.agent_version_id, render a small badge next to the run's label: <Badge variant="outline" className="text-[10px]">cross-version</Badge>.

   (c) If there is also a "New Eval Run" entry on AgentDetail.tsx that fires a POST directly, swap that to use NewEvalRunDialog as well, with that page's active versionId.

Do not change the eval run detail view in this task — that was Tasks 2 and 3.
```

### Acceptance criteria

- [ ] Backend pre-check passed (or backend ask filed and Task 5 skipped)
- [ ] Clicking "New Eval Run" opens the dialog instead of firing a POST immediately
- [ ] Version dropdown lists all versions of the agent; current is default
- [ ] When user selects a different source version, the inline note appears
- [ ] Submit kicks off the run, navigates to the new run; toast on success
- [ ] On the eval runs list, cross-version runs show the "cross-version" badge
- [ ] On the eval runs list, same-version runs do NOT show the badge
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase B.5: cross-version eval dialog and badge"
```

---

## End-of-phase smoke test

Run all of these in the browser before declaring Phase B complete:

1. **Sidebar:** Four entries — Agents → Test Cases → Eval Runs → Behavioral Check. Eval Runs entry navigates to `/eval-runs`.
2. **Improvements field names:** Open an agent with at least one eval run → click into improvements → suggestions render with no "undefined" in the UI.
3. **Improvements fast-path:** Apply suggestions; verify network tab shows `accepted_patches` in the request body.
4. **Informational results:** Open an eval run with informational results → "Latency Budget" card renders with rows. Open one without → card is hidden.
5. **Summary card:** Eval run detail shows tiles populated from `summary_json` (no client-side recomputation). Old runs without `summary_json` show the "unavailable" alert.
6. **Deep mode:** Improvements panel has Standard/Deep tabs; Deep shows the time-warning note; switching modes triggers a fresh fetch with `mode=deep` in the URL.
7. **Cross-version eval:** "New Eval Run" opens the dialog; selecting a different source version shows the inline note; the new run is badged "cross-version" in the list.
8. **No regressions:** Phase A pages still work (Schema, Contract V2, Regenerate, Manual test case).
9. **Build:** `npm run build` exits 0 with no TypeScript errors.

If all pass, Phase B is shipped. Move to Plan C.
