# Phase C — Compare & Ship: Implementation Plan

> **For Lovable hand-off:** each task below contains a self-contained "Lovable prompt" block. Paste it into Lovable verbatim. After Lovable ships, verify acceptance criteria in the browser and commit before moving to the next task.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the comparison surface — regression-type rendering with filters, test-case ↔ obligation linkage, full version diff view, and `no_progress[]` rendering once backend lands.

**Architecture:** Builds on Plans A and B (types.ts, EmptyState, ApiError, ContractPanel from Plan A; EvalRunSummaryCard infrastructure from Plan B). Modifies `RegressionDashboard.tsx`, `TestCaseAgentList.tsx`, `TestCaseDetail.tsx`. Adds one large new page (`VersionDiff.tsx`) with sub-components.

**Tech Stack:** Same as Plans A and B. Adds `react-diff-viewer-continued` (or a similar diff library) for the diff view.

**Spec reference:** `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` §1 (conventions) and §4 (Phase C items).

**Pre-requisites:** Plans A and B must be merged. This plan reuses `ApiError`, `EmptyState`, `ContractV2`, `AgentSchema`, `ObligationV2`, `EvalRunSummary`, `EvalRunV2`, `EvalResultV2`.

**Backend blockers:**
- C.3 eval-delta tab needs `GET /agents/{id}/versions/{vid}/eval-runs?limit=1` (verify before starting; likely already supported).
- C.4 `no_progress[]` rendering is **BLOCKED on backend**: `routers/regression_v2.py:229-237` must include `no_progress: RegressionItem[]` in the response. Task 4 ships only after backend lands. No mock shim.

---

## File map

**Create:**
- `src/components/regression/RegressionTypeBadge.tsx` (Task 1)
- `src/components/diff/PromptDiff.tsx` (Task 3)
- `src/components/diff/SchemaDiff.tsx` (Task 3)
- `src/components/diff/ContractDiff.tsx` (Task 3)
- `src/components/diff/EvalDeltaDiff.tsx` (Task 3)
- `src/pages/VersionDiff.tsx` (Task 3)

**Modify:**
- `src/lib/types.ts` (Task 1) — add `RegressionType`; extend `EvalResultV2` with `regression_type`
- `src/lib/api.ts` (Task 3) — add `getLatestEvalRun` wrapper
- `src/pages/RegressionDashboard.tsx` (Tasks 1, 4) — render badges, filter chips, no_progress section
- `src/pages/TestCaseAgentList.tsx` (Task 2) — add Obligations column and obligation filter
- `src/pages/TestCaseDetail.tsx` (Task 2) — add "Covers obligations" section with deep links
- `src/pages/AgentDetail.tsx` (Task 3) — add "Compare versions" popover button in agent header
- `src/App.tsx` (Task 3) — add diff route

---

## Task 1: C.1 — Regression type per result

**Files:**
- Modify: `src/lib/types.ts` — add `RegressionType` and extend `EvalResultV2`
- Create: `src/components/regression/RegressionTypeBadge.tsx`
- Modify: `src/pages/RegressionDashboard.tsx` — render badges per row; add filter chip row above the list; counts reflect filter

### Lovable prompt

```
Add per-result regression-type rendering and filtering to the regression dashboard.

1. In src/lib/types.ts, add:

   export type RegressionType = "STABLE" | "REGRESSION" | "IMPROVEMENT" | "NO_PROGRESS";

   And extend the existing EvalResultV2 interface (added in Plan B Task 2):

   export interface EvalResultV2 {
     // ...existing fields from Plan B Task 2...
     regression_type?: RegressionType;
   }

2. Create src/components/regression/RegressionTypeBadge.tsx:

   import { Badge } from "@/components/ui/badge";
   import { ArrowDown, ArrowUp, Ban, Minus } from "lucide-react";
   import { RegressionType } from "@/lib/types";

   interface Props {
     type: RegressionType;
   }

   const config: Record<RegressionType, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof ArrowDown; className?: string }> = {
     STABLE:      { label: "Stable",      variant: "secondary",   icon: Minus },
     REGRESSION:  { label: "Regression",  variant: "destructive", icon: ArrowDown },
     IMPROVEMENT: { label: "Improvement", variant: "outline",     icon: ArrowUp,  className: "border-green-600 text-green-700" },
     NO_PROGRESS: { label: "No progress", variant: "outline",     icon: Ban,      className: "border-amber-600 text-amber-700" },
   };

   export function RegressionTypeBadge({ type }: Props) {
     const c = config[type];
     const Icon = c.icon;
     return (
       <Badge variant={c.variant} className={`text-[10px] gap-1 ${c.className ?? ""}`}>
         <Icon className="w-3 h-3" />
         {c.label}
       </Badge>
     );
   }

3. In src/pages/RegressionDashboard.tsx:

   (a) Add a piece of state for active filter chips:

       const [typeFilter, setTypeFilter] = useState<RegressionType[]>(["STABLE", "REGRESSION", "IMPROVEMENT", "NO_PROGRESS"]);

   (b) Above the existing results sections (Regressions, Improvements), render a filter chip row:

       <div className="flex flex-wrap gap-1.5 mb-4">
         {(["STABLE", "REGRESSION", "IMPROVEMENT", "NO_PROGRESS"] as RegressionType[]).map((t) => {
           const on = typeFilter.includes(t);
           return (
             <button
               key={t}
               onClick={() => setTypeFilter((cur) => on ? cur.filter((x) => x !== t) : [...cur, t])}
               className={`px-2 py-1 text-[11px] rounded border transition-colors ${on ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"}`}
             >
               <RegressionTypeBadge type={t} />
             </button>
           );
         })}
       </div>

       (Wrap the badge inside the button as a visual; the button itself handles the toggle.)

   (c) For each result row in the existing Regressions and Improvements sections, render a <RegressionTypeBadge type={result.regression_type ?? "STABLE"} /> next to the row's status indicator.

   (d) Apply the filter to whatever array drives each section:

       const filteredRegressions = regressions.filter((r) => typeFilter.includes(r.regression_type ?? "REGRESSION"));
       const filteredImprovements = improvements.filter((r) => typeFilter.includes(r.regression_type ?? "IMPROVEMENT"));

       Use these filtered arrays for both rendering and section count badges in the section headers.

   (e) The lines 381-389 block that renders `result.no_progress` conditionally: leave it for now — backend does not send it yet. Task 4 will replace this with full no_progress rendering once backend lands.

Do not add new API calls in this task.
```

### Acceptance criteria

- [ ] Each row in Regressions and Improvements sections shows a `RegressionTypeBadge`
- [ ] Filter chip row above the lists works: clicking a chip toggles its inclusion in the filter
- [ ] Section counts in headers update when the filter changes
- [ ] Default filter state has all four types selected
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase C.1: regression type badges + filter on dashboard"
```

---

## Task 2: C.2 — Test-case ↔ obligation linkage

**Files:**
- Modify: `src/pages/TestCaseAgentList.tsx` — add "Obligations" column; add obligation filter dropdown to filter bar
- Modify: `src/pages/TestCaseDetail.tsx` — add "Covers obligations" section with deep-link navigation to `AgentDetail.tsx`'s contract panel

### Lovable prompt

```
Surface the test-case ↔ obligation relationship.

1. In src/pages/TestCaseAgentList.tsx:

   (a) The page already fetches the contract for the active version (verify; if not, add a useQuery: api.getContractV2(agentId, activeVersionId) → ContractV2). Build a lookup:

       const obligationById = useMemo(() => {
         const map = new Map<string, ObligationV2>();
         (contract?.obligations ?? []).forEach((o) => map.set(o.id, o));
         return map;
       }, [contract]);

   (b) Add an "Obligations" column to the table (or list rows) for each test case. For each obligation_id on the test case, render:

       <Badge variant="outline" className="text-[10px] mr-1" title={obligationById.get(id)?.title ?? id}>
         {(obligationById.get(id)?.title ?? id).slice(0, 24)}
       </Badge>

       If there are more than 3 obligation badges, show first 3 then "+N more".

       If a test case has zero obligation_ids, render <span className="text-muted-foreground text-[10px]">—</span>.

   (c) Add an "Obligation" multi-select dropdown to the existing filter bar:

       const [obligationFilter, setObligationFilter] = useState<string[]>([]);

       <Select> ... not ideal for multi-select; instead use a popover with a list of checkboxes. Use this shape:

       <Popover>
         <PopoverTrigger asChild>
           <Button variant="outline" size="sm">
             Obligation {obligationFilter.length > 0 ? `(${obligationFilter.length})` : ""}
           </Button>
         </PopoverTrigger>
         <PopoverContent className="w-64 max-h-72 overflow-auto">
           <div className="space-y-1">
             {(contract?.obligations ?? []).map((o) => {
               const on = obligationFilter.includes(o.id);
               return (
                 <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer">
                   <Checkbox
                     checked={on}
                     onCheckedChange={(v) => setObligationFilter((cur) => v ? [...cur, o.id] : cur.filter((x) => x !== o.id))}
                   />
                   <span className="truncate">{o.title}</span>
                 </label>
               );
             })}
             {obligationFilter.length > 0 && (
               <Button variant="ghost" size="sm" onClick={() => setObligationFilter([])} className="w-full mt-2 text-xs">Clear</Button>
             )}
           </div>
         </PopoverContent>
       </Popover>

   (d) Apply the filter to the visible test case list (client-side):

       const visibleTestCases = testCases.filter((tc) => {
         if (obligationFilter.length === 0) return true;
         return obligationFilter.some((id) => tc.obligation_ids.includes(id));
       });

       Use visibleTestCases anywhere the page used to render testCases.

2. In src/pages/TestCaseDetail.tsx:

   (a) Fetch the contract for the test case's version (the test case detail response includes agent_version_id; use it):

       const contract = useQuery({
         queryKey: ['agent', testCase.agent_id, 'version', testCase.agent_version_id, 'contract'],
         queryFn: () => api.getContractV2(testCase.agent_id, testCase.agent_version_id),
         enabled: !!testCase,
       });

   (b) Add a new section "Covers obligations" between the existing input/expected sections and the trace section (or wherever fits the layout). For each obligation_id on the test case:

       const obligation = contract.data?.obligations.find((o) => o.id === id);
       if (!obligation) {
         return <Badge variant="outline" className="text-[10px]">{id}</Badge>;
       }
       return (
         <Link
           to={`/agents/${testCase.agent_id}#obligation-${obligation.id}`}
           className="inline-flex items-center gap-1 text-xs hover:underline"
           onClick={() => {
             // Defer scroll to next tick so the page has time to render
             setTimeout(() => {
               document.getElementById(`obligation-${obligation.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
             }, 100);
           }}
         >
           <span className="font-medium">{obligation.title}</span>
           <Badge variant="outline" className="text-[10px]">{obligation.failure_category}</Badge>
         </Link>
       );

       (The anchor `obligation-${id}` was added in Plan A Task 3 on each obligation row in ContractPanel. If you find it missing, add an `id={\`obligation-${o.id}\`}` to the obligation row's outer element in ContractPanel.tsx as part of this task.)

   (c) If testCase.obligation_ids is empty, render the "Covers obligations" header followed by <span className="text-muted-foreground text-xs">No obligations linked to this test case.</span>.

Do not change anything else in these files.
```

### Acceptance criteria

- [ ] On `TestCaseAgentList`, each test case row shows obligation badges (resolved to titles) or "—" if none
- [ ] More than 3 obligations on a row collapses to first 3 + "+N more"
- [ ] Obligation filter dropdown lists all obligations from the version's contract; selecting filters the list; "Clear" resets
- [ ] On `TestCaseDetail`, "Covers obligations" section renders with linked obligations
- [ ] Clicking an obligation in `TestCaseDetail` navigates to the agent detail page and scrolls to that obligation in the contract panel
- [ ] Test cases with no obligations render a clear "no obligations" hint on detail
- [ ] Test cases referencing obligation_ids that don't exist on the contract gracefully fall back to showing the id
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase C.2: test case ↔ obligation linkage"
```

---

## Task 3: C.3 — Version diff view (+ "Compare versions" button)

**Pre-task verification:** Confirm `GET /agents/{id}/versions/{vid}/eval-runs` returns the version's eval runs (and supports `?limit=1`). If not, file a backend ask for `?limit=1`. The eval-delta tab can ship anyway — it just falls back to fetching all runs and slicing — but the API surface needs to exist.

**Files:**
- Modify: `src/lib/api.ts` — add `getVersionEvalRuns` (lists eval runs for a version)
- Create: `src/components/diff/PromptDiff.tsx`
- Create: `src/components/diff/SchemaDiff.tsx`
- Create: `src/components/diff/ContractDiff.tsx`
- Create: `src/components/diff/EvalDeltaDiff.tsx`
- Create: `src/pages/VersionDiff.tsx`
- Modify: `src/App.tsx` — add diff route
- Modify: `src/pages/AgentDetail.tsx` — add "Compare versions" popover button in agent header

This task is large. Use `react-diff-viewer-continued` for the prompt and schema diffs. Install it if not present: `npm install react-diff-viewer-continued`.

### Lovable prompt

```
Add a version diff view.

1. Install react-diff-viewer-continued if not in package.json:
   npm install react-diff-viewer-continued

2. In src/lib/api.ts, add:

   getVersionEvalRuns: (agentId: string, versionId: string, limit?: number) => {
     const qs = limit ? `?limit=${limit}` : "";
     return request<EvalRunV2[]>(`/agents/${agentId}/versions/${versionId}/eval-runs${qs}`);
   },

3. Create src/components/diff/PromptDiff.tsx:

   import ReactDiffViewer from "react-diff-viewer-continued";

   interface Props {
     leftLabel: string;   // e.g. "v3"
     rightLabel: string;  // e.g. "v5"
     leftPrompt: string;
     rightPrompt: string;
   }

   export function PromptDiff({ leftLabel, rightLabel, leftPrompt, rightPrompt }: Props) {
     return (
       <div className="text-xs">
         <ReactDiffViewer
           oldValue={leftPrompt}
           newValue={rightPrompt}
           leftTitle={leftLabel}
           rightTitle={rightLabel}
           splitView
           useDarkTheme={false}
         />
       </div>
     );
   }

4. Create src/components/diff/SchemaDiff.tsx:

   import ReactDiffViewer from "react-diff-viewer-continued";
   import { AgentSchema } from "@/lib/types";

   interface Props {
     leftLabel: string;
     rightLabel: string;
     leftSchema: AgentSchema | null;
     rightSchema: AgentSchema | null;
   }

   export function SchemaDiff({ leftLabel, rightLabel, leftSchema, rightSchema }: Props) {
     const left = leftSchema ? JSON.stringify(leftSchema.schema_json, null, 2) : "(no schema)";
     const right = rightSchema ? JSON.stringify(rightSchema.schema_json, null, 2) : "(no schema)";
     return (
       <div className="text-xs">
         <ReactDiffViewer
           oldValue={left}
           newValue={right}
           leftTitle={leftLabel}
           rightTitle={rightLabel}
           splitView
           useDarkTheme={false}
         />
       </div>
     );
   }

5. Create src/components/diff/ContractDiff.tsx:

   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
   import { Badge } from "@/components/ui/badge";
   import { ContractV2 } from "@/lib/types";

   interface Props {
     leftLabel: string;
     rightLabel: string;
     leftContract: ContractV2 | null;
     rightContract: ContractV2 | null;
   }

   // Helper: classify items by id presence in each side.
   function classify<T extends { id?: string }>(left: T[], right: T[]) {
     const leftIds = new Set(left.map((x) => x.id ?? JSON.stringify(x)));
     const rightIds = new Set(right.map((x) => x.id ?? JSON.stringify(x)));
     const added = right.filter((x) => !leftIds.has(x.id ?? JSON.stringify(x)));
     const removed = left.filter((x) => !rightIds.has(x.id ?? JSON.stringify(x)));
     const inBoth = right.filter((x) => leftIds.has(x.id ?? JSON.stringify(x)));
     return { added, removed, inBoth };
   }

   export function ContractDiff({ leftLabel, rightLabel, leftContract, rightContract }: Props) {
     const sections = [
       { title: "Obligations", left: leftContract?.obligations ?? [], right: rightContract?.obligations ?? [], renderItem: (o: any) => <span><span className="font-medium">{o.title}</span> <Badge variant="outline" className="text-[10px]">{o.failure_category}</Badge></span> },
       { title: "Tool Sequences", left: leftContract?.tool_sequences ?? [], right: rightContract?.tool_sequences ?? [], renderItem: (s: any) => <span>{s.description} — {s.tool_names.join(" → ")}</span> },
       { title: "Forbidden Behaviors", left: leftContract?.forbidden_behaviors ?? [], right: rightContract?.forbidden_behaviors ?? [], renderItem: (b: any) => <span><Badge variant="destructive" className="text-[10px]">{b.behavior}</Badge> {b.description}</span> },
       { title: "Latency Budgets", left: leftContract?.latency_budgets ?? [], right: rightContract?.latency_budgets ?? [], renderItem: (l: any) => <span>{l.scope}: {l.budget_ms}ms — {l.rationale}</span> },
     ];

     return (
       <div className="space-y-4">
         <div className="text-xs text-muted-foreground">{leftLabel} → {rightLabel}</div>
         {sections.map((sec) => {
           const { added, removed, inBoth } = classify(sec.left as any, sec.right as any);
           return (
             <Card key={sec.title}>
               <CardHeader>
                 <CardTitle className="text-sm">{sec.title}</CardTitle>
               </CardHeader>
               <CardContent className="space-y-1 text-xs">
                 {added.length === 0 && removed.length === 0 && (
                   <p className="text-muted-foreground">No changes in this section.</p>
                 )}
                 {added.map((item, i) => (
                   <div key={`a-${i}`} className="border-l-2 border-green-500 pl-2 py-1 bg-green-50/40">
                     <span className="text-green-700 font-medium mr-2">+</span>
                     {sec.renderItem(item)}
                   </div>
                 ))}
                 {removed.map((item, i) => (
                   <div key={`r-${i}`} className="border-l-2 border-red-500 pl-2 py-1 bg-red-50/40">
                     <span className="text-red-700 font-medium mr-2">−</span>
                     {sec.renderItem(item)}
                   </div>
                 ))}
                 {inBoth.length > 0 && (
                   <details className="mt-2">
                     <summary className="cursor-pointer text-muted-foreground">Unchanged ({inBoth.length})</summary>
                     <div className="mt-1 space-y-1 pl-3 text-muted-foreground">
                       {inBoth.map((item, i) => <div key={`u-${i}`}>{sec.renderItem(item)}</div>)}
                     </div>
                   </details>
                 )}
               </CardContent>
             </Card>
           );
         })}
       </div>
     );
   }

6. Create src/components/diff/EvalDeltaDiff.tsx:

   import { useQuery } from "@tanstack/react-query";
   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
   import { Alert, AlertDescription } from "@/components/ui/alert";
   import { RegressionTypeBadge } from "@/components/regression/RegressionTypeBadge";
   import { api } from "@/lib/api";

   interface Props {
     agentId: string;
     leftVersionId: string;
     rightVersionId: string;
   }

   export function EvalDeltaDiff({ agentId, leftVersionId, rightVersionId }: Props) {
     const leftRuns = useQuery({
       queryKey: ['agent', agentId, 'version', leftVersionId, 'eval-runs', 'latest'],
       queryFn: () => api.getVersionEvalRuns(agentId, leftVersionId, 1),
     });
     const rightRuns = useQuery({
       queryKey: ['agent', agentId, 'version', rightVersionId, 'eval-runs', 'latest'],
       queryFn: () => api.getVersionEvalRuns(agentId, rightVersionId, 1),
     });

     if (leftRuns.isLoading || rightRuns.isLoading) return <p className="text-xs text-muted-foreground">Loading eval runs…</p>;

     const leftRun = leftRuns.data?.[0];
     const rightRun = rightRuns.data?.[0];

     if (!leftRun || !rightRun) {
       return (
         <Alert>
           <AlertDescription className="text-xs">
             Eval delta requires both versions to have at least one eval run. Missing: {!leftRun && "left"}{!leftRun && !rightRun && ", "}{!rightRun && "right"}.
           </AlertDescription>
         </Alert>
       );
     }

     const leftRate = leftRun.total_count > 0 ? Math.round((leftRun.pass_count / leftRun.total_count) * 100) : 0;
     const rightRate = rightRun.total_count > 0 ? Math.round((rightRun.pass_count / rightRun.total_count) * 100) : 0;
     const delta = rightRate - leftRate;

     return (
       <Card>
         <CardHeader>
           <CardTitle className="text-sm">Eval pass rate</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="grid grid-cols-3 gap-3 text-center text-xs">
             <div>
               <div className="text-muted-foreground">Left</div>
               <div className="text-2xl font-semibold">{leftRate}%</div>
               <div className="text-muted-foreground">{leftRun.pass_count}/{leftRun.total_count}</div>
             </div>
             <div>
               <div className="text-muted-foreground">Δ</div>
               <div className={`text-2xl font-semibold ${delta > 0 ? "text-green-600" : delta < 0 ? "text-destructive" : ""}`}>
                 {delta > 0 ? "+" : ""}{delta}%
               </div>
             </div>
             <div>
               <div className="text-muted-foreground">Right</div>
               <div className="text-2xl font-semibold">{rightRate}%</div>
               <div className="text-muted-foreground">{rightRun.pass_count}/{rightRun.total_count}</div>
             </div>
           </div>
           <p className="text-xs text-muted-foreground mt-3">
             Per-test-case regression breakdown can be opened from the Behavioral Check page for either run.
           </p>
         </CardContent>
       </Card>
     );
   }

7. Create src/pages/VersionDiff.tsx:

   import { useParams, Link } from "react-router-dom";
   import { useQuery } from "@tanstack/react-query";
   import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
   import { Button } from "@/components/ui/button";
   import { ChevronLeft } from "lucide-react";
   import { api, ApiError } from "@/lib/api";
   import { PromptDiff } from "@/components/diff/PromptDiff";
   import { SchemaDiff } from "@/components/diff/SchemaDiff";
   import { ContractDiff } from "@/components/diff/ContractDiff";
   import { EvalDeltaDiff } from "@/components/diff/EvalDeltaDiff";

   export default function VersionDiff() {
     const { agentId, versionId, otherVersionId } = useParams();

     if (!agentId || !versionId || !otherVersionId) return null;

     const versions = useQuery({ queryKey: ['agent', agentId, 'versions'], queryFn: () => api.getAgentVersions(agentId) });
     const left = versions.data?.find((v) => v.id === versionId);
     const right = versions.data?.find((v) => v.id === otherVersionId);

     const leftLabel = left ? `v${left.version_number}` : versionId.slice(0, 6);
     const rightLabel = right ? `v${right.version_number}` : otherVersionId.slice(0, 6);

     // Helper: turn 404 into null, rethrow other errors.
     const orNullOn404 = async <T,>(p: Promise<T>): Promise<T | null> => {
       try { return await p; } catch (e) {
         if (e instanceof ApiError && e.status === 404) return null;
         throw e;
       }
     };

     // Fetch schema/contract for each side. 404 → null (gracefully).
     const leftSchema = useQuery({
       queryKey: ['agent', agentId, 'schema'], // schema is currently agent-scoped; this returns the latest
       queryFn: () => orNullOn404(api.getSchema(agentId)),
     });
     // For schema diff, ideally we'd want per-version snapshots. Until backend supports that, both sides see the same schema — show a one-line note.

     const leftContract = useQuery({
       queryKey: ['agent', agentId, 'version', versionId, 'contract'],
       queryFn: () => orNullOn404(api.getContractV2(agentId, versionId)),
     });
     const rightContract = useQuery({
       queryKey: ['agent', agentId, 'version', otherVersionId, 'contract'],
       queryFn: () => orNullOn404(api.getContractV2(agentId, otherVersionId)),
     });

     return (
       <div className="p-6 max-w-6xl mx-auto">
         <div className="flex items-center gap-2 mb-4">
           <Button asChild variant="ghost" size="sm">
             <Link to={`/agents/${agentId}`}><ChevronLeft className="w-4 h-4" />Back to agent</Link>
           </Button>
         </div>
         <h1 className="text-lg font-semibold mb-1">Compare versions</h1>
         <p className="text-xs text-muted-foreground mb-4">{leftLabel} → {rightLabel}</p>

         <Tabs defaultValue="prompt">
           <TabsList>
             <TabsTrigger value="prompt">Prompt</TabsTrigger>
             <TabsTrigger value="schema">Schema</TabsTrigger>
             <TabsTrigger value="contract">Contract</TabsTrigger>
             <TabsTrigger value="eval">Eval delta</TabsTrigger>
           </TabsList>

           <TabsContent value="prompt" className="mt-4">
             <PromptDiff leftLabel={leftLabel} rightLabel={rightLabel} leftPrompt={left?.system_prompt ?? ""} rightPrompt={right?.system_prompt ?? ""} />
           </TabsContent>

           <TabsContent value="schema" className="mt-4">
             <p className="text-xs text-muted-foreground mb-2">Schema is currently agent-scoped on the backend; the same schema is shown on both sides until per-version schema snapshots are supported.</p>
             <SchemaDiff leftLabel={leftLabel} rightLabel={rightLabel} leftSchema={leftSchema.data ?? null} rightSchema={leftSchema.data ?? null} />
           </TabsContent>

           <TabsContent value="contract" className="mt-4">
             <ContractDiff leftLabel={leftLabel} rightLabel={rightLabel} leftContract={leftContract.data ?? null} rightContract={rightContract.data ?? null} />
           </TabsContent>

           <TabsContent value="eval" className="mt-4">
             <EvalDeltaDiff agentId={agentId} leftVersionId={versionId} rightVersionId={otherVersionId} />
           </TabsContent>
         </Tabs>
       </div>
     );
   }

8. In src/App.tsx, add inside <Routes>:

   <Route path="/agents/:agentId/versions/:versionId/diff/:otherVersionId" element={<VersionDiff />} />

   Add the import at the top.

9. In src/pages/AgentDetail.tsx, add a "Compare versions" button in the agent header, next to the version selector:

   <Popover>
     <PopoverTrigger asChild>
       <Button variant="outline" size="sm" disabled={(versions?.length ?? 0) < 2}>
         <GitCompare className="w-4 h-4 mr-1" /> Compare versions
       </Button>
     </PopoverTrigger>
     <PopoverContent className="w-64">
       <p className="text-xs text-muted-foreground mb-2">Compare current ({currentVersionLabel}) to:</p>
       <div className="space-y-1 max-h-60 overflow-auto">
         {(versions ?? []).filter((v) => v.id !== activeVersionId).map((v) => (
           <Button
             key={v.id}
             asChild
             variant="ghost"
             size="sm"
             className="w-full justify-start"
           >
             <Link to={`/agents/${agentId}/versions/${activeVersionId}/diff/${v.id}`}>
               v{v.version_number}{v.label ? ` — ${v.label}` : ""}
             </Link>
           </Button>
         ))}
       </div>
     </PopoverContent>
   </Popover>

   Import GitCompare from lucide-react.

Do not add a sidebar entry — version diff is always agent-scoped (per spec §4 C.3).
```

### Acceptance criteria

- [ ] `npm install react-diff-viewer-continued` added to package.json (or equivalent)
- [ ] On AgentDetail header: "Compare versions" button visible (disabled when only one version exists)
- [ ] Clicking it opens a popover listing other versions; selecting one navigates to the diff route
- [ ] Diff page loads with header "Compare versions" + "v{a} → v{b}"
- [ ] Prompt tab: side-by-side text diff renders
- [ ] Schema tab: schema JSON shown on both sides with the explanatory note about per-version snapshots
- [ ] Contract tab: 4 sub-cards render; added items in green, removed in red, "Unchanged" collapsible
- [ ] Eval delta tab: shows pass rate side-by-side and the delta number; if either version has no eval run, alert renders instead
- [ ] Browser back returns to agent detail
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase C.3: version diff view with prompt/schema/contract/eval tabs"
```

---

## Task 4: C.4 — `no_progress[]` rendering (BLOCKED on backend)

**Pre-task verification:** Confirm backend `routers/regression_v2.py` response now includes `no_progress: RegressionItem[]` alongside `regressions[]` and `improvements[]`. If not, **stop**: this task ships only after backend lands. Do not add a mock shim.

**Files:**
- Modify: `src/pages/RegressionDashboard.tsx` — add a third "No Progress" section beside Regressions and Improvements

### Lovable prompt

```
Render the no_progress[] section on the regression dashboard.

Pre-condition: backend /regression-run/latest response now includes a `no_progress` array (same item shape as `regressions` and `improvements`). Confirm with a network call before pasting this.

1. In src/pages/RegressionDashboard.tsx:

   (a) Wherever the page destructures the regression run response, add:

       const noProgress: any[] = result?.no_progress ?? [];

   (b) Below the existing Regressions and Improvements sections, add a third section in the same visual style:

       <Card>
         <CardHeader className="flex flex-row items-center justify-between">
           <div>
             <CardTitle className="text-sm flex items-center gap-2">
               <Ban className="w-4 h-4 text-amber-600" />
               No progress
             </CardTitle>
             <CardDescription>
               Test cases that failed before and still fail after this version.
             </CardDescription>
           </div>
           <Badge variant="outline" className="border-amber-600 text-amber-700">
             {filteredNoProgress.length}
           </Badge>
         </CardHeader>
         <CardContent>
           {filteredNoProgress.length === 0 ? (
             <EmptyState icon={Sparkles} title="Nothing stuck" description="No test cases are stuck failing across both versions." />
           ) : (
             <div className="space-y-2">
               {filteredNoProgress.map((r) => (
                 <ResultRow key={r.id} result={r} />
               ))}
             </div>
           )}
         </CardContent>
       </Card>

       Apply the existing typeFilter from C.1:

       const filteredNoProgress = noProgress.filter((r) => typeFilter.includes(r.regression_type ?? "NO_PROGRESS"));

       Reuse whatever ResultRow / row-rendering function the page already uses for the other two sections.

   (c) Remove the lines 381-389 conditional `result.no_progress` rendering — the new section above replaces it.

   (d) The summary header at the top of the page (if it shows total counts) should now also show the no-progress count from `summary.no_progress_count` (already in the summary).

Do not change the regression-type badge or filter chip code from C.1 in this task.
```

### Acceptance criteria

- [ ] Open the regression dashboard for a run where backend returns `no_progress` items → "No progress" section renders below Regressions and Improvements
- [ ] If `no_progress` is empty: section shows "Nothing stuck" empty state
- [ ] Filter chips from C.1 also filter the No Progress section (if NO_PROGRESS chip is off, the section's count drops to 0)
- [ ] Top-of-page summary (if present) reflects `no_progress_count` from the backend summary
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase C.4: render no_progress section on regression dashboard"
```

---

## End-of-phase smoke test

Run all of these in the browser before declaring Phase C complete:

1. **Regression badges + filter:** Open a regression run → each row in Regressions and Improvements shows a `RegressionTypeBadge`; filter chips toggle correctly; counts update.
2. **Test case list ↔ obligations:** `/test-cases` → each row shows obligation badges resolved to titles; obligation filter dropdown works; "+N more" collapses long lists.
3. **Test case detail ↔ obligations:** Open a test case → "Covers obligations" section renders; clicking an obligation navigates to AgentDetail and scrolls to the contract obligation row.
4. **Compare versions button:** AgentDetail header → "Compare versions" button (disabled with one version, enabled with ≥2); popover lists other versions; selecting one navigates to diff.
5. **Version diff — prompt tab:** Side-by-side text diff renders with proper highlighting.
6. **Version diff — schema tab:** Schema JSON renders both sides; explanatory note about per-version snapshots present.
7. **Version diff — contract tab:** 4 sub-cards (Obligations / Tool Sequences / Forbidden Behaviors / Latency Budgets); +/− coloring; "Unchanged" collapsible.
8. **Version diff — eval delta tab:** When both versions have eval runs, pass rate shown; delta colored. When one is missing, alert shown.
9. **(After backend lands)** No Progress section: renders on regression dashboard with the third card; filter chip from C.1 also affects this section.
10. **No regressions:** Phase A + Phase B pages still work as before.
11. **Build:** `npm run build` exits 0 with no TypeScript errors.

If all pass (and assuming Task 4 is shipped or backend pending), Phase C is complete and the entire spec is delivered.
