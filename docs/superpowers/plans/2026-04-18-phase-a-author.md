# Phase A — Author: Implementation Plan

> **For Lovable hand-off:** each task below contains a self-contained "Lovable prompt" block. Paste it into Lovable verbatim. After Lovable ships, verify acceptance criteria in the browser and commit before moving to the next task.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the agent-authoring surface — schema viewer, full V2 contract rendering, regenerate flow, and AI-driven test-case generation with user-controlled count. Remove dead code and add the Test Cases sidebar entry.

**Architecture:** All work in the existing `agent-contract-studio` repo. New types in `src/lib/types.ts` (created in Task 1). New API wrappers added to `src/lib/api.ts` alongside existing ones; `request<T>` updated to throw a typed `ApiError`. New components in `src/components/schema/`, `src/components/contract/`, `src/components/test-cases/`. New pages in `src/pages/`. Existing `AgentDetail.tsx` extended with a Schema button and an updated contract panel.

**Tech Stack:** React + Vite + TypeScript + Tailwind + shadcn-ui + React Query + React Router.

**Spec reference:** `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` §1 (conventions) and §2 (Phase A items).

**Backend (verified on `agentops-backend@v2-behavioral-contracts`):**
- `GET /agents/{id}/schema` → `AgentSchema {id, agent_id, schema_json, extracted_from_version_id (non-null), human_edited, created_at}`. 404 when no schema exists.
- `POST /agents/{id}/schema/extract?version_id={vid}` → returns `AgentSchema`. `version_id` optional (defaults to latest).
- **No `PATCH` endpoint** — schema editor ships read-only.
- `GET /agents/{id}/versions/{vid}/contract` → `ContractV2` (shape in Task 3).
- `POST /agents/{id}/versions/{vid}/contract/generate` → idempotent UPSERT; returns `ContractV2`. Returns 404 if no schema exists yet.
- `POST /agents/{id}/versions/{vid}/test-cases/generate?count={1..20}` → AI-generates and **replaces** all existing test cases for the version. Default count 15. Returns `{count, version_id, contract_id, test_cases}`. 404 if no contract.
- **No manual test case create endpoint exists.** A.5 is re-scoped to a "Configure & generate" form.

---

## File map

**Create:**
- `src/lib/types.ts` (Task 1)
- `src/components/EmptyState.tsx` (Task 1)
- `src/components/schema/SchemaPanel.tsx` (Task 2)
- `src/pages/AgentSchema.tsx` (Task 2)
- `src/components/contract/ContractPanel.tsx` (Task 3)
- `src/components/contract/RegenerateContractDialog.tsx` (Task 4)
- `src/components/test-cases/TestCaseGenerateForm.tsx` (Task 5)
- `src/pages/TestCaseGenerate.tsx` (Task 5)

**Modify:**
- `src/components/AppSidebar.tsx` (Task 1)
- `src/App.tsx` (Tasks 2, 5)
- `src/lib/api.ts` (Tasks 1, 2, 3, 4, 5)
- `src/pages/AgentDetail.tsx` (Tasks 2, 3, 4)
- `src/pages/TestCaseAgentList.tsx` (Task 5)

**Delete:**
- `src/pages/TestCaseList.tsx` (Task 1) — unreferenced
- Unused V1 wrappers in `api.ts` after Task 5 (Task 5 cleanup step)

---

## Task 1: A.1 — Cleanup prelude + shared infrastructure

Combines spec A.1 (delete dead code, add sidebar entry) with foundational pieces (shared types file, ApiError, EmptyState) every later task depends on.

**Files:**
- Delete: `src/pages/TestCaseList.tsx` (verify `App.tsx` does not import it; current state shows it does not — no route change needed)
- Modify: `src/components/AppSidebar.tsx` — add "Test Cases" nav item (route `/test-cases` already exists in `App.tsx`)
- Create: `src/lib/types.ts`
- Create: `src/components/EmptyState.tsx`
- Modify: `src/lib/api.ts` — add `ApiError` class; replace `request<T>` to throw `ApiError`

### Lovable prompt

````
Do four small things in this single change:

1. Delete the file src/pages/TestCaseList.tsx — it is unreferenced dead code. Verify by searching the repo for "TestCaseList" before deleting; the only result should be the file itself. Do NOT touch App.tsx (it does not import this file).

2. In src/components/AppSidebar.tsx, add a new nav item below "Agents":
   - Label: "Test Cases"
   - Path: "/test-cases"
   - Icon: ListChecks (from lucide-react — add the import)
   - Active when: path.startsWith("/test-cases") OR path matches /\/agents\/[^/]+\/test-cases\//
   Insert it between "Agents" and "Behavioral Check" so the order is: Agents → Test Cases → Behavioral Check.

3. Create a new file src/lib/types.ts with this content:

   // Shared TS types for V2 API endpoints. Add new types here as they are introduced.

   // 11 known categories from the backend failure taxonomy (v2-behavioral-contracts).
   // Open enum: backend may add categories.
   export type FailureCategory =
     | "COMMUNICATE_TOOL_DATA"
     | "INPUT_EXTRACTION"
     | "TOOL_TRIGGER"
     | "TOOL_OVERUSE"
     | "TOOL_ERROR_HANDLING"
     | "HALLUCINATION_GUARD"
     | "ESCALATION"
     | "GOAL_COMPLETION"
     | "PROCESS_SEQUENCE"
     | "LATENCY"
     | "REASONING_QUALITY"
     | string;

   // Other types added in subsequent tasks.

4. Create src/components/EmptyState.tsx as a reusable component:

   import { ReactNode } from "react";
   import { LucideIcon } from "lucide-react";

   interface EmptyStateProps {
     icon: LucideIcon;
     title: string;
     description?: string;
     action?: ReactNode;
   }

   export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
     return (
       <div className="flex flex-col items-center justify-center py-12 text-center">
         <Icon className="w-10 h-10 text-muted-foreground mb-3" />
         <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
         {description && <p className="text-xs text-muted-foreground max-w-sm mb-4">{description}</p>}
         {action}
       </div>
     );
   }

5. In src/lib/api.ts, replace the existing `request<T>` function (currently around lines 143-157) with this version that throws a typed ApiError, and export the class:

   export class ApiError extends Error {
     status: number;
     body?: unknown;
     constructor(status: number, message: string, body?: unknown) {
       super(message);
       this.name = "ApiError";
       this.status = status;
       this.body = body;
     }
   }

   async function request<T>(path: string, options?: RequestInit): Promise<T> {
     const res = await fetch(`${API_BASE}${path}`, {
       ...options,
       headers: {
         "Content-Type": "application/json",
         "ngrok-skip-browser-warning": "true",
         ...options?.headers,
       },
     });
     if (!res.ok) {
       const text = await res.text();
       let body: unknown = text;
       try { body = JSON.parse(text); } catch { /* keep as text */ }
       throw new ApiError(res.status, `API error ${res.status}: ${text.slice(0, 200)}`, body);
     }
     return res.json();
   }

Do not touch any other files. Do not modify any other API wrappers in this change.
````

### Acceptance criteria

- [ ] `src/pages/TestCaseList.tsx` no longer exists in the repo
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] App still loads at `/agents`; no console errors
- [ ] Sidebar shows three nav items in order: Agents → Test Cases → Behavioral Check
- [ ] Clicking "Test Cases" navigates to `/test-cases` and shows the existing `TestCaseAgentList` content
- [ ] `ApiError` is exported from `src/lib/api.ts` and `src/lib/types.ts` exists with the `FailureCategory` type
- [ ] `EmptyState` component renders without crashing in any consumer (no consumers yet — visual verification deferred to Task 2)

### Commit

```bash
git add -A
git commit -m "Phase A.1: cleanup, sidebar Test Cases, shared infra"
```

---

## Task 2: A.2 — Schema viewer (read-only)

**Files:**
- Modify: `src/lib/types.ts` — add `AgentSchema` type
- Modify: `src/lib/api.ts` — replace `getSchema` and `extractSchema` (currently `any`) with typed versions; add `versionId` param to `extractSchema`
- Create: `src/components/schema/SchemaPanel.tsx`
- Create: `src/pages/AgentSchema.tsx`
- Modify: `src/App.tsx` — add route `/agents/:agentId/versions/:versionId/schema`
- Modify: `src/pages/AgentDetail.tsx` — add a "Schema" button in the version header that navigates to the schema route for the active version

### Lovable prompt

````
Add a read-only schema viewer for agent versions.

1. In src/lib/types.ts, add (below the existing FailureCategory type):

   export interface AgentSchema {
     id: string;
     agent_id: string;
     schema_json: Record<string, unknown>;
     extracted_from_version_id: string;   // backend always sets this on extract; non-nullable
     human_edited: boolean;
     created_at: string;                   // backend uses created_at, NOT updated_at
   }

2. In src/lib/api.ts, replace the existing getSchema and extractSchema wrappers with typed versions:

   import { AgentSchema } from "./types";

   getSchema: (agentId: string) =>
     request<AgentSchema>(`/agents/${agentId}/schema`),

   extractSchema: (agentId: string, versionId?: string) => {
     const qs = versionId ? `?version_id=${versionId}` : "";
     return request<AgentSchema>(`/agents/${agentId}/schema/extract${qs}`, { method: "POST" });
   },

3. Create src/components/schema/SchemaPanel.tsx:

   import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
   import { ScrollArea } from "@/components/ui/scroll-area";
   import { Button } from "@/components/ui/button";
   import { Badge } from "@/components/ui/badge";
   import { Skeleton } from "@/components/ui/skeleton";
   import { Alert, AlertDescription } from "@/components/ui/alert";
   import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
   import { useToast } from "@/components/ui/use-toast";
   import { FileQuestion } from "lucide-react";
   import { api, ApiError } from "@/lib/api";
   import { EmptyState } from "@/components/EmptyState";

   interface Props {
     agentId: string;
     versionId: string;
   }

   export default function SchemaPanel({ agentId, versionId }: Props) {
     const qc = useQueryClient();
     const { toast } = useToast();

     const versionsQ = useQuery({
       queryKey: ['agent', agentId, 'versions'],
       queryFn: () => api.getAgentVersions(agentId),
     });

     const schemaQ = useQuery({
       queryKey: ['agent', agentId, 'schema'],
       queryFn: () => api.getSchema(agentId),
       retry: (failureCount, error) => {
         if (error instanceof ApiError && error.status === 404) return false;
         return failureCount < 2;
       },
     });

     const extractMut = useMutation({
       mutationFn: () => api.extractSchema(agentId, versionId),
       onSuccess: () => {
         qc.invalidateQueries({ queryKey: ['agent', agentId, 'schema'] });
         toast({ title: "Schema extracted" });
       },
       onError: (err: Error) => {
         toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
       },
     });

     if (schemaQ.isLoading) {
       return <Skeleton className="h-[60vh] w-full" />;
     }

     if (schemaQ.error instanceof ApiError && schemaQ.error.status === 404) {
       return (
         <EmptyState
           icon={FileQuestion}
           title="No schema yet"
           description="Extract a schema from this version's prompt and tool definitions."
           action={
             <Button onClick={() => extractMut.mutate()} disabled={extractMut.isPending}>
               {extractMut.isPending ? "Extracting…" : "Extract schema"}
             </Button>
           }
         />
       );
     }

     if (schemaQ.error) {
       return (
         <Alert variant="destructive">
           <AlertDescription>
             {(schemaQ.error as Error).message}
             <Button variant="ghost" size="sm" onClick={() => schemaQ.refetch()} className="ml-2">Retry</Button>
           </AlertDescription>
         </Alert>
       );
     }

     const schema = schemaQ.data!;
     const extractedFromVersion = versionsQ.data?.find((v) => v.id === schema.extracted_from_version_id);
     const showExtractedBadge = schema.extracted_from_version_id !== versionId;

     return (
       <div className="space-y-3">
         <div className="flex items-center gap-2 flex-wrap">
           {schema.human_edited && (
             <Badge variant="secondary">Edited by human</Badge>
           )}
           {showExtractedBadge && (
             <Badge variant="outline">
               Extracted from {extractedFromVersion ? `v${extractedFromVersion.version_number}` : "another version"}
             </Badge>
           )}
         </div>

         <ScrollArea className="h-[60vh] rounded border bg-muted/20 p-3">
           <pre className="text-xs"><code>{JSON.stringify(schema.schema_json, null, 2)}</code></pre>
         </ScrollArea>

         <Tooltip>
           <TooltipTrigger asChild>
             <span><Button variant="outline" size="sm" disabled>Edit schema</Button></span>
           </TooltipTrigger>
           <TooltipContent>Editing requires a backend PATCH endpoint — coming soon.</TooltipContent>
         </Tooltip>
       </div>
     );
   }

4. Create src/pages/AgentSchema.tsx:

   import { useParams, Link } from "react-router-dom";
   import { useQuery } from "@tanstack/react-query";
   import { Button } from "@/components/ui/button";
   import { ChevronLeft } from "lucide-react";
   import { api } from "@/lib/api";
   import SchemaPanel from "@/components/schema/SchemaPanel";

   export default function AgentSchema() {
     const { agentId, versionId } = useParams();
     if (!agentId || !versionId) return null;

     const versionsQ = useQuery({
       queryKey: ['agent', agentId, 'versions'],
       queryFn: () => api.getAgentVersions(agentId),
     });
     const version = versionsQ.data?.find((v) => v.id === versionId);
     const heading = version ? `Schema — v${version.version_number}` : "Schema";

     return (
       <div className="p-6 max-w-5xl mx-auto">
         <Button asChild variant="ghost" size="sm" className="mb-3">
           <Link to={`/agents/${agentId}`}><ChevronLeft className="w-4 h-4" />Back to agent</Link>
         </Button>
         <h1 className="text-lg font-semibold mb-4">{heading}</h1>
         <SchemaPanel agentId={agentId} versionId={versionId} />
       </div>
     );
   }

5. In src/App.tsx, add this route inside <Routes> next to the existing agent routes:

   <Route path="/agents/:agentId/versions/:versionId/schema" element={<AgentSchema />} />

   Add the import: import AgentSchema from "@/pages/AgentSchema";

6. In src/pages/AgentDetail.tsx, in the version header area (near the version selector), add a small button "Schema" that navigates to `/agents/${agentId}/versions/${activeVersionId}/schema`. Use the same Button styling as adjacent buttons. Place it visually beside the version dropdown.

Do not implement edit mode in this task — it stays disabled with the tooltip explanation.
````

### Acceptance criteria

- [ ] Navigate to an agent → click "Schema" → schema route opens
- [ ] If schema exists: pretty-printed JSON renders inside a scrollable area; badges show appropriately
- [ ] If schema does not exist (404): EmptyState with "Extract schema" button shows; clicking it calls the extract endpoint and the schema appears
- [ ] If `human_edited` is true: "Edited by human" badge visible
- [ ] If schema's `extracted_from_version_id` differs from current version: "Extracted from v{n}" badge visible (resolved to version number via the versions list)
- [ ] "Edit schema" button is disabled with tooltip explanation
- [ ] No TypeScript errors; no console errors
- [ ] Refreshing the page on the schema route still works (no white screen)

### Commit

```bash
git add -A
git commit -m "Phase A.2: schema viewer (read-only) with extract"
```

---

## Task 3: A.3 — Contract V2 surface

**Files:**
- Modify: `src/lib/types.ts` — add `ContractV2`, `ObligationV2`, `ToolSequence`, `ForbiddenBehavior`, `LatencyBudget`
- Modify: `src/lib/api.ts` — replace `getContractV2` and `generateContractV2` (currently `any`) with typed versions
- Create: `src/components/contract/ContractPanel.tsx`
- Modify: `src/pages/AgentDetail.tsx` — replace existing contract rendering with `<ContractPanel ...>`

### Lovable prompt

````
Replace the contract rendering in AgentDetail with a full V2 contract panel matching the verified backend shape.

1. In src/lib/types.ts, add (FailureCategory is already defined in this same file from Task 1, no import needed):

   // Contract item shapes verified against agentops-backend@v2-behavioral-contracts:
   // services/contract_generator.py and routers/contracts_v2.py.
   // Only obligations have an `id`. The other three item types are unkeyed.

   export interface ObligationV2 {
     id: string;
     text: string;
     source: "goal" | "behavioral" | "desired_behavior" | string;
     failure_category: FailureCategory;
   }

   export interface ToolSequence {
     scenario: string;
     sequence: string[];                  // ordered tool names
     failure_category: FailureCategory;
   }

   export interface ForbiddenBehavior {
     text: string;
     failure_category: FailureCategory;
   }

   export interface LatencyBudget {
     scenario: string;
     max_latency_ms: number;
     failure_category: FailureCategory;
   }

   export interface ContractV2 {
     id: string;
     agent_id: string;
     agent_version_id: string;
     obligations: ObligationV2[];
     tool_sequences: ToolSequence[];
     forbidden_behaviors: ForbiddenBehavior[];
     latency_budgets: LatencyBudget[];     // backend includes empty array even when none
     created_at: string;
   }

2. In src/lib/api.ts, replace getContractV2 and generateContractV2 with typed versions:

   import { ContractV2 } from "./types";

   getContractV2: (agentId: string, versionId: string) =>
     request<ContractV2>(`/agents/${agentId}/versions/${versionId}/contract`),

   generateContractV2: (agentId: string, versionId: string) =>
     request<ContractV2>(
       `/agents/${agentId}/versions/${versionId}/contract/generate`,
       { method: "POST" }
     ),

3. Create src/components/contract/ContractPanel.tsx:

   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
   import { Badge } from "@/components/ui/badge";
   import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
   import { ListX } from "lucide-react";
   import { ContractV2 } from "@/lib/types";
   import { EmptyState } from "@/components/EmptyState";

   interface Props {
     agentId: string;
     versionId: string;
     contract: ContractV2 | null;
   }

   export default function ContractPanel({ contract }: Props) {
     const c = contract;

     return (
       <div className="space-y-4">
         {/* Obligations */}
         <Card>
           <CardHeader>
             <CardTitle className="text-sm flex items-center gap-2">
               Obligations
               <Badge variant="outline" className="text-[10px]">{c?.obligations.length ?? 0}</Badge>
             </CardTitle>
           </CardHeader>
           <CardContent>
             {!c || c.obligations.length === 0 ? (
               <EmptyState icon={ListX} title="No obligations" />
             ) : (
               <ul className="space-y-3">
                 {c.obligations.map((o) => (
                   <li key={o.id} id={`obligation-${o.id}`} className="border-b last:border-0 pb-2">
                     <div className="flex items-start gap-2 flex-wrap">
                       <span className="font-medium text-sm flex-1">{o.text}</span>
                       <Badge variant="outline" className="text-[10px]">{o.failure_category}</Badge>
                       <Badge variant="secondary" className="text-[10px]">source: {o.source}</Badge>
                     </div>
                   </li>
                 ))}
               </ul>
             )}
           </CardContent>
         </Card>

         {/* Tool Sequences */}
         <Card>
           <CardHeader>
             <CardTitle className="text-sm flex items-center gap-2">
               Tool Sequences
               <Badge variant="outline" className="text-[10px]">{c?.tool_sequences.length ?? 0}</Badge>
             </CardTitle>
           </CardHeader>
           <CardContent>
             {!c || c.tool_sequences.length === 0 ? (
               <EmptyState icon={ListX} title="No tool sequences defined for this contract" />
             ) : (
               <ul className="space-y-3">
                 {c.tool_sequences.map((s, i) => (
                   <li key={i} className="border-b last:border-0 pb-2">
                     <div className="flex items-start gap-2 flex-wrap mb-1">
                       <span className="font-medium text-sm flex-1">{s.scenario}</span>
                       <Badge variant="outline" className="text-[10px]">{s.failure_category}</Badge>
                     </div>
                     <div className="flex items-center gap-1 flex-wrap">
                       {s.sequence.map((name, j) => (
                         <span key={j} className="flex items-center gap-1">
                           <Badge variant="secondary" className="text-[10px] font-mono">{name}</Badge>
                           {j < s.sequence.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                         </span>
                       ))}
                     </div>
                   </li>
                 ))}
               </ul>
             )}
           </CardContent>
         </Card>

         {/* Forbidden Behaviors */}
         <Card>
           <CardHeader>
             <CardTitle className="text-sm flex items-center gap-2">
               Forbidden Behaviors
               <Badge variant="outline" className="text-[10px]">{c?.forbidden_behaviors.length ?? 0}</Badge>
             </CardTitle>
           </CardHeader>
           <CardContent>
             {!c || c.forbidden_behaviors.length === 0 ? (
               <EmptyState icon={ListX} title="No forbidden behaviors defined" />
             ) : (
               <ul className="space-y-2">
                 {c.forbidden_behaviors.map((b, i) => (
                   <li key={i} className="flex items-start gap-2 flex-wrap">
                     <Badge variant="destructive" className="text-[10px]">{b.text}</Badge>
                     <Badge variant="outline" className="text-[10px] ml-auto">{b.failure_category}</Badge>
                   </li>
                 ))}
               </ul>
             )}
           </CardContent>
         </Card>

         {/* Latency Budgets */}
         <Card>
           <CardHeader>
             <CardTitle className="text-sm flex items-center gap-2">
               Latency Budgets
               <Badge variant="outline" className="text-[10px]">{c?.latency_budgets.length ?? 0}</Badge>
             </CardTitle>
           </CardHeader>
           <CardContent>
             {!c || c.latency_budgets.length === 0 ? (
               <EmptyState icon={ListX} title="No latency budgets defined" />
             ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Scenario</TableHead>
                     <TableHead>Max latency (ms)</TableHead>
                     <TableHead>Failure category</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {c.latency_budgets.map((l, i) => (
                     <TableRow key={i}>
                       <TableCell>{l.scenario}</TableCell>
                       <TableCell className="font-mono">{l.max_latency_ms}</TableCell>
                       <TableCell><Badge variant="outline" className="text-[10px]">{l.failure_category}</Badge></TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             )}
           </CardContent>
         </Card>
       </div>
     );
   }

4. In src/pages/AgentDetail.tsx, find the existing contract rendering block (search for the section that renders obligations from the legacy V1 Contract type — it currently uses `Contract.obligations` and `Contract.tool_stubs`). Replace it with:

   <ContractPanel agentId={agentId} versionId={activeVersionId} contract={contractV2 ?? null} />

   Add a useQuery for ContractV2 alongside any existing one:

   const contractV2Q = useQuery({
     queryKey: ['agent', agentId, 'version', activeVersionId, 'contract'],
     queryFn: () => api.getContractV2(agentId, activeVersionId),
     retry: (failureCount, error) => {
       if (error instanceof ApiError && error.status === 404) return false;
       return failureCount < 2;
     },
   });
   const contractV2 = contractV2Q.data;

   Wrap <ContractPanel> rendering in a Skeleton while loading. If 404, render <ContractPanel ... contract={null} /> so empty states show.

Do not touch the contract generation buttons in this task — Task 4 will fix the "Generate Contract" button.
````

### Acceptance criteria

- [ ] Open an agent with a V2 contract → all four sections render (Obligations / Tool Sequences / Forbidden Behaviors / Latency Budgets)
- [ ] Each obligation shows its text, `failure_category` badge, and `source: ...` badge
- [ ] Each tool sequence shows `scenario`, `failure_category`, and tool names joined by → arrows
- [ ] Forbidden behaviors render with destructive badges and category badges
- [ ] Latency budgets render as a table with Scenario | Max latency (ms) | Failure category
- [ ] Empty arrays render the appropriate empty state per section
- [ ] Open an agent without a V2 contract (404) → no crash; empty states render
- [ ] Each obligation row has `id="obligation-{id}"` (verify in DOM inspector — used by Phase C deep links)
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase A.3: render full V2 contract surface"
```

---

## Task 4: A.4 — Regenerate contract dialog

**Files:**
- Modify: `src/lib/api.ts` — add `regenerateContract` (same endpoint as `generateContractV2`, distinct name for call-site clarity)
- Create: `src/components/contract/RegenerateContractDialog.tsx`
- Modify: `src/pages/AgentDetail.tsx` — fix the "Generate Contract" button: when contract exists, button becomes "Regenerate Contract" and opens the dialog

### Lovable prompt

````
Fix the "Generate Contract" button so it can regenerate, and add a confirmation dialog.

1. In src/lib/api.ts, add (alongside generateContractV2):

   regenerateContract: (agentId: string, versionId: string) =>
     request<ContractV2>(
       `/agents/${agentId}/versions/${versionId}/contract/generate`,
       { method: "POST" }
     ),

   It is intentionally the same endpoint as generateContractV2 — the distinct name makes call sites self-documenting (regenerate = "I know a contract exists; replace it").

2. Create src/components/contract/RegenerateContractDialog.tsx:

   import { useState, ReactNode } from "react";
   import { useMutation, useQueryClient } from "@tanstack/react-query";
   import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
   import { useToast } from "@/components/ui/use-toast";
   import { api, ApiError } from "@/lib/api";

   interface Props {
     agentId: string;
     versionId: string;
     trigger: ReactNode;
   }

   export function RegenerateContractDialog({ agentId, versionId, trigger }: Props) {
     const [open, setOpen] = useState(false);
     const qc = useQueryClient();
     const { toast } = useToast();

     const mutation = useMutation({
       mutationFn: () => api.regenerateContract(agentId, versionId),
       onSuccess: () => {
         qc.invalidateQueries({ queryKey: ['agent', agentId, 'version', versionId, 'contract'] });
         toast({ title: "Contract regenerated" });
         setOpen(false);
       },
       onError: (err: Error) => {
         // Friendly message for the "no schema" 404 case
         const isNoSchema = err instanceof ApiError && err.status === 404 && /schema/i.test(err.message);
         toast({
           title: "Regeneration failed",
           description: isNoSchema
             ? "Extract a schema from this version first (Schema tab)."
             : err.message,
           variant: "destructive",
         });
         // Keep dialog open on error.
       },
     });

     return (
       <AlertDialog open={open} onOpenChange={setOpen}>
         <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Regenerate this contract?</AlertDialogTitle>
             <AlertDialogDescription>
               Existing test cases may need to be re-evaluated against the new contract. Locked test cases stay locked, but their pass/fail outcomes can change. This action cannot be undone.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={(e) => { e.preventDefault(); mutation.mutate(); }}
               disabled={mutation.isPending}
             >
               {mutation.isPending ? "Regenerating…" : "Regenerate"}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     );
   }

3. In src/pages/AgentDetail.tsx, find the existing "Generate Contract" button. It is currently disabled permanently once a contract exists. Change to:

   - When no contract exists (contractV2 == null): button label "Generate Contract", calls api.generateContractV2 directly, shows loading state while pending.
   - When contract exists (contractV2 != null): button label "Regenerate Contract", wrapped in <RegenerateContractDialog ...> with the button as the trigger. Button is enabled.

   JSX:

   {contractV2 ? (
     <RegenerateContractDialog
       agentId={agentId}
       versionId={activeVersionId}
       trigger={<Button variant="outline" size="sm">Regenerate Contract</Button>}
     />
   ) : (
     <Button
       size="sm"
       onClick={() => generateContractMutation.mutate()}
       disabled={generateContractMutation.isPending}
     >
       {generateContractMutation.isPending ? "Generating…" : "Generate Contract"}
     </Button>
   )}

   If generateContractMutation does not already exist, add one using api.generateContractV2 with invalidation of ['agent', agentId, 'version', activeVersionId, 'contract'].

Do not change any other contract-related code in this task.
````

### Acceptance criteria

- [ ] On an agent without a contract: "Generate Contract" button works as before
- [ ] On an agent with a contract: button now reads "Regenerate Contract" and is **enabled**
- [ ] Clicking "Regenerate Contract" opens the confirmation dialog with the warning copy
- [ ] Cancel closes the dialog with no API call
- [ ] Confirm calls the API; loading state shows "Regenerating…"; on success, contract refreshes and a success toast appears; on error, toast shows error message and dialog stays open
- [ ] If the agent has no schema, the toast points to the Schema tab instead of showing the raw 404 message
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase A.4: regenerate contract dialog"
```

---

## Task 5: A.5 — Configure & generate test cases

**Re-scoped from "manual creation" because backend has NO manual create endpoint** — only `POST /agents/{id}/versions/{vid}/test-cases/generate?count={n}` exists, and it deletes-and-replaces all existing test cases for the version. This task surfaces a configure step (set count, see warning, confirm) before firing the generation.

**Files:**
- Modify: `src/lib/types.ts` — add `TestCaseV2`, `Assertion`, `ToolStub`, `GenerateTestCasesResponse`
- Modify: `src/lib/api.ts` — replace `generateTestCasesV2` (currently `any` and ignores count) with typed version that accepts `count`; replace `getTestCasesV2` with typed version
- Create: `src/components/test-cases/TestCaseGenerateForm.tsx`
- Create: `src/pages/TestCaseGenerate.tsx`
- Modify: `src/App.tsx` — add route `/agents/:agentId/versions/:versionId/test-cases/generate`
- Modify: `src/pages/TestCaseAgentList.tsx` — replace any direct "Generate" POST trigger with a link to the new configure page
- Modify: `src/lib/api.ts` (cleanup at the end) — delete unused V1 wrappers after grep

### Lovable prompt

````
Add a "Configure & generate" page for test cases. Backend reality: the generate endpoint is destructive — it deletes-and-replaces all existing test cases for the version. The configure page surfaces a count slider and an explicit warning before firing the request.

1. In src/lib/types.ts, add (FailureCategory already exists from Task 1):

   export interface ToolStubV2 {
     response: Record<string, unknown>;
     latency_ms: number;
     simulate_failure: boolean;
   }

   export interface AssertionV2 {
     id: string;
     type: "tool_called" | "tool_not_called" | "param_contains" | "output_contains" | "max_latency_ms" | "tool_sequence" | string;
     tool?: string | null;
     param?: string | null;
     value?: string | null;
     required: boolean;
   }

   export interface TestCaseV2 {
     id: string;
     agent_id: string;
     agent_version_id: string;
     contract_id: string;
     scenario: string;
     input_text: string;                          // backend uses input_text, NOT input
     tool_stubs: Record<string, ToolStubV2>;
     assertions: AssertionV2[];
     obligation_ids: string[];
     tags: string[];
     locked: boolean;
     locked_at_pass: number | null;
     locked_at_version_id: string | null;
     created_at: string;
   }

   export interface GenerateTestCasesResponse {
     count: number;
     version_id: string;
     contract_id: string;
     test_cases: TestCaseV2[];
   }

2. In src/lib/api.ts, replace the existing generateTestCasesV2 and getTestCasesV2 wrappers:

   import { TestCaseV2, GenerateTestCasesResponse } from "./types";

   generateTestCasesV2: (agentId: string, versionId: string, count: number = 15) =>
     request<GenerateTestCasesResponse>(
       `/agents/${agentId}/versions/${versionId}/test-cases/generate?count=${count}`,
       { method: "POST" }
     ),

   getTestCasesV2: (agentId: string, versionId: string) =>
     request<TestCaseV2[]>(`/agents/${agentId}/versions/${versionId}/test-cases`),

3. Create src/components/test-cases/TestCaseGenerateForm.tsx:

   import { useState } from "react";
   import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
   import { useNavigate, Link } from "react-router-dom";
   import { Button } from "@/components/ui/button";
   import { Input } from "@/components/ui/input";
   import { Label } from "@/components/ui/label";
   import { Slider } from "@/components/ui/slider";
   import { Alert, AlertDescription } from "@/components/ui/alert";
   import { useToast } from "@/components/ui/use-toast";
   import { api, ApiError } from "@/lib/api";

   interface Props {
     agentId: string;
     versionId: string;
   }

   export function TestCaseGenerateForm({ agentId, versionId }: Props) {
     const nav = useNavigate();
     const qc = useQueryClient();
     const { toast } = useToast();
     const [count, setCount] = useState(15);

     const contractQ = useQuery({
       queryKey: ['agent', agentId, 'version', versionId, 'contract'],
       queryFn: () => api.getContractV2(agentId, versionId),
       retry: (n, err) => !(err instanceof ApiError && err.status === 404) && n < 2,
     });

     const existingQ = useQuery({
       queryKey: ['agent', agentId, 'version', versionId, 'test-cases'],
       queryFn: () => api.getTestCasesV2(agentId, versionId),
     });

     const mutation = useMutation({
       mutationFn: () => api.generateTestCasesV2(agentId, versionId, count),
       onSuccess: (resp) => {
         qc.invalidateQueries({ queryKey: ['agent', agentId, 'version', versionId, 'test-cases'] });
         toast({ title: `Generated ${resp.count} test cases` });
         nav(-1);
       },
       onError: (err: Error) => {
         toast({ title: "Generation failed", description: err.message, variant: "destructive" });
       },
     });

     const noContract = contractQ.error instanceof ApiError && contractQ.error.status === 404;
     const existingCount = existingQ.data?.length ?? 0;

     return (
       <div className="space-y-5 max-w-xl">
         {noContract && (
           <Alert variant="destructive">
             <AlertDescription>
               No contract found for this version. <Link to={`/agents/${agentId}`} className="underline">Generate a contract first</Link>, then come back here.
             </AlertDescription>
           </Alert>
         )}

         {existingCount > 0 && (
           <Alert variant="destructive">
             <AlertDescription>
               This will <strong>delete the {existingCount} existing test case{existingCount === 1 ? "" : "s"}</strong> for this version and replace them with newly generated ones. Locked status is lost. This cannot be undone.
             </AlertDescription>
           </Alert>
         )}

         <div className="space-y-2">
           <Label htmlFor="count">How many test cases?</Label>
           <div className="flex items-center gap-3">
             <Slider
               id="count"
               min={1}
               max={20}
               step={1}
               value={[count]}
               onValueChange={(v) => setCount(v[0])}
               className="flex-1"
             />
             <Input
               type="number"
               min={1}
               max={20}
               value={count}
               onChange={(e) => {
                 const n = parseInt(e.target.value, 10);
                 if (!isNaN(n)) setCount(Math.min(20, Math.max(1, n)));
               }}
               className="w-20"
             />
           </div>
           <p className="text-xs text-muted-foreground">Backend cap is 20. Generation typically takes 10-30 seconds.</p>
         </div>

         <div className="flex gap-2">
           <Button
             onClick={() => mutation.mutate()}
             disabled={mutation.isPending || noContract}
           >
             {mutation.isPending ? "Generating…" : `Generate ${count} test case${count === 1 ? "" : "s"}`}
           </Button>
           <Button type="button" variant="outline" onClick={() => nav(-1)} disabled={mutation.isPending}>Cancel</Button>
         </div>
       </div>
     );
   }

4. Create src/pages/TestCaseGenerate.tsx:

   import { useParams, Link } from "react-router-dom";
   import { Button } from "@/components/ui/button";
   import { ChevronLeft } from "lucide-react";
   import { TestCaseGenerateForm } from "@/components/test-cases/TestCaseGenerateForm";

   export default function TestCaseGenerate() {
     const { agentId, versionId } = useParams();
     if (!agentId || !versionId) return null;
     return (
       <div className="p-6 max-w-3xl mx-auto">
         <Button asChild variant="ghost" size="sm" className="mb-3">
           <Link to={`/agents/${agentId}`}><ChevronLeft className="w-4 h-4" />Back to agent</Link>
         </Button>
         <h1 className="text-lg font-semibold mb-1">Configure & generate test cases</h1>
         <p className="text-xs text-muted-foreground mb-5">Test cases are generated by the backend AI from this version's contract. Adjust the count below.</p>
         <TestCaseGenerateForm agentId={agentId} versionId={versionId} />
       </div>
     );
   }

5. In src/App.tsx, add inside <Routes>:

   <Route path="/agents/:agentId/versions/:versionId/test-cases/generate" element={<TestCaseGenerate />} />

   Add the import: import TestCaseGenerate from "@/pages/TestCaseGenerate";

6. In src/pages/TestCaseAgentList.tsx, find any existing "Generate" button on the page header that fires an immediate POST to /test-cases/generate. Replace it with a link to the configure page:

   <Button asChild size="sm">
     <Link to={`/agents/${agentId}/versions/${activeVersionId}/test-cases/generate`}>
       Generate test cases
     </Link>
   </Button>

   Use the existing variable names for agentId and the active version id from that page (whatever state currently drives the generate button).

7. After the above ships and you've smoke-tested it, do this cleanup pass on src/lib/api.ts:

   For each of these legacy V1 wrappers, search the repo for usages. If a wrapper has zero callers, delete its definition from api.ts:
   - generateTestCases (V1 — different from generateTestCasesV2)
   - getTestCases (V1)
   - getTestCase (V1)

   Re-run `npm run build` to confirm no breakage.
````

### Acceptance criteria

- [ ] Backend reality verified: there is no manual create endpoint; only the destructive generate endpoint exists. Plan acknowledges this.
- [ ] On `TestCaseAgentList`, the "Generate test cases" button links to the configure page (does not fire a POST directly)
- [ ] Configure page: count slider works (1-20); count input is clamped to that range
- [ ] If no contract exists for the version, the page shows a destructive alert with a link to the agent detail; generate button is disabled
- [ ] If existing test cases exist, the page shows the "will delete X" warning with the correct count
- [ ] Submit fires `POST /test-cases/generate?count={count}`; verify in network tab; on success, the list page shows the new cases (after invalidation); toast confirms count
- [ ] Long-running mutation (~10-30s): button shows "Generating…" + disabled; cancel button also disabled
- [ ] Submission failure shows a destructive toast and keeps the form open
- [ ] No TypeScript errors; no console errors
- [ ] Cleanup pass: V1 test-case wrappers with zero usages are removed from `api.ts`; `npm run build` passes

### Commit

```bash
git add -A
git commit -m "Phase A.5: configure & generate test cases form"
```

---

## End-of-phase smoke test

Run all of these in the browser before declaring Phase A complete:

1. **Sidebar:** Three entries — Agents, Test Cases, Behavioral Check. Test Cases entry navigates to `/test-cases`.
2. **Schema:** From an agent detail page, click "Schema" → schema page opens. If schema exists, JSON renders with correct badges. If not, "Extract schema" works.
3. **Contract surface:** On an agent with a contract, all four sections render with verified field shapes (text/source/sequence/max_latency_ms). Empty arrays show empty states.
4. **Regenerate:** "Regenerate Contract" enabled when contract exists; dialog warns; confirm refreshes panel; no-schema error shows friendly toast.
5. **Configure & generate:** "Generate test cases" link → configure page → adjust count → submit → list refreshes with new cases (existing ones replaced). No-contract state and existing-cases warning both work.
6. **No regressions:** AgentList, AgentDetail, AgentUpload, TestCaseDetail, EvalRunHistory, RegressionDashboard all still load without console errors.
7. **Build:** `npm run build` exits 0 with no TypeScript errors.

If all pass, Phase A is shipped. Move to Plan B.

---

## Design review (2026-04-18, text-only — mockups skipped)

Full review: `docs/superpowers/reviews/2026-04-18-plan-design-review.md`. Pre-ship edits affecting this plan:

- **Task 1 (sidebar IA, Q1):** Decide 4-item root vs. agent-scoped tabs. Recommendation = tabs inside `AgentDetail` (Option B). Remove Test Cases sidebar addition if Option B.
- **Task 3 (ContractPanel deep-link fragility, Finding 1.2):** On mount, if `location.hash` matches `#obligation-*`, force-expand the contract panel AND the Obligations card BEFORE `scrollIntoView`.
- **Task 4 (regenerate banner, Finding 1.4 / 3.2):** Add dismissable banner on `AgentDetail` eval section when `contract_hash` has drifted since last eval.
- **Task 5 (progress UI, Finding 2.1):** Indeterminate progress bar, "usually 30-60s, don't close this tab", 45s escalation copy, no cancel button.

Parent-spec §1 additions (design tokens, badge variants, button label case, icon-only a11y) must land before these.
