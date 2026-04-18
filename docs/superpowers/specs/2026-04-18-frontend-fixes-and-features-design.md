# Frontend Fixes and Features — Design Spec

**Date:** 2026-04-18 (regenerated against backend `v2-behavioral-contracts` branch)
**Author:** vineet@digitalgreen.org (with Claude)
**Repo:** `agent-contract-studio` (Lovable-built React + Vite + TS frontend)
**Backend reference:** `agentops-backend` on branch `v2-behavioral-contracts` — this doc is frontend-only but every endpoint/shape below is verified against the backend on that branch.

---

## Goal

Close the gap between what the AgentOps backend exposes on `v2-behavioral-contracts` and what the frontend renders, while cleaning up dead code and fixing two outstanding bugs. Ship in three phases mapped to user journeys: **Author → Run & Evaluate → Compare & Ship**. Each phase is a self-contained Lovable hand-off.

## Non-goals

Auth, theming, i18n, analytics, full mobile responsive overhaul, real-time updates (WebSockets/SSE), bulk version ops, N-version (>2) comparison, observability dashboards. See §5.6.

---

## 1 — Architecture & Conventions

**Stack (keep):** React + Vite + TS + Tailwind + shadcn-ui + React Query + React Router. Pages in `src/pages/`, shared UI in `src/components/`, API in `src/lib/api.ts`, types in `src/lib/types.ts` (created by Plan A Task 1).

**Conventions for all new work:**

1. **API layer.** Every new endpoint gets a wrapper in `src/lib/api.ts`; no inline `fetch` in components. Wrappers throw `ApiError` (`{status, message, body?}`) on non-2xx; pages catch via React Query `error`.
2. **Types.** Every new response shape gets a TS type in `src/lib/types.ts`. No `any` in new code; if backend shape is uncertain, type as `unknown` and narrow at the boundary.
3. **React Query keys.** Namespaced and stable: `['agent', id]`, `['agent', id, 'version', vid, 'contract']`, `['agent', id, 'schema']`, `['eval-run', runId]`, `['agent', id, 'version', vid, 'eval-runs']`. Mutations call `queryClient.invalidateQueries({queryKey: [...]})` on success.
4. **Loading/error states.** `<Skeleton />` while loading; `<Alert variant="destructive">` on error with the error message and a retry button. Inline mutations show button spinner + disabled state; rest of page interactive.
5. **Empty states.** Every list/detail uses an `EmptyState` component (icon + title + 1-line description + optional CTA). Add to `src/components/` if not present.
6. **Toast feedback.** Every mutation fires a toast (`useToast`) on success and on error. On error, keep the form/dialog open.
7. **Blocked-on-backend.** Listed inline per phase with the exact request/response shape expected. Phase ships only when backend lands. **No mock data shims.**
8. **Routing.** Flat URL scheme. New screens get top-level routes (`/agents/:id/versions/:vid/schema`, `/agents/:id/versions/:vid/diff/:otherVid`).
9. **No V1 dead code.** When a page is rewritten to V2, V1 wrappers in `api.ts` are deleted in the same hand-off.
10. **404 from per-version fetches** → "This version no longer exists" empty state with link back to agent detail. No hard redirect.

### 1.1 — Design tokens (added by 2026-04-18 design review)

Live-code conventions — all new components must follow these:

- **Type scale:** `text-[13px]` body, `text-[11px]` meta, `text-[10px]` micro labels. Never `text-sm`/`text-xs`.
- **Colors:** shadcn semantic tokens only (`primary`, `muted`, `destructive`, `secondary`, `foreground`, `background`, `border`, `ring`). Never raw Tailwind colors (`bg-purple-500`, `text-blue-600`).
- **Card styling:** `rounded-md` (not `rounded-lg`), `border` (1px), `p-3` to `p-4` (not `p-6`), no shadow unless hover-elevated.
- **Spacing:** 3/4 (12/16px) dominant. Avoid 6/8 (24/32px).
- **Borders:** 1px default. Only 2px for the active sidebar left-border accent.
- **Button label case:** sentence case, not title case ("Regenerate contract", not "Regenerate Contract").
- **Icon-only buttons:** `aria-label="{action verb}"` required.

### 1.2 — Badge convention (added by 2026-04-18 design review)

Cap total distinct badge styles at 5:

- **Neutral-info** (category labels, source, obligation tags): `variant="secondary"` + `text-[10px]` + `font-normal`.
- **Status-success** (STABLE, passed): `variant="outline"` with success color.
- **Status-warning** (NO_PROGRESS, medium risk): `variant="outline"` with amber/warning color.
- **Status-danger** (REGRESSION, failed, high risk): `variant="destructive"`.
- **Status-positive-action** (IMPROVEMENT): `variant="outline"` with `text-primary`.

### 1.3 — Empty state icon registry (added by 2026-04-18 design review)

- Schema → `FileJson`
- Contract → `FileText`
- Test cases → `ListChecks`
- Eval runs → `Activity`
- Suggestions → `Lightbulb`
- Version diff → `GitCompare`
- Regressions → `Target`

---

## 2 — Phase A: Author

**Goal:** complete the agent-authoring flow — schema, contract surface, regenerate, and AI-driven test-case generation with user-controlled count.

### A.1 — Cleanup prelude (D-13, D-14a)

- **Delete** `src/pages/TestCaseList.tsx` (unreferenced). Remove its route from `App.tsx` if present.
- **Delete** any V1 test-case wrappers in `api.ts` that become unreferenced after this change.
- **Add to `AppSidebar.tsx`:** "Test Cases" entry → `/test-cases`. The route already maps to `TestCaseAgentList.tsx` in `App.tsx`.
- **Foundational pieces** (used by all later tasks): create `src/lib/types.ts`, create `src/components/EmptyState.tsx`, replace the existing `request<T>` in `api.ts` to throw a typed `ApiError`.

### A.2 — Schema viewer (read-only)

**New page:** `src/pages/AgentSchema.tsx`
**Route:** `/agents/:agentId/versions/:versionId/schema`
**Entry point:** new "Schema" button on `AgentDetail.tsx` for the active version (placed beside the existing version selector).

**Components:**
- `SchemaPanel` (new, `src/components/schema/`)
  - Props: `agentId: string`, `versionId: string`
  - On mount: `useQuery(['agent', agentId, 'schema'], () => api.getSchema(agentId))`
  - Schema missing (404) → empty state with "Extract schema from this version" CTA → `POST /agents/{id}/schema/extract?version_id={vid}`
  - View mode: read-only syntax-highlighted JSON (shadcn `<ScrollArea>` + `<pre><code>`)
  - Header badges: `human_edited` (if true → "Edited by human"); `extracted_from_version_id` (if differs from current version → "Extracted from v{n}")
  - **Edit mode:** disabled with tooltip "Editing requires backend PATCH endpoint — coming soon."

**Backend reality (verified on branch):**
- `GET /agents/{id}/schema` → `AgentSchema {id, agent_id, schema_json: dict, extracted_from_version_id: string, human_edited: bool, created_at: string}`. Note: `created_at`, **not `updated_at`**. `extracted_from_version_id` is non-nullable (always set on extract).
- `POST /agents/{id}/schema/extract?version_id={vid}` → returns same `AgentSchema`. If `version_id` omitted, backend uses the latest version.
- **No `PATCH` endpoint exists.** Schema editing is BLOCKED on backend (see §5.4).

**API wrappers (in `api.ts`):**
- `getSchema(agentId)` → `GET /agents/{id}/schema`
- `extractSchema(agentId, versionId?)` → `POST /agents/{id}/schema/extract?version_id={vid}` (versionId optional; backend defaults to latest)

### A.3 — Contract V2 surface

**File:** `src/pages/AgentDetail.tsx` — replace the existing contract rendering (block currently around lines 534-577 that uses the legacy `Contract` type) with `<ContractPanel />`.

**Components:**
- `ContractPanel` (new, `src/components/contract/ContractPanel.tsx`)
  - Props: `agentId`, `versionId`, `contract: ContractV2 | null`
  - Renders 4 sub-sections in shadcn `<Card>`s, in this order:
    1. **Obligations** — each obligation: `text` (font-medium), `<Badge variant="outline">{failure_category}</Badge>`, `<Badge variant="secondary">source: {source}</Badge>`. Each row gets `id={\`obligation-${o.id}\`}` for deep-link scrolling from test case detail (Phase C.2).
    2. **Tool Sequences** — each sequence: `scenario` (font-medium), then the `sequence` array rendered as `tool1 → tool2 → tool3` with each name in a `<Badge variant="secondary">`. `failure_category` badge on the right.
    3. **Forbidden Behaviors** — each: `<Badge variant="destructive">{text}</Badge>` with `failure_category` badge on the right.
    4. **Latency Budgets** — `<Table>` with columns: Scenario | Max latency (ms) | Failure category.
  - Each sub-section: empty state if array is empty.

**Backend reality (verified on branch — `routers/contracts_v2.py` + `services/contract_generator.py`):**

Response from `GET /agents/{id}/versions/{vid}/contract`:

```json
{
  "id": "uuid",
  "agent_id": "uuid",
  "agent_version_id": "uuid",
  "obligations": [
    {"id": "obl_1", "text": "...", "source": "goal|behavioral|desired_behavior", "failure_category": "TOOL_TRIGGER|..."}
  ],
  "tool_sequences": [
    {"scenario": "...", "sequence": ["tool1", "tool2"], "failure_category": "PROCESS_SEQUENCE"}
  ],
  "forbidden_behaviors": [
    {"text": "...", "failure_category": "HALLUCINATION_GUARD|TOOL_OVERUSE"}
  ],
  "latency_budgets": [
    {"scenario": "...", "max_latency_ms": 8000, "failure_category": "LATENCY"}
  ],
  "created_at": "iso8601"
}
```

Notes: only obligations have `id`; tool sequences, forbidden behaviors, latency budgets have no id and must be keyed by index.

`failure_category` taxonomy (11 values from `services/failure_taxonomy.py`):
`COMMUNICATE_TOOL_DATA`, `INPUT_EXTRACTION`, `TOOL_TRIGGER`, `TOOL_OVERUSE`, `TOOL_ERROR_HANDLING`, `HALLUCINATION_GUARD`, `ESCALATION`, `GOAL_COMPLETION`, `PROCESS_SEQUENCE`, `LATENCY`, `REASONING_QUALITY`. Treat as open enum (`| string`) so backend additions don't break the build.

**Types (in `types.ts`):** `ContractV2`, `ToolSequence`, `ForbiddenBehavior`, `LatencyBudget`, `ObligationV2`, `FailureCategory`.

**API wrapper:** `getContractV2(agentId, versionId)` → `GET /agents/{id}/versions/{vid}/contract`. Already exists (typed `any`); replace with typed version returning `ContractV2`.

### A.4 — Regenerate contract

**File:** `src/pages/AgentDetail.tsx` (or `ContractPanel.tsx` after extract).

- The existing "Generate Contract" button MUST NOT be permanently disabled once a contract exists. When `contract != null`, label becomes "Regenerate Contract" and opens a confirmation dialog.
- New `RegenerateContractDialog` (shadcn `<AlertDialog>`):
  - Body warns existing test cases may need re-evaluation; locked test cases stay locked but pass/fail can change.
  - Confirm: `POST /agents/{id}/versions/{vid}/contract/generate`, invalidate `['agent', id, 'version', vid, 'contract']`, toast success.
  - Backend uses the same endpoint for initial generate and regenerate (idempotent UPSERT in `routers/contracts_v2.py`).

**Pre-condition:** A schema must exist; otherwise the endpoint returns 404 with `"Extract schema first before generating contract"`. The dialog should detect that error, close, and show a toast pointing to the Schema tab.

**API wrapper:** `regenerateContract(agentId, versionId)` (same POST as initial generate; distinct name for clarity at call sites).

### A.5 — Configure & generate test cases (re-scoped from manual creation)

**Backend reality:** there is NO manual test-case creation endpoint on `v2-behavioral-contracts`. Only `POST /agents/{id}/versions/{vid}/test-cases/generate?count={n}` exists, which **deletes all existing test cases for the version and replaces them** with AI-generated ones. The `count` query param is `1..20`, default `15`. A contract must exist (404 otherwise).

**Re-scope:** instead of a manual form, surface a "Configure & generate" experience that gives the user control over the AI-driven generation.

**New page:** `src/pages/TestCaseGenerate.tsx`
**Route:** `/agents/:agentId/versions/:versionId/test-cases/generate`
**Entry point:** "Generate test cases" button on `TestCaseAgentList.tsx` header. (The previous "Generate" button on that page that fires an immediate POST is replaced with a link to this configure page. If the page is reached and there are existing test cases, the form is pre-warned.)

**Components:**
- `TestCaseGenerateForm` (new, `src/components/test-cases/`)
  - Props: `agentId`, `versionId`
  - Fields:
    - `count: number` — slider or number input, range 1-20, default 15. Helper text: "How many test cases to generate. Backend cap is 20."
  - Above the form, fetch the contract via `getContractV2`. If contract is missing, show an alert: "No contract found for this version. Generate a contract first." with a link to `AgentDetail`. Submit button disabled.
  - Above the form, fetch existing test-case count via `getTestCasesV2`. If count > 0, render an `<Alert variant="destructive">`: "Generating will delete the {n} existing test case(s) for this version and replace them. This cannot be undone."
  - Submit button: "Generate {count} test cases". On submit:
    - `POST /agents/{id}/versions/{vid}/test-cases/generate?count={count}`
    - On success: invalidate `['agent', agentId, 'version', versionId, 'test-cases']`, toast `"Generated {response.count} test cases"`, navigate back to the list.
    - On error: toast destructive with the API error message; keep the page open.
  - Long-running mutation (~10-30s for AI generation): button shows "Generating…" + disabled; rest of page interactive.

**API wrappers:**
- `generateTestCasesV2(agentId, versionId, count)` — replace existing version that ignores count. Add `?count={n}` to the URL.
- `getTestCasesV2(agentId, versionId)` — already exists (typed `any[]`); replace return with `TestCaseV2[]`.

**Backend response shape (verified):**

```json
{
  "count": 15,
  "version_id": "uuid",
  "contract_id": "uuid",
  "test_cases": [
    {"id": "uuid", "scenario": "...", "input_text": "...", "obligation_ids": ["obl_1"], "tags": ["..."], "assertions": [...], "tool_stubs": {...}}
  ]
}
```

`TestCaseV2` list (from `GET /agents/{id}/versions/{vid}/test-cases`):

```json
{
  "id": "uuid",
  "agent_id": "uuid",
  "agent_version_id": "uuid",
  "contract_id": "uuid",
  "scenario": "string",
  "input_text": "string",
  "tool_stubs": {"tool_name": {"response": {}, "latency_ms": 0, "simulate_failure": false}},
  "assertions": [{"id": "...", "type": "...", "tool": "...", "param": "...", "value": "...", "required": true}],
  "obligation_ids": ["obl_1"],
  "tags": ["..."],
  "locked": false,
  "locked_at_pass": null,
  "locked_at_version_id": null,
  "created_at": "iso8601"
}
```

There is **no `expected_output` field** anywhere — assertions carry the expected behavior. The schema may include `output_contains` assertions whose `value` field is the expected text.

### Phase A blockers

- **A.2 schema edit mode:** backend has no `PATCH /agents/{id}/schema`. Edit mode ships disabled with tooltip; full edit shipped in a follow-up plan once backend lands.

### Phase A smoke test

1. Open an existing agent → click "Schema" → schema renders (view mode).
2. New agent without schema → "Extract schema" CTA → schema appears.
3. Contract panel renders all 4 sub-sections with the verified field shapes (text, source, sequence, max_latency_ms).
4. "Regenerate Contract" → dialog → confirm → contract refreshes.
5. "Generate test cases" → configure page → adjust count → submit → list shows the generated cases (existing ones replaced).
6. Sidebar "Test Cases" entry navigates to `/test-cases`.

---

## 3 — Phase B: Run & Evaluate

**Goal:** complete the eval-running surface — informational results, real summary card, deep-mode improvements, cross-version eval. Fix the two outstanding bugs (suggestions fast-path, suggestion field-name mismatch).

### B.1 — Cleanup prelude (D-15, D-16, D-14b)

**`src/lib/api.ts` — `applySuggestions` (D-15):**
- New signature: `applySuggestions(agentId, versionId, body: {accepted_fix_ids, eval_run_id, label?, accepted_patches?})`.
- **Both `accepted_fix_ids` AND `accepted_patches` are sent on the fast path.** `accepted_fix_ids` selects which fixes to apply (always required). `accepted_patches: {fix_id: prompt_patch_string}` is the fast-path map that lets the backend skip re-running the suggester. Backend reference: `routers/improvements.py:118-128`.

**`src/pages/AgentDetail.tsx` improvements panel (D-16):**
- Suggestion fields returned by backend (verified from `services/improvement_suggester.py:270-286` and `routers/improvements.py` passthrough):

  ```json
  {
    "id": "fix_1",
    "failure_pattern": "string",
    "description": "string",
    "schema_change": {"field": "...", "operation": "add|update|remove", "value": "..."},
    "prompt_patch": "string",
    "fixes_watching": ["scenario_1", "scenario_2"],
    "must_hold_risk": "None|Low|Medium",
    "confidence": 0.0
  }
  ```

  Note: the router docstring at `routers/improvements.py:6` refers to `affects_cases`, but the actual passthrough returns `fixes_watching`. The router docstring is stale — trust the LLM template at `services/improvement_suggester.py:281`.

- Reader rename: drop the `any` typing; use `Suggestion[]`. Read `s.failure_pattern` and `s.fixes_watching` (rename any references to `pattern`/`affected_cases`).

**`src/components/AppSidebar.tsx` (D-14b):**
- Add "Eval Runs" entry → `/eval-runs`.

### B.2 — Informational results in eval run detail

**File:** `src/pages/EvalRunHistory.tsx` (current code splits results into `deterministic` and `semantic` only).

- Split results into 3 buckets: `deterministic`, `semantic`, `informational`.
- Add a third `<Card>` "Latency Budget" rendering informational rows. Per row: scenario (truncated), measured `latency_ms`, the `passed` flag rendered as a within-budget badge (green ✓ / amber ✗). The reason field carries human-readable budget context.
- If `informational` array is empty: hide the card (informational is optional, no empty state).

**Backend reality:** `EvalResult.result_type` is a free-form string; common values are `"deterministic"`, `"semantic"`, `"informational"`. Informational results are produced for `max_latency_ms` assertions and have `passed = within_budget`. They carry `latency_ms` per row. Backend excludes informational from pass/fail counts in the V2 POST summary (`routers/eval_runs_v2.py:128-133`).

**Types:** extend `EvalResult` with `result_type: "deterministic" | "semantic" | "informational" | string` and confirm `latency_ms: number`.

### B.3 — Eval run summary card

**File:** `src/pages/EvalRunHistory.tsx`.

- Replace the existing client-side recomputation (counting passes from results, computing pass rate) with reads from the backend `summary` already returned in the GET detail response.
- New `EvalRunSummaryCard` (`src/components/eval/`):
  - Props: `summary: EvalRunSummary`, `results: EvalResult[]`
  - Tiles (4-6 in a grid): Total | Passed | Failed | Pass rate | (if any informational results) Within latency budget | Over latency budget.
  - Pass rate display: `{Math.round(passed/total * 100)}%` if `total > 0` else `—`. Latency tile counts derived from `results.filter(r => r.result_type === "informational")`.

**Backend reality (verified on branch):**
- `GET /eval-runs/{run_id}` (legacy router; mounted by `routers/runs.py:270`) returns `{eval_run, summary, results}` where `summary = {total, passed, failed, deterministic: {total, passed}, semantic: {total, passed}}`. **No `pass_rate` in this response and no `latency` budget breakdown — both are derived on the frontend from `results`.**
- `POST /agents/{id}/versions/{vid}/eval-runs` (V2 router) writes a richer `summary_json` to the DB (`{total, passed, failed, pass_rate (int 0-100), avg_latency_ms, latency: {within_budget, over_budget}}`) but the GET handler does **not** read it.

**Decision:** ship B.3 without a backend ask. Compute `pass_rate` and `latency` counts in the card from the data already returned. (Backend ask to surface stored `summary_json` from the GET handler is a future cleanup, not a Phase B blocker.)

**Types:** `EvalRunSummary { total: number; passed: number; failed: number; deterministic?: {total, passed}; semantic?: {total, passed} }`.

### B.4 — Deep mode toggle on improvements panel

**File:** `src/pages/AgentDetail.tsx` — improvements panel.

- Add shadcn `<Tabs>` at the top: "Standard" (default) | "Deep".
- Pass mode through to API: `getSuggestions(agentId, versionId, evalRunId, mode)` → `POST /agents/{id}/versions/{vid}/improvements?eval_run_id=xxx&mode=standard|deep`.
- Deep mode: inline note "Runs dual-model A/B critique-refine — takes ~30-60s longer."
- Deep mode loading: button shows "Running deep analysis…" + disabled; toast on completion.

**Backend response:** `{suggestions: Suggestion[], mode: "standard" | "deep"}` — `mode` is echoed so the panel can confirm what was actually run.

**API wrapper:** update `getSuggestions` to accept `mode` parameter; default `'standard'`.

### B.5 — Cross-version eval

**Goal:** run version B's prompt against test cases authored on version A.

**Entry point:** "New Eval Run" button opens a dialog (instead of immediate POST). Place on `EvalRunHistory.tsx` and `AgentDetail.tsx` if applicable.

**Components:**
- `NewEvalRunDialog` (shadcn `<Dialog>`):
  - Fields:
    - `test_case_source_version_id`: shadcn `<Select>` listing all versions of the agent (default: target `versionId`)
    - When `source !== target`: inline note "Cross-version eval — running v{target} against test cases from v{source}"
  - Submit: `POST /agents/{id}/versions/{vid}/eval-runs` body `{run_type: "full", test_case_source_version_id}`
  - Response: `{eval_run: {id, agent_id, agent_version_id, run_type, status, started_at, completed_at}, summary: {...}}`. Navigate to `/eval-runs?selected=${response.eval_run.id}` on success.

**Backend reality (verified):** `CreateEvalRunRequest` accepts `{run_type: "full", test_case_source_version_id?: string}` (`routers/eval_runs_v2.py:15-18`). The endpoint synchronously runs the eval (no background job) and returns the wrapper above. Frontend should wait for the response (long mutation, show "Running eval…" state).

**API wrapper:** new `createEvalRun(agentId, versionId, {test_case_source_version_id?})`. Existing `runEvalV2` (without body) can be removed once all call sites migrate.

**Listing change:** the legacy `EvalRun` model surfaced by `GET /eval-runs` does not include `test_case_source_version_id` (see `models.py:80-86`). To badge cross-version runs, the frontend must fetch detail per row, OR the backend must extend the legacy listing. **Decision:** ship B.5 with the dialog but skip the badge column for now — file as an unblocker for a follow-up. Document in §5.4.

### Phase B blockers

- **B.5 cross-version badge in list:** legacy `GET /eval-runs` doesn't return `test_case_source_version_id`. Dialog ships; badge ships when backend adds the field.

### Phase B smoke test

1. Sidebar "Eval Runs" → list opens.
2. Open an eval run with informational results → 3 sections render correctly.
3. Summary tiles read from the backend summary; pass rate and latency tiles correct.
4. Improvements panel: Standard mode runs as before with verified field names; Deep mode runs with the longer-loading state.
5. New eval run dialog: same-version eval works; cross-version eval shows the inline note.
6. Apply suggestions: confirm both `accepted_fix_ids` and `accepted_patches` are in the POST body (network tab).

---

## 4 — Phase C: Compare & Ship

**Goal:** complete the comparison surface — regression depth, version diff, obligation linkage, no-progress rendering when backend lands.

### C.1 — Regression type per result

**File:** `src/pages/RegressionDashboard.tsx`.

- Each result row gets a `<Badge>` for `regression_type`:
  - `STABLE` → secondary, no icon
  - `REGRESSION` → destructive, ⬇
  - `IMPROVEMENT` → success/green, ⬆
  - `NO_PROGRESS` → amber/warning, ⊘
- Filter chip row above the results to filter by `regression_type` (multi-select; default all).
- Per-section counts at top reflect filter selection.

**Backend reality (verified — `routers/regression_v2.py`):**

When the regression run **passes**, response is:

```json
{
  "status": "PASSED",
  "run_id": "...",
  "challenger_version_id": "...",
  "baseline_version_id": "...",
  "summary": {"locked_cases_total": 10, "stable_count": 8, "regression_count": 0, "improvement_count": 2, "no_progress_count": 0},
  "regressions": [],
  "improvements": [{"test_case_id": "...", "scenario": "..."}]
}
```

When **blocked**, the response above is wrapped in `HTTPException(422, detail=response)` — i.e., the frontend receives HTTP 422 with the JSON in the error body. **The frontend must catch 422 and unwrap `error.body.detail` to render the dashboard.**

Per-test-case `regression_type` is also stored on `eval_results.regression_type`. The legacy `/eval-runs/{run_id}` GET does not currently include this field on each result — confirm via network call before relying on it. If absent, the dashboard derives the visual badge from which array (`regressions` vs `improvements`) the row came from.

**Types:** add `RegressionType = "STABLE" | "REGRESSION" | "IMPROVEMENT" | "NO_PROGRESS"`. Add `RegressionRunResponse { status, run_id, challenger_version_id, baseline_version_id, summary, regressions: RegressionItem[], improvements: ImprovementItem[] }`.

`RegressionItem`: `{test_case_id, scenario, failed_assertions: [{assertion_id, reason}]}`. `ImprovementItem`: `{test_case_id, scenario}`.

### C.2 — Test-case ↔ obligation linkage

**Files:** `src/pages/TestCaseAgentList.tsx`, `src/pages/TestCaseDetail.tsx`.

**List:**
- Add "Obligations" column rendering each `obligation_id` as a `<Badge>` resolved to obligation `text` via the contract fetch (already on the page); fallback to id if not found.
- Add an "Obligation" multi-select filter (popover with checkboxes) to the existing filter bar.

**Detail:**
- New "Covers Obligations" section listing each obligation by `text` + `failure_category` badge.
- Each obligation links to its anchor in the contract panel on `AgentDetail.tsx` (`#obligation-${id}`) — anchor was added in Phase A.3.

**Backend:** no change. `TestCaseV2` already includes `obligation_ids: string[]`.

### C.3 — Version diff view + sidebar entry (D-14c re-scoped)

**New page:** `src/pages/VersionDiff.tsx`
**Route:** `/agents/:agentId/versions/:versionId/diff/:otherVersionId`
**Entry points:**
- `AgentDetail.tsx`: "Compare versions" button in the agent header. Popover lists other versions; selecting one navigates to the diff route.
- `AppSidebar.tsx`: do **not** add a top-level entry — diff is always agent-scoped.

**Components:**
- `VersionDiff` page composed of 4 tabbed panels (shadcn `<Tabs>`):
  1. **Prompt** — side-by-side text diff using `react-diff-viewer-continued` over `version.system_prompt`.
  2. **Schema** — schema is currently agent-scoped on the backend (single `agent_schemas` row per agent). Show the same schema on both sides with an explanatory note.
  3. **Contract** — sub-sections (Obligations / Tool Sequences / Forbidden Behaviors / Latency Budgets), each with added/removed/unchanged items color-coded. Items keyed by `id` for obligations, by `JSON.stringify(item)` for the others (no id available).
  4. **Eval delta** — pass-rate side-by-side from each version's latest eval run; alert if either version has no run.

**API wrappers:**
- Reuse existing `getAgentVersions`, `getSchema`, `getContractV2`.
- Eval delta tab: there is no per-version eval-runs listing endpoint on the backend (verified — `routers/eval_runs_v2.py` exposes only POST). The frontend must fetch all eval runs via `getEvalRuns()` and filter client-side by `agent_version_id`. Document this filter approach.

### C.4 — `no_progress[]` rendering

**File:** `src/pages/RegressionDashboard.tsx`.

**🚧 BLOCKED on backend.** `routers/regression_v2.py:229-237` returns `regressions[]` and `improvements[]` only. The summary includes `no_progress_count` but there is no `no_progress: RegressionItem[]` array.

**Backend ask:** extend the regression response to include a `no_progress: RegressionItem[]` array (same shape as `regressions[]`).

**Frontend change once unblocked:** third "No Progress" section beside Regressions and Improvements; same card layout, amber accent. Filter chip from C.1 applies.

**Ships only when backend lands. No mock shim.**

### Phase C smoke test

1. Regression dashboard: each row has a regression-type badge; filters work; counts update with filter; 422 responses are caught and rendered.
2. Test case list: obligations column shows badges; obligation filter narrows the list.
3. Test case detail: "Covers Obligations" section renders; clicking an obligation navigates to its anchor in the contract panel.
4. Agent detail header: "Compare versions" → popover → diff route opens.
5. Version diff: all 4 tabs render correctly; eval delta tab shows alert when one version has no eval run.
6. (Once backend lands) Regression dashboard shows the third "No Progress" section.

---

## 5 — Cross-Cutting Concerns

### 5.1 — Error handling

- All API wrappers throw `ApiError` (`{status, message, body?}`). Define in `api.ts` (Plan A Task 1).
- React Query `error` rendered via `<Alert variant="destructive">`. Error message shows `error.message`; in dev, also show `error.body` collapsed.
- Mutations: on error, toast with the error message AND keep form/dialog open.
- 404 from per-version fetches → "This version no longer exists" empty state with link back to agent detail.
- **422 from the regression endpoint** is expected (means "blocked"). The wrapper must NOT throw on 422 from `/regression-run` — instead, parse `body.detail` and return it as a normal `RegressionRunResponse` with `status: "BLOCKED"`. Any other 422 is treated as a real error.

### 5.2 — Loading states

- List pages: skeleton rows (5 rows) matching the final row layout.
- Detail pages: skeleton card matching the final card structure.
- Inline mutations (regenerate, lock, apply): button spinner + disabled; rest of page interactive.
- Long-running mutations (deep-mode improvements ~30-60s; eval runs ~30s+; test case generation ~10-30s): button shows action-specific label and is disabled; toast on completion.

### 5.3 — Type safety

- Every new endpoint gets a TS type in `types.ts`.
- No `any` in new code. Uncertain shapes → `unknown` with narrowing at the boundary.
- New types: `FailureCategory`, `ContractV2`, `ToolSequence`, `ForbiddenBehavior`, `LatencyBudget`, `ObligationV2`, `Suggestion`, `EvalResult` (extended), `EvalRunSummary`, `RegressionType`, `RegressionRunResponse`, `RegressionItem`, `ImprovementItem`, `AgentSchema`, `TestCaseV2`.

### 5.4 — Backend asks (consolidated, by priority)

| Phase | Item | Backend ask | Status |
|---|---|---|---|
| A.2 | Schema editor | `PATCH /agents/{id}/schema` body `{schema_json}` returns `AgentSchema` with `human_edited: true` | **BLOCKED.** Read-only ships without it. |
| B.3 | Eval summary on GET | `GET /eval-runs/{run_id}` to return stored `summary_json` (with `pass_rate`, `avg_latency_ms`, `latency` breakdown) | Optional — frontend derives these fields from `results`. Cleanup ask. |
| B.5 | Cross-version badge | `GET /eval-runs` to include `agent_version_id` and `test_case_source_version_id` per row | Soft-blocker for the badge column only; dialog ships. |
| C.4 | `no_progress[]` array | Extend `routers/regression_v2.py` response to include `no_progress: RegressionItem[]` | **BLOCKED.** Section ships when backend lands. |

### 5.5 — Testing

- No unit-test discipline imposed (Lovable doesn't write tests by default).
- After each phase ships: smoke-test the golden path in the browser per the per-phase smoke tests above. Confirm no regressions in existing screens.

### 5.6 — Out of scope (parking lot)

Auth, theming, i18n, analytics, full mobile responsive overhaul, real-time updates (WebSockets/SSE for long-running eval runs), bulk version operations, N-version (>2) comparison, observability dashboards (latency trends across runs), per-version schema snapshots.

---

## 6 — Hand-off summary

Three Lovable hand-offs, in strict order:

1. **Phase A — Author** (§2): A.1 → A.2 → A.3 → A.4 → A.5
2. **Phase B — Run & Evaluate** (§3): B.1 → B.2 → B.3 → B.4 → B.5
3. **Phase C — Compare & Ship** (§4): C.1 → C.2 → C.3 → C.4

Each phase is self-contained. Cleanup items are woven into the prelude (A.1, B.1) or the relevant feature step (D-14c folded into C.3). Backend asks are listed inline and consolidated in §5.4. All shapes verified against `agentops-backend` branch `v2-behavioral-contracts` as of 2026-04-18.
