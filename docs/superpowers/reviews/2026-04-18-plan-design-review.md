# GSTACK Design Review — Phase A/B/C Implementation Plans

**Date:** 2026-04-18
**Branch:** `plan/design-review-phase-abc`
**Reviewer:** gstack `/plan-design-review` skill
**Scope:** `docs/superpowers/plans/2026-04-18-phase-{a,b,c}-*.md`
**Parent spec:** `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md`
**Mockups:** Skipped (no OpenAI API key). Text-only review per skill's documented fallback.

## Step 0 — Calibration

**Initial rating:** 5.5 / 10

The plans are technically thorough (Contract V2 shape, regression 422 envelope, sync eval blocking, legacy GET-endpoint gap on `summary_json`, stale `affects_cases` docstring vs live `fixes_watching`) and honest about backend limits (no `PATCH` for schema, no `no_progress[]` array, agent-scoped schemas). That's the 5. The missing half-point lives in the *design* layer, not the engineering one:

- No DESIGN.md in the repo. The plans calibrate to live code conventions (13px/11px/10px type, 220px dark sidebar, primary-dot brand) but never say so explicitly, so a Lovable prompt could drift.
- Sidebar grows 2 → 4 items with no IA story. "Agents / Test Cases / Eval Runs / Behavioral Check" mixes nouns (things) and a verb-ish audit noun ("Behavioral Check"), three of which live under an agent context.
- Deep link `/agents/{id}#obligation-{oid}` (Phase C → A) assumes the contract panel is expanded. Anchor won't scroll if the panel is collapsed. Not called out.
- `AgentDetail.tsx` already carries 15+ pieces of local state. Plans add ~5 more with no URL-state / reducer migration. This compounds.
- Seven summary tiles on `EvalRunSummaryCard` at tablet widths is not specified. Plan says "up to 7" — no wrap rule, no priority ordering.
- Toast cadence on "Apply N suggestions" — 5 accepts fire 5 toasts. Not deduped.
- No breadcrumb story anywhere. URLs get 3–4 deep (`/agents/:id/versions/:vid/test-cases/generate`, `/agents/:id/diff?base=X&challenger=Y`) with no return path cue.

These are real design problems that the engineering quality of the plan masks. Addressable in the review without slowing ship.

---

## Pass 1 — Information Architecture

### Finding 1.1 — Sidebar scope mix

Current: 2 items (Agents, Behavioral Check). Planned: 4 (Agents, Test Cases, Eval Runs, Behavioral Check). Three of the four operate on a single agent. "Test Cases" and "Eval Runs" at root level imply cross-agent lists; the existing `TestCaseAgentList` and `EvalRunHistory` pages are actually agent-scoped today.

**Severity:** Medium. Users will click "Test Cases" expecting all test cases org-wide and get an agent picker instead.

**Recommendation:** Two options — pick one before Phase A ships.

- **Option A (cheap):** Rename `/test-cases` landing page title to "Test Cases by Agent" and open on an agent picker. Keep sidebar as-is. Add to Phase A.1.
- **Option B (correct):** Group sidebar into "Agents" section (collapsible) and "Quality" section (Behavioral Check). Drop Test Cases + Eval Runs from root sidebar — they live inside each agent's detail page via tabs. This is closer to how Linear / Vercel structure per-project vs global surfaces.

**My recommendation:** Option B. The 2-item sidebar was clean. Bloating it to 4 tells a user "each of these is a peer primary surface" which is false. Move test cases + eval runs into tabs inside `AgentDetail`.

**Plan edit target:** Phase A Task 1 sidebar section, Phase B Task 1 sidebar section.

### Finding 1.2 — Deep-link fragility

Phase C C.2 links `/agents/{id}#obligation-{oid}` from test case detail. Phase A A.3 attaches anchors to the contract panel, but the contract panel is collapsible. If the user has the contract collapsed, the anchor will not scroll. Anchor-scroll happens before any open-panel effect runs.

**Severity:** Medium. Works on first visit, silently fails after the user has ever collapsed the panel.

**Recommendation:** In A.3 (`ContractPanel.tsx`), on mount read `location.hash`. If hash matches any `#obligation-*` id, force-expand the contract panel AND force-expand the "Obligations" card inside it BEFORE the `scrollIntoView` call. Use a `useEffect` with `window.location.hash` as dep.

**Plan edit target:** Phase A Task 3 acceptance criteria + Lovable prompt.

### Finding 1.3 — Breadcrumb gap

URLs reach 3-4 segments deep. No breadcrumb component exists. Hash-anchor deep link from test case detail → agent detail (C.2) gives no "back to test case" cue.

**Severity:** Low. Real but scope-pushable.

**Recommendation:** Non-blocking. Add a `docs/superpowers/todos/breadcrumbs.md` stub noting this and move on. Don't add to Phase A/B/C — it's a system-level addition that belongs in a Phase D or dedicated polish pass.

### Finding 1.4 — Cross-screen drift after regenerate

Phase A.4 regenerate contract. If an eval run exists against the old contract and the user regenerates, the stored results silently become stale. Nothing in the run detail (Phase B.3) says "this ran against contract v@hash-old".

**Severity:** High for trust. Users will see passing evals and ship regressions.

**Recommendation:** In Phase B.3 `EvalRunSummaryCard`, add a faint badge: "Ran against contract v{hash-8}" next to the version pill. If `summary.contract_hash` drifts from current, show a warning bubble: "Contract has changed since this run." Backend already stores `summary_json` with contract metadata per V2 POST (verified in plan) — expose it.

**Plan edit target:** Phase B Task 3 `EvalRunSummaryCard` component spec.

---

## Pass 2 — Interaction State Coverage

For each new surface, these five states must each have a designed treatment: loading, empty, error, success, partial (e.g., some data loaded, some pending).

### Finding 2.1 — Long-running sync with no progress signal

Three blocking-sync mutations in the plans:
- Phase A.5 test-case generation: ~10-30s
- Phase B.4 eval run (full): 30+ seconds
- Phase B Task 4 deep-mode improvements: +30-60s on top of the eval

Plans show "Generating…" with a disabled button. No progress indication, no cancel, no "this is normal, don't close the tab" cue.

**Severity:** High. 30-60s of an unresponsive UI is where users refresh and break things.

**Recommendation:** For each of the three, require:
1. Indeterminate progress bar inside the dialog/form (shadcn `Progress` with no value binding, animated).
2. Body copy line that tells the user the expected range ("Usually takes 30-60 seconds. Don't close this tab.").
3. After 45s threshold (per mutation), add a second-state line: "Still working… large runs can take up to 90s."
4. No cancel button (sync backend can't be cancelled). Make that explicit: "Cannot be cancelled once started."

**Plan edit target:** Phase A Task 5, Phase B Tasks 4 and 5, Phase B Task 1 (deep mode on the improvements panel).

### Finding 2.2 — Toast cadence on multi-accept

Phase B Task 1 flow: user reviews suggestions, accepts 5, clicks "Apply." Current plan fires one mutation with `accepted_fix_ids: [...]` — good. But on the existing `AgentDetail.tsx`, per-suggestion accept/reject state updates likely trigger toasts per click (pattern used elsewhere in the code).

**Severity:** Low-Medium. 5 stacked toasts feels like a bug to most users.

**Recommendation:** Accept/reject on a suggestion is a local state mutation — NO toast. Toast fires only on the final "Apply N" submit. Spec this explicitly in Phase B Task 1 acceptance criteria: "Accepting or rejecting individual suggestions does NOT show a toast. Only the final Apply action shows a toast."

**Plan edit target:** Phase B Task 1 acceptance criteria.

### Finding 2.3 — Partial-state coverage for 7-tile summary

`EvalRunSummaryCard` (Phase B.3) shows up to 7 tiles: total, passed, failed, pass rate, avg latency, deterministic pass rate, semantic pass rate. If `results[]` only contains deterministic rows (no semantic tests ran), 2 of the 7 tiles are empty.

**Severity:** Medium. Empty tiles with "—" read as "this feature is broken."

**Recommendation:** Conditional rendering: a tile only renders if it has data. Specify the priority order in the plan so rendering is deterministic across runs:
1. Pass rate (always)
2. Total (always)
3. Passed (always)
4. Failed (always)
5. Deterministic pass rate (if any deterministic rows)
6. Semantic pass rate (if any semantic rows)
7. Avg latency (if any informational rows with `latency_ms`)

Grid wraps at narrow widths (4-up, then 3-up, then 2-up). Specify breakpoints.

**Plan edit target:** Phase B Task 3 `EvalRunSummaryCard` spec.

### Finding 2.4 — Empty-state taxonomy gap

Plans reference `EmptyState` consistently (good). But they don't specify *what icon* for each surface. Inconsistent icons = design incoherence.

**Severity:** Low.

**Recommendation:** Add an "Empty state icon registry" section to the parent spec §1 conventions. Phase A uses: `FileJson` (schema), `FileText` (contract), `ListChecks` (test cases). Phase B: `Activity` (eval runs), `Lightbulb` (suggestions). Phase C: `GitCompare` (diff), `Target` (regressions).

**Plan edit target:** Parent spec §1, with back-references from each phase plan.

---

## Pass 3 — User Journey + Emotional Arc

Storyboard the full author→ship loop the plans collectively enable:

1. Create agent (existing)
2. Upload system prompt (existing, AgentUpload.tsx)
3. **Extract schema** (A.2) — user clicks Schema, sees empty, clicks Extract, waits ~5s, sees JSON. *Feeling:* curious, mildly impressed.
4. **Generate contract** (existing, enhanced by A.3) — clicks Generate Contract, waits ~10s, sees 4-card panel. *Feeling:* "the machine understood my agent."
5. **Configure & generate test cases** (A.5) — clicks "Generate test cases," picks count, submits, waits ~20s, sees list. *Feeling:* anxious if existing ones get deleted silently.
6. **Run eval** (B.5) — clicks "Run eval", waits 30-60s. *Feeling:* staring at spinner, doubting the product.
7. **Review results** (B.3) — summary card + per-result rows. *Feeling:* orienting, scanning for red.
8. **Generate improvements** (B.1 + B.4) — clicks Suggest Fixes, picks Standard or Deep, waits 30s (Standard) or 90s (Deep), reviews suggestions. *Feeling:* critical, weighing.
9. **Apply fixes** (B.1) — accepts N suggestions, clicks Apply, waits, gets new version. *Feeling:* "did this work?"
10. **Compare versions** (C.3) — navigates to diff, sees 4 tabs. *Feeling:* wants to see green-line delta.
11. **Behavioral Check** (C.1) — sees per-result badges, filters to just REGRESSIONs. *Feeling:* "show me what's worse."

### Finding 3.1 — Steps 6 and 8 are blind waits

30-60s of no-progress spinner at step 6, potentially 90s at step 8. Across the journey that's 2-3 minutes of dead air in a ~10-step flow.

**Recommendation:** Already covered in 2.1. Reinforce: these are the two highest-leverage places for progress-indicator investment.

### Finding 3.2 — Step 5 is destructive without enough warning

A.5 form warns "Will replace N existing test cases" — plan has it. But the flow from A.5 → B.5 (eval) happens fast. A user who regenerates test cases right before running eval has silently thrown away the test coverage the last eval proved.

**Severity:** Medium-High.

**Recommendation:** On `AgentDetail` → Eval section, if the latest eval run's `test_case_count` differs from current count, show a banner: "Test cases changed since last eval. Run again to re-baseline." Uses existing query data — no new endpoint.

**Plan edit target:** Phase B Task 3 or 5.

### Finding 3.3 — Step 10 has no "what changed" summary at the top

Phase C Task 3 `VersionDiff` page: 4 tabs (Prompt / Schema / Contract / Eval Delta), Eval Delta is default. But the top of the page is just "Version A vs Version B" — no one-line summary ("+2 obligations, prompt length +38 lines, pass rate +7pts").

**Severity:** Medium. A diff page without a summary strip is a wall of JSON.

**Recommendation:** Add a 3-line summary strip above tabs:
```
Prompt: +38 lines, -12 lines
Contract: +2 obligations, 1 changed
Eval: 82% → 89% pass (+7pts over 120 cases)
```
Derived from data already being fetched for the tabs. Zero new backend.

**Plan edit target:** Phase C Task 3 `VersionDiff.tsx` spec.

---

## Pass 4 — AI Slop Risk

Classifier: **APP UI** (not landing page). Evaluate against:

### Hard-rejection checklist
- [ ] Generic purple/blue gradient heroes → Not in plans. ✅
- [ ] 3-column feature grids with icon-title-blurb → Not in plans. ✅
- [ ] Centered hero with giant CTA → Not in plans (app is sidebar-led). ✅
- [ ] Emoji used as navigation signifier → Not in plans. ✅
- [ ] "Transform your workflow" / "Unlock" / "Empower" copy → None in plans. ✅
- [ ] Stock iconography (Heroicons solid set, Material rounded) → Uses lucide-react, consistent with live code. ✅

### Litmus tests
- **Would Linear build it this way?** Mostly yes — dark sidebar, dense info, 13px/11px/10px type scale, subtle accent. Risk: the 4-card contract panel could feel like a SaaS marketing page if the card styling is too rounded and padded. **Recommend:** specify `rounded-md` not `rounded-lg`, `p-3` not `p-6`, subtle 1px border not shadow. Plan currently doesn't specify — defaults will drift.
- **Would Vercel build it this way?** Yes for eval runs list, diff. Caveat: avoid colored backgrounds on status tiles (e.g., don't make "Passed" tile have a green background). Text color + icon color only.
- **Would Posthog build it this way?** Closest match — dense data, dark UI. Risk: regression colors. Plan specifies 4 colors (STABLE / REGRESSION / IMPROVEMENT / NO_PROGRESS). **Recommend:** map to existing shadcn semantic tokens — `muted` for STABLE, `destructive` for REGRESSION, `primary` (or a custom "success" tied to primary) for IMPROVEMENT, `secondary` for NO_PROGRESS. Don't invent a 4-color palette.

### Finding 4.1 — Regression palette needs token mapping
**Plan edit target:** Phase C Task 1 `RegressionTypeBadge` — map to shadcn semantic tokens, not raw colors.

### Finding 4.2 — Card styling unspecified
**Plan edit target:** Parent spec §1 — add a card-styling convention line: "Cards use `rounded-md`, `border`, `p-3` to `p-4`, no shadow unless hover-elevated. Avoid `rounded-lg` and `p-6` — those read as marketing."

### Finding 4.3 — Button-label case
`AgentDetail.tsx` live code mixes "Run eval" (sentence case) and "Generate Contract" (Title Case). Plans inherit this inconsistency.
**Severity:** Low but pervasive.
**Recommendation:** Add convention: all CTA button labels use sentence case, NOT title case ("Regenerate contract", not "Regenerate Contract"). Call out explicitly in parent spec §1.

---

## Pass 5 — Design System Alignment

No DESIGN.md exists. Live code conventions (extracted from `AppSidebar.tsx`, `AgentDetail.tsx`, existing shadcn setup):

- **Type scale:** 13px body (`text-[13px]`), 11px meta (`text-[11px]`), 10px micro labels (`text-[10px]`). No `text-sm/text-xs` mixing.
- **Sidebar:** 220px fixed, dark card, left-border-2px-primary accent on active, `rounded-r`.
- **Brand:** "AgentOps" wordmark + small primary-colored dot flourish.
- **Color tokens:** shadcn defaults (`primary`, `muted`, `destructive`, `secondary`, `foreground`, `background`, `border`, `ring`).
- **Spacing:** 3/4 (12px/16px) dominant, not 6/8.
- **Borders:** 1px, `border` token; no 2px except active nav.

### Finding 5.1 — Plans don't reference these anywhere

All three phase plans hand Lovable JSX with `className="text-sm"` in places. That diverges from the live 13px standard.

**Severity:** High for coherence. Every new component adds drift.

**Recommendation:** Append to parent spec §1 a "Design tokens" section that enumerates the type scale, color usage, spacing, border rules above. Each phase plan's Lovable prompt then opens with: "Before editing, read `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` §1 Design tokens. Use `text-[13px]` for body, `text-[11px]` for meta, shadcn semantic tokens for all colors."

**Plan edit target:** Parent spec §1, all three phase plans' Lovable prompts.

### Finding 5.2 — Badge variant sprawl

Plans introduce badges for: failure_category (11 values), regression_type (4 values), result_type (3 values), must_hold_risk (3 values), obligation source (2-3 values). Without a convention, each will pick its own `Badge` variant.

**Recommendation:** Single badge convention:
- Neutral-info (category labels, source): `variant="secondary"` + `text-[10px]` + `font-normal`.
- Status-success (STABLE, passed): `variant="outline"` with `text-emerald-600` (or semantic success token).
- Status-warning (NO_PROGRESS, medium risk): `variant="outline"` with `text-amber-600`.
- Status-danger (REGRESSION, failed, high risk): `variant="destructive"`.
- Status-positive-action (IMPROVEMENT): `variant="outline"` with `text-primary`.

Specify in parent spec §1. Cap total distinct visual badge styles at 5.

**Plan edit target:** Parent spec §1 + Phase C Task 1 RegressionTypeBadge.

### Finding 5.3 — "AgentOps" naming drift

Plans use "AgentOps" (live code) but the repo is `agent-contract-studio`. The parent spec's title says "frontend fixes and features." No single canonical product name referenced.

**Severity:** Low. Worth a one-line decision before shipping.

**Recommendation:** Non-blocking. Pick one — "AgentOps" (matches the live wordmark) or migrate to "Agent Contract Studio." Don't do it in this review cycle. Add a todo.

---

## Pass 6 — Responsive + Accessibility

### Parent spec non-goal (quoted): "full mobile responsive overhaul"

Interpretation: desktop-first is acceptable, but each new surface must have a defined minimum viable width and not catastrophically break below it.

### Finding 6.1 — `VersionDiff` side-by-side below 1280px

Phase C Task 3 shows two version cards side by side with a diff viewer. `react-diff-viewer-continued` at <900px content width collapses to single-column or truncates. Plan doesn't say.

**Recommendation:** Set minimum viable width for `VersionDiff` at 1024px. Below that, show a single-centered message: "Version compare works best on a wider screen. Rotate your device or open on desktop." Plan specifies this on Task 3 acceptance criteria.

### Finding 6.2 — 7-tile summary on tablet

Already covered in 2.3. Specify tile wrap at `sm:grid-cols-2`, `md:grid-cols-4`, `lg:grid-cols-7`.

### Finding 6.3 — Keyboard nav on filter chips

Phase C Task 1 `RegressionFilterChips` — plan doesn't specify keyboard behavior.

**Recommendation:** Chips are toggleable buttons. Keyboard: Tab focuses each, Space/Enter toggles, arrow keys don't move between (they're independent toggles, not a radio group). ARIA: `role="button"` + `aria-pressed={active}`. Specify in Task 1 acceptance criteria.

### Finding 6.4 — Focus trap on dialogs

All shadcn `Dialog` and `AlertDialog` have built-in focus trap. Confirm by testing, don't re-spec. No plan change needed — just add an a11y smoke test item to Phase A.4 regenerate dialog and Phase B.5 new eval run dialog acceptance criteria.

### Finding 6.5 — Touch targets ignored

Non-goal per spec. Skip.

### Finding 6.6 — ARIA labels on icon-only buttons

Plans show `<Button><Icon /></Button>` patterns (icon-only). No `aria-label`.

**Recommendation:** Parent spec §1 convention: icon-only buttons MUST have `aria-label="{action}"`. Add to the convention list.

---

## Pass 7 — Unresolved Design Decisions

These are genuine judgment calls, not oversights. Each deserves an AskUserQuestion to the product owner before implementing, but can be decided now and edited into the plans.

### Q1 — Sidebar IA: 4-item root (Option A) vs. agent-scoped tabs (Option B)

See Finding 1.1. **My recommendation: Option B (tabs inside agent detail).** Keeps sidebar clean; matches Linear/Vercel mental model.

### Q2 — Toast cadence for multi-action flows

Accept/reject on suggestion cards: silent, or per-click toast? **My recommendation: silent.** Only the final Apply fires a toast.

### Q3 — `VersionDiff` default tab

Plan says "Eval Delta" is default. Alternative: "Prompt" (most common reason to diff). **My recommendation: keep Eval Delta default** — this tool's purpose is quality, not authoring convenience. But add a URL param (`?tab=prompt`) to override.

### Q4 — Regeneration invalidation banner

Phase A.4 regenerates contract. Should the page show a banner on the `AgentDetail` eval section telling the user their last eval is now stale? **My recommendation: yes, see Finding 1.4 + 3.2.** Non-destructive banner, dismissable, based on contract_hash drift.

### Q5 — Deep mode improvements: opt-in or default?

Phase B Task 4 adds Standard/Deep toggle. Which is the default? Deep is 90s, Standard is 30s. **My recommendation: Standard default**, Deep opt-in via toggle. Reserve Deep for when Standard didn't produce enough suggestions.

### Q6 — Truncation rule for long obligation text

Contract panel (A.3) shows obligation text. If text > 200 chars, truncate with "show more" or show full? **My recommendation: full text, no truncation.** Density is fine — this is a reading surface, not a scanning one.

### Q7 — Phase C no_progress scaffold: ship hidden or ship visible with empty?

Backend doesn't return `no_progress[]` yet. Plan scaffolds the component. **My recommendation: ship hidden entirely** (feature-flag off). Visible empty state ("Coming soon") is SaaS cosplay — don't ship UI for features that don't exist.

---

## Summary of plan edits

Each finding above names a specific edit target. Consolidated:

### Parent spec `2026-04-18-frontend-fixes-and-features-design.md` §1

- Add "Design tokens" subsection: 13px/11px/10px type, shadcn semantic colors, `rounded-md`, `p-3/p-4`, 1px border default.
- Add "Empty state icon registry": one icon per surface.
- Add "Badge variant convention": 5 distinct styles, mapped.
- Add "Button label case": sentence case, not title case.
- Add "Icon-only button a11y": `aria-label` required.

### Phase A plan

- Task 1: Resolve sidebar IA decision (Q1). If Option B, remove Test Cases sidebar addition; add tabs inside AgentDetail instead (separate task).
- Task 3 (`ContractPanel`): On mount, force-expand panel if URL hash matches `#obligation-*` before `scrollIntoView`. Add to acceptance criteria.
- Task 4 (regenerate): Add banner spec on the eval section of `AgentDetail` for contract-hash drift.
- Task 5 (test case generate): Confirm progress UI pattern (indeterminate bar, expected range copy, no-cancel disclosure).

### Phase B plan

- Task 1 (suggestions): Add "no toast on per-suggestion accept/reject" to acceptance criteria.
- Task 3 (`EvalRunSummaryCard`): Specify tile priority (1-7), conditional rendering, grid wrap breakpoints. Add "Ran against contract v{hash-8}" badge.
- Task 4 (deep mode): Standard as default (Q5). Add progress-indicator spec for 60-90s wait.
- Task 5 (new eval run): Progress-indicator spec for 30-60s wait.

### Phase C plan

- Task 1 (`RegressionTypeBadge` + filter chips): Map 4 colors to shadcn semantic tokens. Add keyboard + ARIA spec for chips.
- Task 3 (`VersionDiff`):
  - Add 3-line summary strip above tabs.
  - Specify 1024px minimum viable width + narrow-screen fallback message.
  - Support `?tab=` URL param (Q3).
- Task 4 (`no_progress` scaffold): Ship feature-flagged OFF until backend lands field (Q7). Remove empty visible state.

### Non-blocking / future

- Breadcrumb component (Finding 1.3) → todo.
- Product naming (AgentOps vs Agent Contract Studio, Finding 5.3) → todo.

---

## Final rating (post-edits): 8.5 / 10

The plans after these edits: technically honest (where they already were), design-coherent (where they weren't), and have an explicit token/convention layer to keep Lovable prompts from drifting. The remaining 1.5 points are: mockups (skipped this round, regenerate with API key for 10/10), and a real DESIGN.md. Both are follow-ups, not blockers.

**Ship decision:** Proceed with Phase A implementation after applying the parent-spec §1 edits and Phase A edits above. Phases B and C edits can land just before each phase starts — they don't block A.
