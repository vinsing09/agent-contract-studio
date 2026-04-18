# Frontend Fixes and Features — Design Spec

**Date:** 2026-04-18
**Author:** vineet@digitalgreen.org (with Claude)
**Repo:** `agent-contract-studio` (Lovable-built React + Vite + TS frontend)
**Backend reference:** `agentops-backend` (FastAPI; this doc is frontend-only)

---

## Goal

Close the gap between what the AgentOps backend exposes and what the frontend renders, while cleaning up dead code and fixing two outstanding bugs. Ship in three phases mapped to user journeys: **Author → Run & Evaluate → Compare & Ship**. Each phase is a self-contained Lovable hand-off.

## Non-goals

Auth, theming, i18n, analytics, full mobile responsive overhaul, real-time updates (WebSockets/SSE), bulk version ops, N-version (>2) comparison, observability dashboards. See §5.6.

---

## 1 — Architecture & Conventions

**Stack (keep):** React + Vite + TS + Tailwind + shadcn-ui + React Query + React Router. Pages in `src/pages/`, shared UI in `src/components/`, API in `src/lib/api.ts`, types in `src/lib/types.ts`.

**Conventions for all new work:**

1. **API layer.** Every new endpoint gets a wrapper in `src/lib/api.ts`; no inline `fetch` in components. Wrappers throw `ApiError` (`{status, message, body?}`) on non-2xx; pages catch via React Query `error`.
2. **Types.** Every new response shape gets a TS type in `src/lib/types.ts`. No `any` in new code; if backend shape is uncertain, type as `unknown` and narrow at the boundary.
3. **React Query keys.** Namespaced and stable: `['agent', id]`, `['agent', id, 'version', vid, 'contract']`, `['agent', id, 'version', vid, 'schema']`, `['eval-run', runId]`. Mutations call `queryClient.invalidateQueries({queryKey: [...]})` on success.
4. **Loading/error states.** `<Skeleton />` while loading; `<Alert variant="destructive">` on error with the error message and a retry button. Inline mutations show button spinner + disabled state; rest of page interactive.
5. **Empty states.** Every list/detail uses an `EmptyState` component (icon + title + 1-line description + optional CTA). Add to `src/components/` if not present.
6. **Toast feedback.** Every mutation fires a toast (`useToast`) on success and on error. On error, keep the form/dialog open.
7. **Blocked-on-backend.** Listed inline per phase with the exact request/response shape expected. Phase ships only when backend lands. **No mock data shims.**
8. **Routing.** Flat URL scheme. New screens get top-level routes (`/agents/:id/versions/:vid/schema`, `/agents/:id/versions/:vid/diff/:otherVid`).
9. **No V1 dead code.** When a page is rewritten to V2, V1 wrappers in `api.ts` are deleted in the same hand-off.
10. **404 from per-version fetches** → "This version no longer exists" empty state with link back to agent detail. No hard redirect.

---

## 2 — Phase A: Author

**Goal:** complete the agent-authoring flow — schema, contract surface, regenerate, manual test cases.

### A.1 — Cleanup prelude (D-13, D-14a)

- **Delete** `src/pages/TestCaseList.tsx` (unreferenced). Remove its route from `App.tsx` if present.
- **Delete** any V1 test-case wrappers in `api.ts` that become unreferenced after this change.
- **Add to `AppSidebar.tsx`:** "Test Cases" entry → `/test-cases`. Verify the route maps to `TestCaseAgentList.tsx` or add the mapping.

### A.2 — Schema viewer/editor

**New page:** `src/pages/AgentSchema.tsx`
**Route:** `/agents/:agentId/versions/:versionId/schema`
**Entry point:** new "Schema" tab/button on `AgentDetail.tsx` for the active version.

**Components:**
- `SchemaPanel` (new, `src/components/schema/`)
  - Props: `agentId: string`, `versionId: string`
  - State: `mode: 'view' | 'edit'`, `draftJson: string`, `isDirty: boolean`
  - On mount: `useQuery(['agent', agentId, 'schema'], () => api.getSchema(agentId))`
  - Schema missing → empty state with "Extract schema from this version" CTA → `POST /agents/{id}/schema/extract?version_id={vid}`
  - View mode: read-only syntax-highlighted JSON (shadcn `<ScrollArea>` + `<code>`)
  - Edit mode: shadcn `<Textarea>` with raw JSON, "Save" + "Cancel" buttons; client-side `JSON.parse` validation, inline error if invalid
  - Header badges: `human_edited` (if true → "Edited by human"); `extracted_from_version_id` (if differs from current version → "Extracted from v{n}")

**API wrappers (in `api.ts`):**
- `getSchema(agentId)` → `GET /agents/{id}/schema`
- `extractSchema(agentId, versionId?)` → `POST /agents/{id}/schema/extract?version_id={vid}`
- `updateSchema(agentId, schemaJson)` → **🚧 BLOCKED.** Backend has no `PATCH /agents/{id}/schema`. Backend ask: `PATCH /agents/{id}/schema` body `{schema_json: dict}` returns updated `AgentSchema` with `human_edited: true`. **Phase A ships read-only + extract until this lands.**

### A.3 — Contract V2 surface

**File:** `src/pages/AgentDetail.tsx` — replace contract rendering at lines 534-577.

**Components:**
- `ContractPanel` (extract from `AgentDetail.tsx` if not already)
  - Props: `agentId`, `versionId`, `contract: ContractV2 | null`
  - Renders 4 sub-sections in shadcn `<Card>`s:
    1. **Obligations** (existing) — add `<Badge>` per obligation showing `failure_category` (e.g., `TOOL_TRIGGER`, `INPUT_EXTRACTION`)
    2. **Tool Sequences** (new) — each sequence as an ordered list of tool names with arrows; `description` below
    3. **Forbidden Behaviors** (new) — list of behavior strings, each with destructive-variant `<Badge>` + description
    4. **Latency Budgets** (new) — table: scope | budget_ms | rationale
  - Each sub-section: empty state if array is empty (e.g., "No tool sequences defined for this contract")

**Types (in `types.ts`):** `ContractV2`, `ToolSequence`, `ForbiddenBehavior`, `LatencyBudget`, `ObligationV2` (with `failure_category: string`).

**API wrapper:** `getContractV2(agentId, versionId)` → `GET /agents/{id}/versions/{vid}/contract`.

### A.4 — Regenerate contract

**File:** `src/pages/AgentDetail.tsx` (or `ContractPanel.tsx` after extract).

- The existing "Generate Contract" button (line 660) MUST NOT be permanently disabled once a contract exists. Relabel to "Regenerate Contract" when `contract != null`.
- New `RegenerateContractDialog` (shadcn `<AlertDialog>`):
  - Trigger: "Regenerate Contract" button
  - Body: warns existing test cases may need re-evaluation; locked test cases stay locked but pass/fail may change
  - Confirm: `POST /agents/{id}/versions/{vid}/contract/generate`, invalidate `['agent', id, 'version', vid, 'contract']`, toast success
  - Cancel: closes

**API wrapper:** `regenerateContract(agentId, versionId)` (same POST as initial generate).

### A.5 — Manual test case creation

**New page:** `src/pages/TestCaseNew.tsx`
**Route:** `/agents/:agentId/versions/:versionId/test-cases/new`
**Entry point:** "New Test Case" button on `TestCaseAgentList.tsx` header, beside existing "Generate" button.

**Components:**
- `TestCaseForm` (new, `src/components/test-cases/`)
  - Props: `agentId`, `versionId`, `mode: 'create' | 'edit'`, `initial?: TestCase`
  - Form (`react-hook-form` + `zod` if already in stack, else shadcn `<Form>`):
    - `input: string` (textarea, required)
    - `expected_output: string` (textarea, required)
    - `obligation_ids: string[]` (multi-select from contract's obligations — fetch via `getContractV2`)
    - `tags: string[]` (free-form chips input)
  - Submit: `POST /agents/{id}/versions/{vid}/test-cases` (or V1 fallback if V2 absent), invalidate `['test-cases', agentId, versionId]`, toast, navigate back to list

**API wrapper:** `createTestCase(agentId, versionId, payload)`. **🚧 Verify route exists.** If absent, backend ask: `POST /agents/{id}/versions/{vid}/test-cases` body `{input, expected_output, obligation_ids, tags}` returns created `TestCase`.

### Phase A blockers

- A.2: `PATCH /agents/{id}/schema` (else schema editor ships read-only)
- A.5: verified `POST /agents/{id}/versions/{vid}/test-cases` route

### Phase A smoke test

1. Open an existing agent → "Schema" tab → schema renders (view mode).
2. New agent without schema → "Extract schema" CTA → schema appears.
3. Contract panel renders all 4 sub-sections.
4. "Regenerate Contract" → dialog → confirm → contract refreshes.
5. "New Test Case" → form → submit → test case appears in list.
6. Sidebar "Test Cases" entry navigates to test case list.

---

## 3 — Phase B: Run & Evaluate

**Goal:** complete the eval-running surface — informational results, real summary card, deep-mode improvements, cross-version eval.

### B.1 — Cleanup prelude (D-15, D-16, D-14b)

**`src/lib/api.ts` — `applySuggestions` (D-15):**
- New signature: `applySuggestions(agentId, versionId, evalRunId, acceptedPatches?: Record<string, unknown>)`.
- Body sends `{accepted_patches}` when present (fast path; backend skips re-running suggester).

**`src/pages/AgentDetail.tsx` improvements panel (D-16):**
- Reads `s.failure_pattern` and `s.affected_cases`. Verify field names against `services/deep_improvement_suggester.py` output and rename in the panel reader.
- Add a `Suggestion` type in `types.ts` with the verified field names; remove `any` from the panel.

**`src/components/AppSidebar.tsx` (D-14b):**
- Add "Eval Runs" entry → `/eval-runs`.

### B.2 — Informational results in eval run detail

**File:** `src/pages/EvalRunHistory.tsx` (lines 130-131 split results into `deterministic` and `semantic` only).

- Split into 3 buckets: `deterministic`, `semantic`, `informational`.
- Add a third `<Card>` "Latency Budget" rendering informational rows.
- Per row: test case input (truncated), measured latency_ms, budget_ms, within-budget badge (green ✓ / amber ✗).
- If `informational` array is empty: hide the card (informational is optional, no empty state).

**Types:** extend `EvalResult` with `result_type: 'deterministic' | 'semantic' | 'informational'` and `latency_ms?: number`.

### B.3 — Eval run summary card

**File:** `src/pages/EvalRunHistory.tsx`.

- Replace any client-side recomputation (counting passes, computing pass rate) with reads from the eval run's `summary_json`.
- New `EvalRunSummaryCard` (`src/components/eval/`)
  - Props: `summary: EvalRunSummary`
  - Renders: total cases, pass count, fail count, pass rate %, plus `latency: {within_budget, over_budget}`. 4 stat tiles (shadcn `<Card>` × 4 in a grid).
- If `summary_json` is null/missing on an old run: show "Summary unavailable for runs created before vN" inline alert; do not recompute.

**Types:** `EvalRunSummary` matching backend's `summary_json` shape.

### B.4 — Deep mode toggle on improvements panel

**File:** `src/pages/AgentDetail.tsx` — improvements panel (lines 740-815).

- Add shadcn `<Tabs>` or `<RadioGroup>` at the top: "Standard" (default) | "Deep".
- Persist user's choice in component state (no cross-reload persistence).
- Pass mode through to API: `getImprovements(agentId, versionId, evalRunId, mode)` → `POST /agents/{id}/versions/{vid}/improvements?eval_run_id=xxx&mode=standard|deep`.
- Deep mode: inline note "Runs dual-model A/B critique-refine — takes ~30-60s longer."
- Deep mode loading: button shows "Running deep analysis…" + disabled; toast on completion.

**API wrapper:** update `getImprovements` to accept `mode`; default to `'standard'`.

### B.5 — Cross-version eval

**Goal:** run version B's prompt against test cases authored on version A.

**Entry point:** "New Eval Run" button on `EvalRunHistory.tsx` opens a dialog (instead of immediate POST).

**Components:**
- `NewEvalRunDialog` (shadcn `<Dialog>`)
  - Props: `agentId`, `versionId` (target version)
  - Fields:
    - `test_case_source_version_id`: shadcn `<Select>` listing all versions of this agent (default: current `versionId`)
    - When `source !== target`: inline note "Cross-version eval — running v{target} against test cases from v{source}"
  - Submit: `POST /agents/{id}/versions/{vid}/eval-runs` body `{test_case_source_version_id}`
  - Navigate to the new eval run's detail on success

**API wrapper:** `createEvalRun(agentId, versionId, {test_case_source_version_id})`.

**Listing change:** `EvalRunHistory.tsx` row shows a "cross-version" badge when `test_case_source_version_id !== agent_version_id`.

### Phase B blockers

None anticipated — backend already supports `summary_json`, `result_type='informational'`, deep mode, `test_case_source_version_id`. D-16 needs a backend code check.

### Phase B smoke test

1. Sidebar "Eval Runs" → list opens.
2. Open an eval run with informational results → 3 sections render correctly.
3. Summary tiles match backend `summary_json` (no client-side recomputation).
4. Improvements panel: standard mode runs as before; deep mode runs and shows the longer-loading state.
5. New eval run dialog: same-version eval works; cross-version eval shows the inline note and the resulting run is badged.
6. Apply suggestions: confirm fast path is used (network tab — body should include `accepted_patches`).

---

## 4 — Phase C: Compare & Ship

**Goal:** complete the comparison surface — regression depth, version diff, obligation linkage, no-progress rendering.

### C.1 — Regression type per result

**File:** `src/pages/RegressionDashboard.tsx`.

- Each result row gets a `<Badge>` for `regression_type`:
  - `STABLE` → secondary, no icon
  - `REGRESSION` → destructive, ⬇
  - `IMPROVEMENT` → success/green, ⬆
  - `NO_PROGRESS` → amber/warning, ⊘
- Filter chip row above the results list to filter by `regression_type` (multi-select; default all).
- Per-section counts at top reflect filter selection.

**Types:** add `RegressionType = 'STABLE' | 'REGRESSION' | 'IMPROVEMENT' | 'NO_PROGRESS'`; extend `EvalResult` (or `RegressionResult`).

**API:** no change.

### C.2 — Test-case ↔ obligation linkage

**Files:** `src/pages/TestCaseAgentList.tsx`, `src/pages/TestCaseDetail.tsx`.

**List (`TestCaseAgentList.tsx`):**
- Add "Obligations" column rendering each `obligation_id` as a `<Badge>` (resolve id → obligation title via the contract fetch already on the page; fallback to id).
- Add an "Obligation" filter dropdown to the existing filter bar (multi-select from contract's obligations; client-side filter).

**Detail (`TestCaseDetail.tsx`):**
- New "Covers Obligations" section: each linked obligation with title + failure_category badge.
- Each obligation links to its anchor in the contract panel on `AgentDetail.tsx` (same agent + version).

**API:** no change.

### C.3 — Version diff view + sidebar entry (D-14c re-scoped)

**New page:** `src/pages/VersionDiff.tsx`
**Route:** `/agents/:agentId/versions/:versionId/diff/:otherVersionId`
**Entry points:**
- `AgentDetail.tsx`: "Compare versions" button in the agent header. Opens a small popover listing other versions; selecting one navigates to the diff route.
- `AppSidebar.tsx`: do **not** add a top-level entry (diff is always agent-scoped). D-14c re-scoped to the agent-header button above.

**Components:**
- `VersionDiff` page composed of 4 tabbed panels (shadcn `<Tabs>`):
  1. **Prompt** — side-by-side text diff (use `react-diff-viewer-continued` if not present, else a simple line-by-line diff). Header shows v{a} vs v{b}.
  2. **Schema** — side-by-side JSON diff (pretty-printed).
  3. **Contract** — sub-sections (Obligations / Tool Sequences / Forbidden Behaviors / Latency Budgets), each side-by-side with added/removed/changed items color-coded (green/red/amber).
  4. **Eval delta** — enabled only if both versions have at least one eval run; pass-rate side-by-side + list of test cases whose result changed (filterable by `regression_type` from C.1).

**API wrappers:**
- Reuse existing per-version fetches (`getVersion`, `getSchema`, `getContractV2`).
- Eval delta tab: `getLatestEvalRun(agentId, versionId)`. **🚧 Verify** `GET /agents/{id}/versions/{vid}/eval-runs?limit=1` works; likely already supported.

### C.4 — `no_progress[]` rendering

**File:** `src/pages/RegressionDashboard.tsx` (lines 381-389 already render `result.no_progress` conditionally; backend never sends it).

**🚧 BLOCKED on backend.** Backend ask: extend `routers/regression_v2.py:229-237` response to include `no_progress: RegressionItem[]` alongside `regressions[]` and `improvements[]`. Same item shape.

**Frontend change once unblocked:**
- Third "No Progress" section beside Regressions and Improvements; same card layout, amber accent.
- Section count uses `summary.no_progress_count` (already in summary).

**Ships only when backend lands.** No mock shim.

### Phase C blockers

- C.3: verify `GET /agents/{id}/versions/{vid}/eval-runs?limit=1`
- C.4: `no_progress[]` in regression response

### Phase C smoke test

1. Regression dashboard: each row has a regression-type badge; filters work; counts update with filter.
2. Test case list: obligations column shows badges; obligation filter narrows the list.
3. Test case detail: "Covers Obligations" section renders; clicking an obligation navigates to its anchor in the contract panel.
4. Agent detail header: "Compare versions" → popover → diff route opens.
5. Version diff: all 4 tabs render correctly; eval delta tab disabled when one version has no eval run.
6. (Once backend lands) Regression dashboard shows the third "No Progress" section.

---

## 5 — Cross-Cutting Concerns

### 5.1 — Error handling

- All API wrappers throw `ApiError` (define in `api.ts` if not present): `{status: number, message: string, body?: unknown}`.
- React Query `error` rendered via `<Alert variant="destructive">`. Error message shows `error.message`; in dev, also show `error.body` collapsed.
- Mutations: on error, toast with the error message AND keep form/dialog open.
- 404 from per-version fetches → "This version no longer exists" empty state with link back to agent detail (no hard redirect).

### 5.2 — Loading states

- List pages: skeleton rows (5 rows) matching the final row layout.
- Detail pages: skeleton card matching the final card structure.
- Inline mutations (regenerate, lock, apply): button spinner + disabled; rest of page interactive.
- Long-running mutations (deep-mode improvements, ~30-60s): button shows "Running deep analysis…" and is disabled; toast on completion.

### 5.3 — Type safety

- Every new endpoint gets a TS type in `types.ts`.
- No `any` in new code. Uncertain shapes → `unknown` with narrowing at the boundary.
- New types: `ContractV2`, `ToolSequence`, `ForbiddenBehavior`, `LatencyBudget`, `ObligationV2`, `Suggestion`, `EvalResult` (extended), `EvalRunSummary`, `RegressionType`, `AgentSchema`, `TestCase` (extended with `obligation_ids`).

### 5.4 — Backend blockers (consolidated)

| Phase | Item | Backend ask | Status |
|---|---|---|---|
| A.2 | Schema editor | `PATCH /agents/{id}/schema` body `{schema_json}` returns updated `AgentSchema` with `human_edited: true` | Required for edit; read-only ships without it |
| A.5 | Manual test case | Verify `POST /agents/{id}/versions/{vid}/test-cases` exists with `{input, expected_output, obligation_ids, tags}` | Verify before Phase A starts |
| B.1 | Suggestion fields | Verify `pattern`/`cases` vs `failure_pattern`/`affected_cases` in suggester output | Backend code check |
| C.3 | Version diff eval delta | Verify `GET /agents/{id}/versions/{vid}/eval-runs?limit=1` works | Likely already supported |
| C.4 | `no_progress[]` | Extend `routers/regression_v2.py:229-237` response to include `no_progress: RegressionItem[]` | Required to ship C.4 |

### 5.5 — Testing

- No unit-test discipline imposed (Lovable doesn't write tests by default).
- After each phase ships: smoke-test the golden path in the browser per the per-phase smoke tests above. Confirm no regressions in existing screens.

### 5.6 — Out of scope (parking lot)

Auth, theming, i18n, analytics, full mobile responsive overhaul, real-time updates (WebSockets/SSE for long-running eval runs), bulk version operations, N-version (>2) comparison, observability dashboards (latency trends across runs).

---

## 6 — Hand-off summary

Three Lovable hand-offs, in strict order:

1. **Phase A — Author** (§2): A.1 → A.2 → A.3 → A.4 → A.5
2. **Phase B — Run & Evaluate** (§3): B.1 → B.2 → B.3 → B.4 → B.5
3. **Phase C — Compare & Ship** (§4): C.1 → C.2 → C.3 → C.4

Each phase is self-contained. Cleanup items are woven into the prelude (A.1, B.1) or the relevant feature step (D-14c folded into C.3). Backend blockers are listed inline and consolidated in §5.4.
