# Phase C — Compare & Ship: Implementation Plan

> **For Lovable hand-off:** each task below contains a self-contained "Lovable prompt" block. Paste it into Lovable verbatim. After Lovable ships, verify the acceptance criteria in the browser and commit before moving to the next task.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the comparison surface — per-result regression-type badges + filters on `RegressionDashboard`, test-case ↔ obligation linkage on the test-case list and detail, a Version Diff page accessible from the agent header, and the `no_progress[]` rendering scaffolded behind a backend-ask gate.

**Architecture:** All work in the existing `agent-contract-studio` repo. New types added to `src/lib/types.ts`. New components in `src/components/regression/` and `src/components/diff/`. New page `src/pages/VersionDiff.tsx`. Existing `RegressionDashboard.tsx`, `TestCaseAgentList.tsx`, `TestCaseDetail.tsx`, and `AgentDetail.tsx` extended in place.

**Tech Stack:** React + Vite + TypeScript + Tailwind + shadcn-ui + React Query + React Router. Plus `react-diff-viewer-continued` for the prompt diff (added in Task 3).

**Spec reference:** `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` §4 (Phase C items) and §5 (cross-cutting).

**Plan A & B dependencies (must already be merged):**
- `ApiError` class exported from `src/lib/api.ts` and `request<T>` throws it (Plan A Task 1).
- `src/lib/types.ts` has `FailureCategory`, `EvalResult` (with `regression_type`), `EvalRunSummary`, `ContractV2` and obligation types (Plans A and B).
- `AgentDetail.tsx` contract panel renders obligations with `id={"obligation-${id}"}` anchors (Plan A Task 3 — required for the C.2 deep-link).
- `EvalRunHistory.tsx` is summary-card-driven (Plan B Task 3).

**Backend (verified on `agentops-backend@v2-behavioral-contracts`):**
- `POST /agents/{id}/regression-run` body `{challenger_version_id, baseline_version_id}` returns `RegressionRunResponse {status, run_id, challenger_version_id, baseline_version_id, summary, regressions, improvements}` (`routers/regression_v2.py:229-237`). When the run is **blocked**, the response is wrapped in `HTTPException(422, detail=response)` — the JSON shape is identical, but it arrives as HTTP 422 with the body under `detail`. The existing `RegressionDashboard.tsx` already handles this (lines 128-134) — Task 1 keeps that pattern when introducing the typed wrapper.
- The `no_progress: RegressionItem[]` array is **not** returned by the backend yet (`routers/regression_v2.py:229-237` — `summary.no_progress_count` is present, but no per-case array). Task 4 ships scaffold and a backend-ask doc; rows render only when the backend lands the field.
- `eval_results.regression_type` exists on the model and is one of `STABLE | REGRESSION | IMPROVEMENT | NO_PROGRESS`. The legacy `GET /eval-runs/{run_id}` may or may not surface this on each row — the dashboard derives the badge from the array bucket (`regressions[]` vs `improvements[]`) when the field is absent (Task 1).
- `TestCaseV2.obligation_ids: string[]` is already returned by `getTestCasesV2` and `getTestCaseDetail` (no change). Task 2 resolves these to obligation `text` via the contract fetch already on the page.
- `getEvalRuns()` (`GET /eval-runs`) returns `EvalRun[]` with `agent_version_id`. Task 3's "Eval delta" tab filters this client-side per version (no per-version eval-runs listing endpoint exists).
- `getAgentVersions(agentId)` returns versions including `system_prompt`. `getSchema(agentId)` returns one schema per agent (agent-scoped, not version-scoped) — the diff Schema tab shows the same value on both sides with an explanatory note.

---

## File map

**Create:**
- `src/components/regression/RegressionTypeBadge.tsx` (Task 1)
- `src/components/regression/RegressionFilterChips.tsx` (Task 1)
- `src/components/regression/NoProgressSection.tsx` (Task 4)
- `src/components/diff/VersionPicker.tsx` (Task 3)
- `src/components/diff/PromptDiff.tsx` (Task 3)
- `src/components/diff/ContractDiff.tsx` (Task 3)
- `src/components/diff/EvalDeltaTab.tsx` (Task 3)
- `src/pages/VersionDiff.tsx` (Task 3)

**Modify:**
- `src/lib/types.ts` (Tasks 1, 2)
- `src/lib/api.ts` (Task 1 — typed `runRegressionV2` and `getLatestRegressionRun`)
- `src/pages/RegressionDashboard.tsx` (Tasks 1, 4)
- `src/pages/TestCaseAgentList.tsx` (Task 2)
- `src/pages/TestCaseDetail.tsx` (Task 2)
- `src/pages/AgentDetail.tsx` (Task 3 — Compare versions button)
- `src/App.tsx` (Task 3 — diff route)

---

## Task 1: C.1 — Regression types, badges, and filter chips

Adds typed regression response, per-result `RegressionTypeBadge`, and a multi-select filter chip row above the swim lanes. Also adopts the typed 422-aware fetch wrapper.

**Files:**
- Modify: `src/lib/types.ts` — add `RegressionType`, `RegressionItem`, `ImprovementItem`, `RegressionSummary`, `RegressionRunResponse`
- Modify: `src/lib/api.ts` — add a typed `runRegressionV2Typed` wrapper that returns `RegressionRunResponse` and unwraps 422 → `status: "BLOCKED"`; type `getLatestRegressionRun` similarly
- Create: `src/components/regression/RegressionTypeBadge.tsx`
- Create: `src/components/regression/RegressionFilterChips.tsx`
- Modify: `src/pages/RegressionDashboard.tsx` — adopt typed types, render badge per row, render filter chips above swim lanes, gate per-section visibility on filter selection

### Lovable prompt

````
Add typed regression types, per-result badges, and a filter chip row to the regression dashboard.

1. In src/lib/types.ts, add:

   export type RegressionType = "STABLE" | "REGRESSION" | "IMPROVEMENT" | "NO_PROGRESS";

   export interface FailedAssertion {
     assertion_id: string;
     reason: string;
   }

   export interface RegressionItem {
     test_case_id: string;
     scenario: string;
     failed_assertions: FailedAssertion[];
   }

   export interface ImprovementItem {
     test_case_id: string;
     scenario: string;
   }

   export interface NoProgressItem {
     test_case_id: string;
     scenario: string;
   }

   export interface RegressionSummary {
     locked_cases_total: number;
     stable_count: number;
     regression_count: number;
     improvement_count: number;
     no_progress_count: number;
   }

   export interface RegressionRunResponse {
     status: "PASSED" | "BLOCKED";
     run_id: string;
     challenger_version_id: string;
     baseline_version_id: string;
     summary: RegressionSummary;
     regressions: RegressionItem[];
     improvements: ImprovementItem[];
     no_progress?: NoProgressItem[];   // backend has not landed this array yet (only summary count)
   }

2. In src/lib/api.ts, add a typed wrapper near the existing runRegressionV2 (around line 218). The new wrapper unwraps 422 responses (regression "blocked") into a normal RegressionRunResponse with status: "BLOCKED" so callers can render uniformly:

   import { RegressionRunResponse } from "./types";
   // (merge with existing types import)

   runRegressionV2Typed: async (agentId: string, body: { challenger_version_id: string; baseline_version_id: string }): Promise<RegressionRunResponse> => {
     const res = await fetch(`${API_BASE}/agents/${agentId}/regression-run`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "ngrok-skip-browser-warning": "true",
       },
       body: JSON.stringify(body),
     });
     if (res.ok) {
       const json = await res.json();
       return { ...json, status: json.status ?? "PASSED" } as RegressionRunResponse;
     }
     if (res.status === 422) {
       const json = await res.json();
       const detail = json.detail ?? json;
       return { ...detail, status: detail.status ?? "BLOCKED" } as RegressionRunResponse;
     }
     // Any other non-OK is a real error.
     const text = await res.text();
     let body: unknown = text;
     try { body = JSON.parse(text); } catch { /* keep as text */ }
     throw new ApiError(res.status, `Regression run failed (HTTP ${res.status}): ${text.slice(0, 200)}`, body);
   },

   getLatestRegressionRunTyped: (agentId: string) =>
     request<RegressionRunResponse>(`/agents/${agentId}/regression-run/latest`),

   Leave the existing runRegressionV2 (raw fetch) and getLatestRegressionRun (untyped) in place for now — Step 6 below removes them after the dashboard migrates.

3. Create src/components/regression/RegressionTypeBadge.tsx:

   import { Check, X, ArrowDown, ArrowUp, MinusCircle } from "lucide-react";
   import { RegressionType } from "@/lib/types";

   interface Props { type: RegressionType; }

   export function RegressionTypeBadge({ type }: Props) {
     const config = {
       STABLE:      { label: "Stable",      Icon: Check,       cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
       REGRESSION:  { label: "Regression",  Icon: ArrowDown,   cls: "bg-destructive/15 text-destructive border-destructive/30" },
       IMPROVEMENT: { label: "Improvement", Icon: ArrowUp,     cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
       NO_PROGRESS: { label: "No progress", Icon: MinusCircle, cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
     }[type];
     if (!config) return null;
     const { label, Icon, cls } = config;
     return (
       <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium border rounded-sm ${cls}`}>
         <Icon className="w-2.5 h-2.5" />
         {label}
       </span>
     );
   }

4. Create src/components/regression/RegressionFilterChips.tsx:

   import { RegressionType } from "@/lib/types";

   const ALL_TYPES: RegressionType[] = ["STABLE", "REGRESSION", "IMPROVEMENT", "NO_PROGRESS"];

   interface Props {
     active: Set<RegressionType>;
     onChange: (next: Set<RegressionType>) => void;
   }

   const labelMap: Record<RegressionType, string> = {
     STABLE: "Stable",
     REGRESSION: "Regression",
     IMPROVEMENT: "Improvement",
     NO_PROGRESS: "No progress",
   };

   export function RegressionFilterChips({ active, onChange }: Props) {
     function toggle(t: RegressionType) {
       const next = new Set(active);
       if (next.has(t)) {
         next.delete(t);
         if (next.size === 0) {
           // never allow zero-state — reset to all
           ALL_TYPES.forEach(x => next.add(x));
         }
       } else {
         next.add(t);
       }
       onChange(next);
     }
     return (
       <div className="flex flex-wrap gap-1.5 mb-4">
         <span className="text-[10px] uppercase tracking-wide text-muted-foreground self-center mr-1">Filter</span>
         {ALL_TYPES.map(t => {
           const on = active.has(t);
           return (
             <button
               key={t}
               onClick={() => toggle(t)}
               className={`px-2 py-0.5 text-[11px] rounded-sm border transition-colors ${
                 on
                   ? "bg-primary/15 text-primary border-primary/30"
                   : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
               }`}
             >
               {labelMap[t]}
             </button>
           );
         })}
       </div>
     );
   }

5. In src/pages/RegressionDashboard.tsx, make these in-place changes:

   a. Replace the local interfaces (currently lines 6-42: FailedAssertion, RegressionCase, ImprovementCase, NoProgressCase, RegressionResult) with imports from the shared types file:

      import {
        RegressionType,
        RegressionItem,
        ImprovementItem,
        NoProgressItem,
        RegressionRunResponse,
        FailedAssertion,
      } from "@/lib/types";

      Update the result state typing:

      const [result, setResult] = useState<RegressionRunResponse | null>(null);

   b. Add the filter chip state below the result state:

      const [activeFilters, setActiveFilters] = useState<Set<RegressionType>>(
        new Set(["STABLE", "REGRESSION", "IMPROVEMENT", "NO_PROGRESS"])
      );

   c. Replace the existing 422-handling block in the run handler (currently lines 122-154) with a call to the new typed wrapper:

      try {
        const r = await api.runRegressionV2Typed(selectedAgentId, {
          challenger_version_id: challengerVersionId,
          baseline_version_id: baselineVersionId,
        });
        setResult(r);
      } catch (err) {
        // The typed wrapper throws ApiError for 4xx/5xx other than 422 (which it unwraps to BLOCKED).
        const message = err instanceof Error ? err.message : "Regression run failed";
        // Preserve the existing friendly-error mapping for 404 / 400-no-locked / 400-same-versions:
        const lower = message.toLowerCase();
        let friendly = message;
        if (message.includes("HTTP 404")) {
          friendly = "Agent or version not found. Please refresh and try again.";
        } else if (message.includes("HTTP 400") && lower.includes("no locked")) {
          friendly = "No locked test cases found in the selected baseline version. Go to Test Cases and lock some cases first.";
        } else if (message.includes("HTTP 400") && lower.includes("baseline") && lower.includes("challenger")) {
          friendly = "Baseline and challenger cannot be the same version.";
        }
        setError(friendly);
      } finally {
        setRunning(false);
      }

   d. Just above the swim-lanes block (currently line 314 `<div className="space-y-3">`), insert the filter chips. Import them at the top:

      import { RegressionFilterChips } from "@/components/regression/RegressionFilterChips";
      import { RegressionTypeBadge } from "@/components/regression/RegressionTypeBadge";

      Insert before the swim lanes div:

      <RegressionFilterChips active={activeFilters} onChange={setActiveFilters} />

   e. Gate each swim-lane section on filter membership AND non-empty count:

      Replace `{result.summary.stable_count > 0 && (...)}` with:
        {activeFilters.has("STABLE") && result.summary.stable_count > 0 && (...)}

      Replace `{result.summary.regression_count > 0 && (...)}` with:
        {activeFilters.has("REGRESSION") && result.summary.regression_count > 0 && (...)}

      Replace `{result.summary.improvement_count > 0 && (...)}` with:
        {activeFilters.has("IMPROVEMENT") && result.summary.improvement_count > 0 && (...)}

      Replace `{result.summary.no_progress_count > 0 && (...)}` with:
        {activeFilters.has("NO_PROGRESS") && result.summary.no_progress_count > 0 && (...)}

   f. Add a RegressionTypeBadge next to each per-row scenario inside the swim lanes:

      In the regressions map (currently around lines 329-355), inside the button after the X icon:
        <RegressionTypeBadge type="REGRESSION" />

      In the improvements map (lines 366-371), inside the row before the scenario text:
        <RegressionTypeBadge type="IMPROVEMENT" />

      In the no_progress map (lines 383-388, behind the if-defined check that already exists), inside the row before the scenario text:
        <RegressionTypeBadge type="NO_PROGRESS" />

      Stable cases don't have a per-row list yet (the section header is just a count) — no badge needed there until C.4 adds the array.

6. After the dashboard migrates and you've smoke-tested it, do the cleanup pass on src/lib/api.ts:

   a. Search the repo for any remaining usage of the old runRegressionV2 (raw fetch returning Response) and getLatestRegressionRun (untyped). The dashboard is the only known caller.
   b. If zero callers remain, delete both wrappers and rename runRegressionV2Typed → runRegressionV2, and getLatestRegressionRunTyped → getLatestRegressionRun. Update the dashboard call site to match.
   c. Re-run npm run build to confirm.

Do not modify the run config section (agent picker, version pickers, run button) — only the result rendering.
````

### Acceptance criteria

- [ ] All five new types exported from `src/lib/types.ts`: `RegressionType`, `RegressionItem`, `ImprovementItem`, `NoProgressItem`, `RegressionSummary`, `RegressionRunResponse`
- [ ] `api.runRegressionV2` (post-cleanup name) returns `Promise<RegressionRunResponse>` and converts 422 to `status: "BLOCKED"`; non-422 errors throw `ApiError`
- [ ] Regression dashboard compiles with no `any` for the result; the local copy of the regression interfaces is removed
- [ ] Filter chips render above swim lanes; toggling one hides its section; toggling all four off resets to all four on (no zero state)
- [ ] Each per-row scenario in BROKE / IMPROVED / NO CHANGE sections shows a colored regression-type badge inline
- [ ] Same-version regression run still triggers the friendly "Baseline and challenger cannot be the same version" error
- [ ] 422 (BLOCKED) response renders the same shape as PASSED (just with the destructive banner) — no error toast
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase C.1: typed regression response, badges, filter chips"
```

---

## Task 2: C.2 — Test case ↔ obligation linkage

Adds an "Obligations" column + filter to the test case list, and a "Covers Obligations" section to the test case detail with anchor links to the contract panel on `AgentDetail`.

**Files:**
- Modify: `src/lib/types.ts` — add `TestCaseV2` type with `obligation_ids`
- Modify: `src/pages/TestCaseAgentList.tsx` — Obligations column + multi-select filter
- Modify: `src/pages/TestCaseDetail.tsx` — Covers Obligations section with linked badges

### Lovable prompt

````
Add obligation linkage to the test case list and detail pages.

1. In src/lib/types.ts, add (above ContractV2 if not already grouped):

   export interface TestCaseV2 {
     id: string;
     agent_id: string;
     agent_version_id: string;
     scenario: string;
     prompt: string;
     obligation_ids: string[];
     forbidden_behavior_ids?: string[];
     latency_budget_id?: string | null;
     locked: boolean;
     lock_intent?: "protect" | "track" | null;
     created_at: string;
   }

   // Use this in any test-case-list rendering — replace `any` with TestCaseV2.

2. In src/pages/TestCaseAgentList.tsx:

   a. Update the test cases state to be typed:

      import { TestCaseV2 } from "@/lib/types";

      const [testCases, setTestCases] = useState<TestCaseV2[]>([]);

      Likewise type any local `cases: any[]` to TestCaseV2[].

   b. The contract is already fetched on this page. Use it to build an obligation lookup. Find the place where the contract is loaded (api.getContractV2 call) and after it resolves, derive a memoized lookup:

      const obligationLookup = useMemo(() => {
        const map: Record<string, { text: string; failure_category?: string }> = {};
        if (contract?.obligations) {
          for (const o of contract.obligations) {
            map[o.id] = { text: o.text, failure_category: o.failure_category };
          }
        }
        return map;
      }, [contract]);

   c. Add an "Obligations" column to the test case table. In the `<thead>` row, after the Scenario column header, add:

      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Obligations</th>

      In each `<tbody>` row, after the scenario cell, add a cell that renders one badge per obligation_id resolved to the obligation text (truncated). Fall back to the id if not found:

      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {(tc.obligation_ids ?? []).slice(0, 3).map((oid) => {
            const o = obligationLookup[oid];
            const label = o?.text ?? oid.slice(0, 8);
            return (
              <span
                key={oid}
                className="inline-flex px-1.5 py-0.5 text-[10px] bg-muted text-foreground border border-border rounded-sm max-w-[160px] truncate"
                title={o?.text ?? oid}
              >
                {label.length > 24 ? label.slice(0, 24) + "…" : label}
              </span>
            );
          })}
          {(tc.obligation_ids?.length ?? 0) > 3 && (
            <span className="inline-flex px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{(tc.obligation_ids?.length ?? 0) - 3} more
            </span>
          )}
        </div>
      </td>

   d. Add a multi-select obligation filter to the existing filter bar. Use a shadcn Popover with checkboxes:

      import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
      import { Checkbox } from "@/components/ui/checkbox";
      import { Filter } from "lucide-react";

      State near the other filter state (top of the component):

      const [obligationFilter, setObligationFilter] = useState<Set<string>>(new Set());

      In the filter bar render:

      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-muted">
            <Filter className="w-3 h-3" />
            Obligations {obligationFilter.size > 0 && `(${obligationFilter.size})`}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2 max-h-80 overflow-y-auto">
          <div className="space-y-1">
            {Object.entries(obligationLookup).map(([oid, o]) => (
              <label key={oid} className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-muted cursor-pointer">
                <Checkbox
                  checked={obligationFilter.has(oid)}
                  onCheckedChange={(checked) => {
                    setObligationFilter(prev => {
                      const next = new Set(prev);
                      if (checked) next.add(oid);
                      else next.delete(oid);
                      return next;
                    });
                  }}
                />
                <span className="truncate" title={o.text}>{o.text}</span>
              </label>
            ))}
            {Object.keys(obligationLookup).length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">No contract obligations available.</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

   e. Update the visible-test-cases derivation to apply the filter — find the existing filter chain (search the file for `.filter(` on testCases) and add:

      .filter(tc => {
        if (obligationFilter.size === 0) return true;
        return (tc.obligation_ids ?? []).some(oid => obligationFilter.has(oid));
      })

3. In src/pages/TestCaseDetail.tsx:

   a. Type the test case shape:

      import { TestCaseV2 } from "@/lib/types";
      // Replace the local `any` typing on the state with TestCaseV2.

   b. Fetch the contract for this test case's version so obligations can be resolved. If the page already loads the contract, reuse it; otherwise add:

      const { data: contract } = useQuery({
        queryKey: ['agent', testCase?.agent_id, 'version', testCase?.agent_version_id, 'contract-v2'],
        queryFn: () => api.getContractV2(testCase!.agent_id, testCase!.agent_version_id),
        enabled: !!testCase,
      });

      const obligationLookup = useMemo(() => {
        const map: Record<string, { text: string; failure_category?: string }> = {};
        if (contract?.obligations) {
          for (const o of contract.obligations) {
            map[o.id] = { text: o.text, failure_category: o.failure_category };
          }
        }
        return map;
      }, [contract]);

   c. Below the existing test case meta (scenario, prompt, locks), add a new section "Covers Obligations":

      import { Link } from "react-router-dom";

      {testCase.obligation_ids && testCase.obligation_ids.length > 0 && (
        <section className="mt-6 border border-border rounded bg-card">
          <header className="px-3 py-2 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Covers Obligations</h3>
          </header>
          <ul className="divide-y divide-border">
            {testCase.obligation_ids.map(oid => {
              const o = obligationLookup[oid];
              return (
                <li key={oid} className="px-3 py-2 flex items-center gap-2">
                  <Link
                    to={`/agents/${testCase.agent_id}#obligation-${oid}`}
                    className="text-xs text-primary hover:underline flex-1 truncate"
                    title={o?.text ?? oid}
                  >
                    {o?.text ?? oid}
                  </Link>
                  {o?.failure_category && (
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                      {o.failure_category}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      The route `/agents/{id}#obligation-{oid}` opens AgentDetail and the browser scrolls to the anchor (Plan A Task 3 added the `id="obligation-{id}"` attribute on each rendered obligation).

   d. If the page lacks a contract scope when no agent_version_id is known on the test case, render the section with id-only badges and skip the link (no navigation target).

Do not change the lock/unlock controls or any other behavior.
````

### Acceptance criteria

- [ ] `TestCaseV2` exported from `src/lib/types.ts`
- [ ] Test case list shows an "Obligations" column with up to 3 obligation badges per row + "+N more" overflow
- [ ] Obligation badges show resolved obligation text (truncated, full text in `title`); fall back to id slice when contract has no match
- [ ] Obligation filter popover lists all obligations for the active version's contract; selecting one filters the list (multi-select OR semantics)
- [ ] Test case detail shows a "Covers Obligations" section listing each linked obligation with a category badge when present
- [ ] Clicking an obligation in the detail page navigates to `/agents/{agentId}#obligation-{oid}` and the AgentDetail page scrolls to that obligation
- [ ] No TypeScript errors; no console errors
- [ ] On a test case with `obligation_ids: []`, the "Covers Obligations" section is hidden; on the list, the obligation cell renders empty (no overflow text)

### Commit

```bash
git add -A
git commit -m "Phase C.2: test case ↔ obligation linkage on list and detail"
```

---

## Task 3: C.3 — Version Diff page

A new page at `/agents/:agentId/versions/:versionId/diff/:otherVersionId` with 4 tabs (Prompt, Schema, Contract, Eval delta), reachable via a "Compare versions" button on `AgentDetail`.

**Files:**
- Install: `react-diff-viewer-continued`
- Create: `src/components/diff/PromptDiff.tsx`
- Create: `src/components/diff/ContractDiff.tsx`
- Create: `src/components/diff/EvalDeltaTab.tsx`
- Create: `src/components/diff/VersionPicker.tsx`
- Create: `src/pages/VersionDiff.tsx`
- Modify: `src/App.tsx` — add the diff route
- Modify: `src/pages/AgentDetail.tsx` — add a "Compare versions" button + popover in the agent header

### Lovable prompt

````
Add a Version Diff page with Prompt, Schema, Contract, and Eval delta tabs.

1. Install the diff viewer:

   npm install react-diff-viewer-continued

2. Create src/components/diff/PromptDiff.tsx:

   import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
   import { AgentVersion } from "@/lib/api";

   interface Props {
     left: AgentVersion;
     right: AgentVersion;
   }

   export function PromptDiff({ left, right }: Props) {
     return (
       <div className="border border-border rounded overflow-hidden">
         <ReactDiffViewer
           oldValue={left.system_prompt ?? ""}
           newValue={right.system_prompt ?? ""}
           splitView
           compareMethod={DiffMethod.WORDS}
           leftTitle={`v${left.version_number}${left.label ? ` — ${left.label}` : ""}`}
           rightTitle={`v${right.version_number}${right.label ? ` — ${right.label}` : ""}`}
           styles={{
             variables: {
               dark: {
                 diffViewerBackground: "hsl(var(--card))",
                 diffViewerColor: "hsl(var(--foreground))",
               },
             },
           }}
           useDarkTheme
         />
       </div>
     );
   }

3. Create src/components/diff/ContractDiff.tsx:

   import { ContractV2, ObligationV2 } from "@/lib/types";

   interface Props {
     left: ContractV2 | null;
     right: ContractV2 | null;
   }

   type ChangeKind = "added" | "removed" | "unchanged";

   function diffById<T extends { id: string }>(a: T[], b: T[]): { item: T; kind: ChangeKind; side: "left" | "right" }[] {
     const aIds = new Set(a.map(x => x.id));
     const bIds = new Set(b.map(x => x.id));
     const out: { item: T; kind: ChangeKind; side: "left" | "right" }[] = [];
     for (const x of a) {
       out.push({ item: x, kind: bIds.has(x.id) ? "unchanged" : "removed", side: "left" });
     }
     for (const x of b) {
       if (!aIds.has(x.id)) out.push({ item: x, kind: "added", side: "right" });
     }
     return out;
   }

   function diffByJson<T>(a: T[], b: T[]): { item: T; kind: ChangeKind; side: "left" | "right" }[] {
     const aKeys = new Map(a.map(x => [JSON.stringify(x), x]));
     const bKeys = new Map(b.map(x => [JSON.stringify(x), x]));
     const out: { item: T; kind: ChangeKind; side: "left" | "right" }[] = [];
     for (const [k, item] of aKeys) {
       out.push({ item, kind: bKeys.has(k) ? "unchanged" : "removed", side: "left" });
     }
     for (const [k, item] of bKeys) {
       if (!aKeys.has(k)) out.push({ item, kind: "added", side: "right" });
     }
     return out;
   }

   function colorFor(kind: ChangeKind) {
     if (kind === "added") return "bg-emerald-500/10 border-emerald-500/30 text-foreground";
     if (kind === "removed") return "bg-destructive/10 border-destructive/30 text-foreground";
     return "bg-card border-border text-muted-foreground";
   }

   function Section<T>({ title, items, render }: { title: string; items: { item: T; kind: ChangeKind }[]; render: (item: T) => string }) {
     if (items.length === 0) {
       return (
         <div className="border border-border rounded p-3">
           <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
           <p className="text-xs text-muted-foreground">No items on either side.</p>
         </div>
       );
     }
     return (
       <div className="border border-border rounded p-3">
         <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
         <ul className="space-y-1.5">
           {items.map((entry, i) => (
             <li key={i} className={`px-2 py-1.5 text-xs border rounded-sm ${colorFor(entry.kind)}`}>
               <span className="text-[10px] uppercase mr-2 font-mono">{entry.kind}</span>
               {render(entry.item)}
             </li>
           ))}
         </ul>
       </div>
     );
   }

   export function ContractDiff({ left, right }: Props) {
     if (!left || !right) {
       return (
         <p className="text-sm text-muted-foreground">
           One or both versions have no contract yet. Generate a contract on each version to see the diff.
         </p>
       );
     }

     const obligationDiff = diffById<ObligationV2>(left.obligations ?? [], right.obligations ?? []);
     const sequenceDiff = diffByJson(left.tool_sequences ?? [], right.tool_sequences ?? []);
     const forbiddenDiff = diffByJson(left.forbidden_behaviors ?? [], right.forbidden_behaviors ?? []);
     const latencyDiff = diffByJson(left.latency_budgets ?? [], right.latency_budgets ?? []);

     return (
       <div className="space-y-4">
         <Section title="Obligations" items={obligationDiff} render={(o) => `${o.text} [${o.failure_category}]`} />
         <Section title="Tool Sequences" items={sequenceDiff} render={(s) => `${s.scenario}: ${s.sequence?.join(" → ")}`} />
         <Section title="Forbidden Behaviors" items={forbiddenDiff} render={(f) => `${f.text} [${f.failure_category}]`} />
         <Section title="Latency Budgets" items={latencyDiff} render={(l) => `${l.scenario}: ${l.max_latency_ms}ms`} />
       </div>
     );
   }

4. Create src/components/diff/EvalDeltaTab.tsx:

   import { useQuery } from "@tanstack/react-query";
   import { api, type AgentVersion, type EvalRun } from "@/lib/api";
   import { Alert, AlertDescription } from "@/components/ui/alert";
   import { AlertCircle } from "lucide-react";

   interface Props {
     left: AgentVersion;
     right: AgentVersion;
   }

   export function EvalDeltaTab({ left, right }: Props) {
     // The backend has no per-version eval-runs listing endpoint.
     // We fetch all runs and filter client-side by agent_version_id.
     const allRunsQ = useQuery({
       queryKey: ['eval-runs', 'all'],
       queryFn: () => api.getEvalRuns(),
     });

     if (allRunsQ.isLoading) return <p className="text-sm text-muted-foreground">Loading eval runs…</p>;
     if (allRunsQ.error) return <p className="text-sm text-destructive">Failed to load eval runs.</p>;

     const all = (allRunsQ.data ?? []) as EvalRun[];
     const latestForVersion = (vid: string): EvalRun | null => {
       const matches = all.filter(r => r.agent_version_id === vid);
       if (matches.length === 0) return null;
       matches.sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
       return matches[0];
     };

     const leftRun = latestForVersion(left.id);
     const rightRun = latestForVersion(right.id);

     function passRate(run: EvalRun | null): string {
       if (!run) return "—";
       // EvalRun in the legacy listing may not include pass/total; fall back to a fetch if needed.
       // For now, render "Open run" link and let the user inspect detail.
       return run.id.slice(0, 10);
     }

     return (
       <div className="space-y-4">
         {(!leftRun || !rightRun) && (
           <Alert>
             <AlertCircle className="w-4 h-4" />
             <AlertDescription>
               {!leftRun && !rightRun
                 ? "Neither version has an eval run yet."
                 : !leftRun
                 ? `v${left.version_number} has no eval run yet.`
                 : `v${right.version_number} has no eval run yet.`}
             </AlertDescription>
           </Alert>
         )}

         <div className="grid grid-cols-2 gap-3">
           <VersionRunCard version={left} run={leftRun} />
           <VersionRunCard version={right} run={rightRun} />
         </div>
       </div>
     );

     function VersionRunCard({ version, run }: { version: AgentVersion; run: EvalRun | null }) {
       return (
         <div className="border border-border rounded p-3 bg-card">
           <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
             v{version.version_number}{version.label ? ` — ${version.label}` : ""}
           </h4>
           {run ? (
             <>
               <p className="text-sm font-semibold text-foreground">Run {run.id.slice(0, 8)}…</p>
               <p className="text-xs text-muted-foreground mt-1">{run.status} · {run.run_type} · {run.started_at}</p>
               <a href={`/eval-runs?selected=${run.id}`} className="text-xs text-primary hover:underline mt-2 inline-block">
                 Open run →
               </a>
             </>
           ) : (
             <p className="text-xs text-muted-foreground">No run.</p>
           )}
         </div>
       );
     }
   }

5. Create src/components/diff/VersionPicker.tsx:

   import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
   import { Button } from "@/components/ui/button";
   import { GitCompare } from "lucide-react";
   import { Link } from "react-router-dom";
   import { AgentVersion } from "@/lib/api";

   interface Props {
     agentId: string;
     currentVersion: AgentVersion;
     allVersions: AgentVersion[];
   }

   export function VersionPicker({ agentId, currentVersion, allVersions }: Props) {
     const others = allVersions.filter(v => v.id !== currentVersion.id);
     return (
       <Popover>
         <PopoverTrigger asChild>
           <Button variant="outline" size="sm" disabled={others.length === 0}>
             <GitCompare className="w-3.5 h-3.5 mr-1" />
             Compare versions
           </Button>
         </PopoverTrigger>
         <PopoverContent className="w-64 p-2">
           <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
             Compare v{currentVersion.version_number} against
           </p>
           {others.length === 0 ? (
             <p className="text-xs text-muted-foreground px-2 py-1">No other versions to compare.</p>
           ) : (
             <ul className="space-y-1">
               {others.map(v => (
                 <li key={v.id}>
                   <Link
                     to={`/agents/${agentId}/versions/${currentVersion.id}/diff/${v.id}`}
                     className="block px-2 py-1.5 text-xs rounded hover:bg-muted"
                   >
                     v{v.version_number}{v.label ? ` — ${v.label}` : ""}
                   </Link>
                 </li>
               ))}
             </ul>
           )}
         </PopoverContent>
       </Popover>
     );
   }

6. Create src/pages/VersionDiff.tsx:

   import { useParams, Link } from "react-router-dom";
   import { useQuery } from "@tanstack/react-query";
   import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
   import { Button } from "@/components/ui/button";
   import { Alert, AlertDescription } from "@/components/ui/alert";
   import { ChevronLeft, AlertCircle } from "lucide-react";
   import { api } from "@/lib/api";
   import { PromptDiff } from "@/components/diff/PromptDiff";
   import { ContractDiff } from "@/components/diff/ContractDiff";
   import { EvalDeltaTab } from "@/components/diff/EvalDeltaTab";

   export default function VersionDiff() {
     const { agentId, versionId, otherVersionId } = useParams();
     if (!agentId || !versionId || !otherVersionId) return null;

     const versionsQ = useQuery({
       queryKey: ['agent', agentId, 'versions'],
       queryFn: () => api.getAgentVersions(agentId),
     });

     const left = versionsQ.data?.find(v => v.id === versionId);
     const right = versionsQ.data?.find(v => v.id === otherVersionId);

     const schemaQ = useQuery({
       queryKey: ['agent', agentId, 'schema'],
       queryFn: () => api.getSchema(agentId),
       enabled: !!agentId,
       retry: false,
     });

     const leftContractQ = useQuery({
       queryKey: ['agent', agentId, 'version', versionId, 'contract-v2'],
       queryFn: () => api.getContractV2(agentId, versionId),
       enabled: !!left,
       retry: false,
     });

     const rightContractQ = useQuery({
       queryKey: ['agent', agentId, 'version', otherVersionId, 'contract-v2'],
       queryFn: () => api.getContractV2(agentId, otherVersionId),
       enabled: !!right,
       retry: false,
     });

     if (versionsQ.isLoading) return <div className="p-6"><p className="text-sm text-muted-foreground">Loading…</p></div>;
     if (!left || !right) {
       return (
         <div className="p-6">
           <Alert variant="destructive">
             <AlertCircle className="w-4 h-4" />
             <AlertDescription>
               One or both versions could not be loaded. <Link to={`/agents/${agentId}`} className="underline">Back to agent</Link>.
             </AlertDescription>
           </Alert>
         </div>
       );
     }

     return (
       <div className="p-6 max-w-6xl mx-auto">
         <Button asChild variant="ghost" size="sm" className="mb-3">
           <Link to={`/agents/${agentId}`}><ChevronLeft className="w-4 h-4" /> Back to agent</Link>
         </Button>
         <h1 className="text-lg font-semibold mb-1">
           Compare v{left.version_number} → v{right.version_number}
         </h1>
         <p className="text-xs text-muted-foreground mb-5">
           Side-by-side diff of prompt, schema, contract, and latest eval results.
         </p>

         <Tabs defaultValue="prompt">
           <TabsList>
             <TabsTrigger value="prompt">Prompt</TabsTrigger>
             <TabsTrigger value="schema">Schema</TabsTrigger>
             <TabsTrigger value="contract">Contract</TabsTrigger>
             <TabsTrigger value="eval">Eval delta</TabsTrigger>
           </TabsList>

           <TabsContent value="prompt" className="mt-4">
             <PromptDiff left={left} right={right} />
           </TabsContent>

           <TabsContent value="schema" className="mt-4">
             <Alert className="mb-3">
               <AlertCircle className="w-4 h-4" />
               <AlertDescription>
                 Schemas are stored per agent (not per version). Both sides show the current agent schema.
               </AlertDescription>
             </Alert>
             {schemaQ.isLoading && <p className="text-sm text-muted-foreground">Loading schema…</p>}
             {schemaQ.data && (
               <pre className="p-3 text-xs font-mono bg-muted/30 border border-border rounded overflow-x-auto">
                 {JSON.stringify(schemaQ.data.schema_json ?? {}, null, 2)}
               </pre>
             )}
             {schemaQ.error && <p className="text-sm text-muted-foreground">No schema yet for this agent.</p>}
           </TabsContent>

           <TabsContent value="contract" className="mt-4">
             {(leftContractQ.isLoading || rightContractQ.isLoading) ? (
               <p className="text-sm text-muted-foreground">Loading contracts…</p>
             ) : (
               <ContractDiff left={leftContractQ.data ?? null} right={rightContractQ.data ?? null} />
             )}
           </TabsContent>

           <TabsContent value="eval" className="mt-4">
             <EvalDeltaTab left={left} right={right} />
           </TabsContent>
         </Tabs>
       </div>
     );
   }

7. In src/App.tsx, add the route inside <Routes>:

   <Route path="/agents/:agentId/versions/:versionId/diff/:otherVersionId" element={<VersionDiff />} />

   Add the import:
   import VersionDiff from "@/pages/VersionDiff";

8. In src/pages/AgentDetail.tsx, add a "Compare versions" button to the agent header:

   import { VersionPicker } from "@/components/diff/VersionPicker";

   In the version header area (search the file for the active version controls — usually a row containing version label, schema button, and run-eval button), insert the picker before or after the existing buttons:

   {activeVersion && versions.length > 1 && (
     <VersionPicker agentId={id!} currentVersion={activeVersion} allVersions={versions} />
   )}

Do not add a top-level sidebar entry for diff — it is always agent-scoped (per spec C.3).
````

### Acceptance criteria

- [ ] `react-diff-viewer-continued` installed; appears in `package.json`
- [ ] Route `/agents/:agentId/versions/:versionId/diff/:otherVersionId` renders the VersionDiff page
- [ ] AgentDetail shows a "Compare versions" button (disabled / hidden when only one version exists); selecting another version navigates to the diff route
- [ ] Prompt tab: side-by-side word-level diff of `system_prompt` with version labels in headers
- [ ] Schema tab: alert explains schema is agent-scoped; the same JSON renders below
- [ ] Contract tab: 4 sub-sections (Obligations / Tool Sequences / Forbidden Behaviors / Latency Budgets), each item color-coded added (green) / removed (red) / unchanged (muted); empty sections render an explanatory line
- [ ] Eval delta tab: two cards side-by-side; if either version has no run, an alert appears; "Open run →" link navigates to `/eval-runs?selected={runId}`
- [ ] When one or both versions cannot be loaded, the page shows a destructive alert with a back link
- [ ] No top-level sidebar entry was added
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase C.3: VersionDiff page (Prompt/Schema/Contract/Eval delta)"
```

---

## Task 4: C.4 — `no_progress[]` rendering (scaffold + backend ask)

The regression dashboard already conditionally renders rows from `result.no_progress[]` if present (existing code). The backend does **not** return that array yet — only `summary.no_progress_count`. This task tightens the render path, ensures the empty-array state is friendly, and documents the backend ask. **No backend change ships in this plan.**

**Files:**
- Modify: `src/pages/RegressionDashboard.tsx` — replace the existing inline NO CHANGE block with a `NoProgressSection` component that handles both states (count-only vs count + array)
- Create: `src/components/regression/NoProgressSection.tsx`
- Modify: `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` — confirm §5.4 backend-ask row is up-to-date (no edit needed if the row is already there; verify only)

### Lovable prompt

````
Tighten the NO CHANGE swim lane on the regression dashboard so it reads cleanly whether the backend returns the no_progress[] array or not.

1. Create src/components/regression/NoProgressSection.tsx:

   import { X, AlertCircle } from "lucide-react";
   import { NoProgressItem, RegressionType } from "@/lib/types";
   import { RegressionTypeBadge } from "./RegressionTypeBadge";

   interface Props {
     count: number;
     items?: NoProgressItem[];
     active: Set<RegressionType>;
   }

   export function NoProgressSection({ count, items, active }: Props) {
     if (!active.has("NO_PROGRESS") || count === 0) return null;

     return (
       <div className="bg-card border border-border rounded border-l-2 border-l-amber-500 p-4">
         <h3 className="text-sm font-semibold text-amber-500 mb-3 flex items-center gap-2">
           NO CHANGE — {count} cases still failing
           <RegressionTypeBadge type="NO_PROGRESS" />
         </h3>

         {items && items.length > 0 ? (
           <div className="space-y-1.5">
             {items.map(np => (
               <div key={np.test_case_id} className="flex items-center gap-2 text-sm text-foreground">
                 <X className="w-3.5 h-3.5 text-amber-500" />
                 {np.scenario}
               </div>
             ))}
           </div>
         ) : (
           <div className="flex items-start gap-2 px-3 py-2 text-xs bg-amber-500/5 border border-amber-500/20 rounded text-muted-foreground">
             <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
             <span>
               The backend reports {count} case(s) with no progress, but the per-case list is not yet returned.
               Expand here once <code className="text-[11px]">no_progress[]</code> lands on the regression API.
             </span>
           </div>
         )}
       </div>
     );
   }

2. In src/pages/RegressionDashboard.tsx, replace the existing NO CHANGE block (currently lines ~376-392, the `{result.summary.no_progress_count > 0 && (...)}` div with the inner `result.no_progress?.map(...)` block) with a single call:

   import { NoProgressSection } from "@/components/regression/NoProgressSection";

   <NoProgressSection
     count={result.summary.no_progress_count}
     items={result.no_progress}
     active={activeFilters}
   />

   This component handles its own visibility (filter membership AND non-zero count), so the inline `activeFilters.has("NO_PROGRESS") && ...` guard around it is not needed. Delete that wrapper if you added it in Task 1; the component now owns it.

3. Verify the spec backend-ask doc still lists C.4 as a backend ask:

   Open docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md, scroll to §5.4 ("Backend asks (consolidated, by priority)"), and confirm the C.4 row reads:

   | C.4 | `no_progress[]` array | Extend `routers/regression_v2.py` response to include `no_progress: RegressionItem[]` | **BLOCKED.** Section ships when backend lands. |

   If the row is already there (it should be), do not edit. If it is missing, add it.
````

### Acceptance criteria

- [ ] `NoProgressSection` exists at `src/components/regression/NoProgressSection.tsx`
- [ ] When `summary.no_progress_count > 0` AND backend has not yet returned the array: section renders the count + an amber "no per-case list yet" note explaining the missing field
- [ ] When `summary.no_progress_count > 0` AND backend returns the array: section renders the count + each scenario row
- [ ] When `summary.no_progress_count === 0`: section is hidden
- [ ] When the NO_PROGRESS filter chip is off: section is hidden regardless of count
- [ ] Spec §5.4 still lists the backend ask as **BLOCKED** with the exact endpoint reference
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase C.4: NoProgressSection scaffold (backend array still pending)"
```

---

## End-of-phase smoke test

Run all of these in the browser before declaring Phase C complete:

1. **Regression dashboard — typed flow:** Pick an agent + two versions, run regression. PASSED case shows the green banner; BLOCKED case shows the destructive banner. Both render the same shape.
2. **Regression dashboard — badges:** Each per-row scenario in BROKE / IMPROVED / NO CHANGE sections shows a colored regression-type badge.
3. **Regression dashboard — filters:** Toggle any chip → its section hides; toggle all four off → all four come back on (no zero state).
4. **Regression dashboard — friendly errors:** Picking the same baseline + challenger surfaces the inline error; missing locked cases surfaces its inline error.
5. **Test case list — obligations column:** On an agent with a contract, each row shows up to 3 obligation badges resolved to obligation text. Hovering a badge shows the full text.
6. **Test case list — obligation filter:** Open the obligations popover, pick one or more obligations → the list narrows to test cases whose `obligation_ids` intersect the selection.
7. **Test case detail — covers obligations:** "Covers Obligations" section lists each obligation with a category badge. Clicking one navigates to `/agents/{agentId}#obligation-{oid}` and AgentDetail scrolls to the obligation row.
8. **AgentDetail — compare versions:** When ≥ 2 versions exist, the "Compare versions" button appears in the header. Selecting another version navigates to the diff route.
9. **VersionDiff — Prompt tab:** Side-by-side word-level diff renders with version labels.
10. **VersionDiff — Schema tab:** Note about agent-scoped schema visible; JSON below.
11. **VersionDiff — Contract tab:** Four sub-sections render with added/removed/unchanged colors. Empty sections render the explanatory line.
12. **VersionDiff — Eval delta:** Both run cards render; missing-run alert appears when either version has no run; "Open run →" link navigates to that run's detail view via `?selected=`.
13. **NO CHANGE section:** When `no_progress_count > 0`, the amber section appears with the "no per-case list yet" note (until backend lands).
14. **No regressions:** AgentList, AgentDetail (other panels), AgentUpload, TestCaseAgentList (sort/lock controls), TestCaseDetail (lock controls), EvalRunHistory (Phase B work) all still load without console errors.
15. **Build:** `npm run build` exits 0 with no TypeScript errors.

## Phase C blockers (carried to follow-up)

- **C.4 `no_progress[]` array:** `routers/regression_v2.py:229-237` does not return the per-case array yet. Frontend ships scaffold; rows render once backend lands the field. Documented in spec §5.4.

---

## Design review (2026-04-18, text-only — mockups skipped)

Full review: `docs/superpowers/reviews/2026-04-18-plan-design-review.md`. Pre-ship edits affecting this plan:

- **Task 1 (`RegressionTypeBadge`, Findings 4.1 + 5.2 + 6.3):**
  - Map 4 regression types to shadcn semantic tokens, not raw colors: STABLE=`muted`, REGRESSION=`destructive`, IMPROVEMENT=`primary`/success, NO_PROGRESS=`secondary`/amber.
  - Filter chips keyboard + ARIA: Tab focuses each, Space/Enter toggles, `role="button" aria-pressed={active}`.
- **Task 3 (`VersionDiff`, Findings 3.3 + 6.1 + Q3):**
  - Add 3-line summary strip above tabs (prompt delta, contract delta, eval pass-rate delta).
  - Minimum viable width 1024px. Below: single-screen fallback message, don't break layout.
  - Support `?tab=prompt|schema|contract|eval` URL param override; default stays `eval`.
- **Task 4 (`no_progress` scaffold, Finding Q7):** Ship feature-flagged OFF entirely until backend lands the per-case array. No visible "coming soon" empty state. Remove the amber section from end-of-phase smoke item #13 until the flag is on.

Parent-spec §1 design-token additions must land before these.
