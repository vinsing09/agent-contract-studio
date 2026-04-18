# Phase A — Author: Implementation Plan

> **For Lovable hand-off:** each task below contains a self-contained "Lovable prompt" block. Paste it into Lovable verbatim. After Lovable ships, verify acceptance criteria in the browser and commit before moving to the next task.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the agent-authoring surface — schema viewer, full V2 contract rendering, regenerate flow, and manual test case creation. Remove dead code and add the Test Cases sidebar entry.

**Architecture:** All work in the existing `agent-contract-studio` repo. New types in `src/lib/types.ts` (file to be created in Task 1). New API wrappers added to `src/lib/api.ts` alongside existing ones. New components in `src/components/schema/`, `src/components/contract/`, `src/components/test-cases/`. New pages in `src/pages/`. Existing `AgentDetail.tsx` extended with a Schema tab and an updated contract panel.

**Tech Stack:** React + Vite + TypeScript + Tailwind + shadcn-ui + React Query + React Router + react-hook-form + zod (verify zod is present; if not, add).

**Spec reference:** `docs/superpowers/specs/2026-04-18-frontend-fixes-and-features-design.md` §1 (conventions) and §2 (Phase A items).

**Backend blockers (this plan ships around them):**
- A.2 schema *edit* mode requires `PATCH /agents/{id}/schema` (not yet on backend) — schema panel ships **read-only + extract** in this plan; edit mode added in a follow-up plan once backend lands.
- A.5 manual test case creation requires `POST /agents/{id}/versions/{vid}/test-cases` — verify before starting Task 5; if absent, file backend ask and skip Task 5 until it lands.

---

## File map

**Create:**
- `src/lib/types.ts` — shared TS types for new endpoints (created in Task 1)
- `src/components/EmptyState.tsx` — reusable empty-state component (created in Task 1)
- `src/components/schema/SchemaPanel.tsx` (Task 2)
- `src/pages/AgentSchema.tsx` (Task 2)
- `src/components/contract/ContractPanel.tsx` (Task 3)
- `src/components/contract/RegenerateContractDialog.tsx` (Task 4)
- `src/components/test-cases/TestCaseForm.tsx` (Task 5)
- `src/pages/TestCaseNew.tsx` (Task 5)

**Modify:**
- `src/components/AppSidebar.tsx` (Task 1) — add "Test Cases" nav item
- `src/App.tsx` (Tasks 1, 2, 5) — drop dead route, add new routes
- `src/lib/api.ts` (Tasks 2, 3, 4, 5) — add new wrappers, define `ApiError`, replace `request` to throw `ApiError`
- `src/pages/AgentDetail.tsx` (Tasks 2, 3, 4) — add Schema tab/button, swap contract rendering, fix regenerate button label/disabled state

**Delete:**
- `src/pages/TestCaseList.tsx` (Task 1)
- Any V1 `api.ts` wrappers that become unreferenced after Task 5 (Task 5 cleanup step)

---

## Task 1: A.1 — Cleanup prelude + shared infrastructure

Combines the spec's A.1 (delete dead code, add sidebar entry) with the foundational pieces (shared types file, ApiError, EmptyState) that the rest of the plan depends on.

**Files:**
- Delete: `src/pages/TestCaseList.tsx`
- Modify: `src/App.tsx` (no changes if `TestCaseList` is not imported; verify and remove import + route if present — current state per `App.tsx:13` shows it's NOT imported, so no change expected)
- Modify: `src/components/AppSidebar.tsx` — add "Test Cases" nav item (route `/test-cases` already exists at `App.tsx:30`)
- Create: `src/lib/types.ts`
- Create: `src/components/EmptyState.tsx`
- Modify: `src/lib/api.ts` — add `ApiError` class; update `request<T>` (line 143-157) to throw `ApiError` instead of `Error`

### Lovable prompt

```
Do four small things in this single change:

1. Delete the file src/pages/TestCaseList.tsx — it is unreferenced dead code (verify by searching the repo for "TestCaseList" before deleting; the only result should be the file itself).

2. In src/components/AppSidebar.tsx, add a new nav item below "Behavioral Check":
   - Label: "Test Cases"
   - Path: "/test-cases"
   - Icon: ListChecks (from lucide-react — add the import)
   - Active when: path.startsWith("/test-cases") OR path matches /\/agents\/[^/]+\/test-cases\//
   Insert it between "Agents" and "Behavioral Check" so the order is: Agents → Test Cases → Behavioral Check.

3. Create a new file src/lib/types.ts with this content:

   // Shared TS types for V2 API endpoints. Add new types here as they're introduced.

   export type FailureCategory =
     | "COMMUNICATE_TOOL_DATA"
     | "INPUT_EXTRACTION"
     | "TOOL_TRIGGER"
     | "TOOL_OVERUSE"
     | "PROCESS_SEQUENCE"
     | "LATENCY"
     | "HALLUCINATION_GUARD"
     | "ESCALATION"
     | "REASONING_QUALITY"
     | "GOAL_COMPLETION"
     | string; // open enum: backend may add categories

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

5. In src/lib/api.ts, replace the existing `request<T>` function (currently at lines 143-157) with this version that throws a typed ApiError:

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

   Export ApiError from this file so consumers can `import { ApiError } from "@/lib/api"`.

Do not touch any other files. Do not modify any other API wrappers in this change.
```

### Acceptance criteria

- [ ] `src/pages/TestCaseList.tsx` no longer exists in the repo
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] App still loads at `/agents`; no console errors
- [ ] Sidebar shows three nav items: Agents → Test Cases → Behavioral Check
- [ ] Clicking "Test Cases" navigates to `/test-cases` and shows the existing `TestCaseAgentList` content
- [ ] `ApiError` is exported from `src/lib/api.ts` and `src/lib/types.ts` exists with the `FailureCategory` type
- [ ] `EmptyState` component renders without crashing in any consumer (none yet — visual verification deferred to Task 2)

### Commit

```bash
git add -A
git commit -m "Phase A.1: cleanup, sidebar Test Cases, shared infra"
```

---

## Task 2: A.2 — Schema viewer (read-only)

**Files:**
- Modify: `src/lib/types.ts` — add `AgentSchema` type
- Modify: `src/lib/api.ts` — replace existing `getSchema` and `extractSchema` (currently typed `any`) with typed versions; add `extractSchema` `versionId` param
- Create: `src/components/schema/SchemaPanel.tsx`
- Create: `src/pages/AgentSchema.tsx`
- Modify: `src/App.tsx` — add route `/agents/:agentId/versions/:versionId/schema`
- Modify: `src/pages/AgentDetail.tsx` — add a "Schema" link/button in the version header that navigates to the schema route for the active version

### Lovable prompt

```
Add a read-only schema viewer for agent versions.

1. In src/lib/types.ts, add:

   export interface AgentSchema {
     agent_id: string;
     schema_json: Record<string, unknown>;
     extracted_from_version_id: string | null;
     human_edited: boolean;
     updated_at: string;
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

   - Default export `SchemaPanel`.
   - Props: { agentId: string; versionId: string }
   - Use React Query: useQuery({ queryKey: ['agent', agentId, 'schema'], queryFn: () => api.getSchema(agentId) })
   - States to render:
     - Loading: shadcn <Skeleton> placeholder for a card-shaped block.
     - Error (ApiError with status 404): use <EmptyState icon={FileQuestion} title="No schema yet" description="Extract a schema from this version's prompt and tool definitions." action={<Button>Extract schema</Button>} />. The Extract button calls api.extractSchema(agentId, versionId) via useMutation; on success invalidate ['agent', agentId, 'schema']; on error toast the error message.
     - Error (other): <Alert variant="destructive"> showing error.message + a "Retry" button that re-runs the query.
     - Success: render the schema. Header row shows two badges:
       • "Edited by human" (only when human_edited === true), variant="secondary"
       • "Extracted from v{n}" (only when extracted_from_version_id !== versionId AND extracted_from_version_id != null) — to render version label, fetch agent versions via api.getAgentVersions(agentId) and look up the version_number; if not found, show "Extracted from another version".
       Body: shadcn <ScrollArea className="h-[60vh]"> wrapping a <pre className="text-xs"><code>{JSON.stringify(schema_json, null, 2)}</code></pre>.
       Below the body: a small disabled "Edit schema" button with tooltip "Editing requires backend PATCH endpoint — coming soon."

4. Create src/pages/AgentSchema.tsx:

   - Read agentId, versionId from useParams.
   - Layout: page heading "Schema — v{versionNumber}" (fetch version via api.getAgentVersions and find by id; show "Schema" alone if not found yet), back link to /agents/{agentId}, then <SchemaPanel agentId={agentId} versionId={versionId} />.
   - Wrap in the existing AppLayout pattern used by other pages.

5. In src/App.tsx, add this route inside <Routes> (place it next to the existing agent routes, after /agents/:id):

   <Route path="/agents/:agentId/versions/:versionId/schema" element={<AgentSchema />} />

   Add the import: import AgentSchema from "@/pages/AgentSchema";

6. In src/pages/AgentDetail.tsx, in the version header area (near the version selector), add a small button "Schema" that navigates to `/agents/${agentId}/versions/${activeVersionId}/schema`. Use the same Button styling as adjacent buttons. Place it visually beside the version dropdown.

Do not modify any other files. Do not implement edit mode in this task — it stays disabled with the tooltip explanation.
```

### Acceptance criteria

- [ ] Navigate to an agent → click "Schema" → schema route opens
- [ ] If schema exists: pretty-printed JSON renders inside a scrollable area; badges show appropriately
- [ ] If schema does not exist: EmptyState with "Extract schema" button shows; clicking it calls the extract endpoint and the schema appears
- [ ] If `human_edited` is true: "Edited by human" badge visible
- [ ] If schema's `extracted_from_version_id` differs from current version: "Extracted from v{n}" badge visible
- [ ] "Edit schema" button is disabled with the tooltip explanation
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
- Modify: `src/lib/api.ts` — replace `getContractV2` (currently `any`) with typed version; add `regenerateContract` (Task 4 will use it)
- Create: `src/components/contract/ContractPanel.tsx`
- Modify: `src/pages/AgentDetail.tsx` — replace contract rendering at lines 534-577 with `<ContractPanel ...>`

### Lovable prompt

```
Replace the contract rendering in AgentDetail with a full V2 contract panel.

1. In src/lib/types.ts, add (FailureCategory is already defined in this same file from Task 1, no import needed):

   export interface ObligationV2 {
     id: string;
     title: string;
     description: string;
     failure_category: FailureCategory;
   }

   export interface ToolSequence {
     id: string;
     description: string;
     tool_names: string[]; // ordered
   }

   export interface ForbiddenBehavior {
     id: string;
     behavior: string;
     description: string;
   }

   export interface LatencyBudget {
     scope: string;       // e.g. "tool:lookup_user" or "overall"
     budget_ms: number;
     rationale: string;
   }

   export interface ContractV2 {
     agent_id: string;
     version_id: string;
     obligations: ObligationV2[];
     tool_sequences: ToolSequence[];
     forbidden_behaviors: ForbiddenBehavior[];
     latency_budgets: LatencyBudget[];
     created_at: string;
   }

2. In src/lib/api.ts, replace getContractV2 with the typed version:

   import { ContractV2 } from "./types";

   getContractV2: (agentId: string, versionId: string) =>
     request<ContractV2>(`/agents/${agentId}/versions/${versionId}/contract`),

   Also keep generateContractV2 unchanged for now (it returns ContractV2 — update its return type too: request<ContractV2>(...)).

3. Create src/components/contract/ContractPanel.tsx:

   Default export ContractPanel.
   Props: { agentId: string; versionId: string; contract: ContractV2 | null }

   Render four shadcn <Card> sections in this order:

   (a) Obligations card
       - <CardHeader> with <CardTitle>Obligations</CardTitle> and a count badge "{obligations.length}".
       - <CardContent>: if obligations is empty, render <EmptyState icon={ListX} title="No obligations" />.
         Otherwise list each obligation as a row:
         - Title (font-medium)
         - <Badge variant="outline" className="text-[10px]">{failure_category}</Badge> next to the title
         - Description below in muted text
         - Add an `id={\`obligation-${o.id}\`}` attribute on the row's outer element so deep-links from test cases (added in Phase C) can scroll to it.

   (b) Tool Sequences card
       - <CardHeader> "Tool Sequences" + count badge.
       - <CardContent>: if empty, EmptyState ("No tool sequences defined for this contract").
         Otherwise list each sequence as a row:
         - Description (font-medium)
         - Below it, render the tool_names array as: name1 → name2 → name3 (use the unicode arrow → with `text-muted-foreground` between each name; each name in a small <Badge variant="secondary">).

   (c) Forbidden Behaviors card
       - <CardHeader> "Forbidden Behaviors" + count badge.
       - <CardContent>: if empty, EmptyState ("No forbidden behaviors defined").
         Otherwise list each as:
         - <Badge variant="destructive">{behavior}</Badge>
         - Description below in muted text

   (d) Latency Budgets card
       - <CardHeader> "Latency Budgets" + count badge.
       - <CardContent>: if empty, EmptyState ("No latency budgets defined").
         Otherwise render a shadcn <Table> with columns: Scope | Budget (ms) | Rationale.

   All four cards stack vertically with `space-y-4` between them.

4. In src/pages/AgentDetail.tsx, find the existing contract rendering block (currently around lines 534-577 — search for the section that renders obligations and tool_stubs from the V1 contract). Replace it with:

   <ContractPanel agentId={agentId} versionId={activeVersionId} contract={contractV2 ?? null} />

   Make sure contractV2 is fetched via React Query using key ['agent', agentId, 'version', activeVersionId, 'contract'] and api.getContractV2. If a query already exists for the V1 contract, leave it for now (it is used elsewhere on the page); add a new useQuery for contractV2 alongside it. Handle loading state with a <Skeleton> wrapper around <ContractPanel>.

5. Add icons: ListX from lucide-react in ContractPanel.

Do not touch the contract generation buttons in this task — Task 4 will fix the "Generate Contract" button. Leave it as-is for now.
```

### Acceptance criteria

- [ ] Open an agent with a V2 contract → all four sections render (Obligations / Tool Sequences / Forbidden Behaviors / Latency Budgets)
- [ ] Each obligation shows a `failure_category` badge
- [ ] Each tool sequence shows tool names joined by → arrows
- [ ] Forbidden behaviors render with destructive badges
- [ ] Latency budgets render as a table
- [ ] Empty arrays render the appropriate empty state per section
- [ ] Open an agent without a V2 contract → no crash; loading skeleton then empty state or appropriate fallback
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase A.3: render full V2 contract surface"
```

---

## Task 4: A.4 — Regenerate contract dialog

**Files:**
- Modify: `src/lib/api.ts` — add `regenerateContract` wrapper (same endpoint as `generateContractV2`, distinct name for clarity)
- Create: `src/components/contract/RegenerateContractDialog.tsx`
- Modify: `src/pages/AgentDetail.tsx` — fix the "Generate Contract" button at line 660 (currently permanently disabled when contract exists); when contract exists, the button becomes "Regenerate Contract" and opens the new dialog

### Lovable prompt

```
Fix the "Generate Contract" button so it can regenerate, and add a confirmation dialog.

1. In src/lib/api.ts, add (alongside generateContractV2):

   regenerateContract: (agentId: string, versionId: string) =>
     request<ContractV2>(
       `/agents/${agentId}/versions/${versionId}/contract/generate`,
       { method: "POST" }
     ),

   It is intentionally the same endpoint as generateContractV2 — distinct name makes call sites self-documenting.

2. Create src/components/contract/RegenerateContractDialog.tsx:

   import { useMutation, useQueryClient } from "@tanstack/react-query";
   import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
   import { Button } from "@/components/ui/button";
   import { useToast } from "@/components/ui/use-toast";
   import { api } from "@/lib/api";
   import { ReactNode, useState } from "react";

   interface Props {
     agentId: string;
     versionId: string;
     trigger: ReactNode; // the button element
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
         toast({ title: "Regeneration failed", description: err.message, variant: "destructive" });
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

3. In src/pages/AgentDetail.tsx, find the existing "Generate Contract" button (around line 660). Currently it is disabled permanently once a contract exists. Change the behavior to:

   - When no contract exists (contractV2 == null): button label "Generate Contract", calls api.generateContractV2 directly (existing behavior, just verify it works), shows loading state while pending.
   - When contract exists (contractV2 != null): button label "Regenerate Contract", wrapped in <RegenerateContractDialog ...> with the button as the trigger. Button is enabled.

   Pseudocode for the JSX:

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

   Make sure generateContractMutation already exists or add one using api.generateContractV2 with the same invalidation pattern.

Do not change any other contract-related code in this task.
```

### Acceptance criteria

- [ ] On an agent without a contract: "Generate Contract" button works as before
- [ ] On an agent with a contract: button now reads "Regenerate Contract" and is **enabled**
- [ ] Clicking "Regenerate Contract" opens the confirmation dialog with the warning copy
- [ ] Cancel closes the dialog with no API call
- [ ] Confirm calls the API; loading state shows "Regenerating…"; on success, contract refreshes in the panel and a success toast appears; on error, toast shows error message and dialog stays open
- [ ] No TypeScript errors; no console errors

### Commit

```bash
git add -A
git commit -m "Phase A.4: regenerate contract dialog"
```

---

## Task 5: A.5 — Manual test case creation

**Pre-task verification (do this first):** Verify backend supports `POST /agents/{id}/versions/{vid}/test-cases` accepting `{input, expected_output, obligation_ids, tags}`. Quick check: `curl` an existing agent/version with that body; if it returns 404 or 422 with a different shape, **stop and file backend ask** — do not implement Task 5 until backend is ready.

**Files:**
- Modify: `src/lib/types.ts` — add `TestCaseV2` (the V2-shaped test case as returned by the V2 endpoint) and `CreateTestCasePayload`
- Modify: `src/lib/api.ts` — add `createTestCase` wrapper
- Create: `src/components/test-cases/TestCaseForm.tsx`
- Create: `src/pages/TestCaseNew.tsx`
- Modify: `src/App.tsx` — add route `/agents/:agentId/versions/:versionId/test-cases/new`
- Modify: `src/pages/TestCaseAgentList.tsx` — add "New Test Case" button in the header beside the existing Generate button
- Modify: `src/lib/api.ts` (cleanup) — after Task 5 ships and you've verified nothing else uses them, delete the V1-only test case wrappers that have V2 equivalents and are no longer referenced (run a grep for each before deleting)

### Lovable prompt

```
Add a manual test case creation form.

1. In src/lib/types.ts, add:

   export interface TestCaseV2 {
     id: string;
     agent_id: string;
     agent_version_id: string;
     contract_id: string | null;
     input: string;
     expected_output: string;
     obligation_ids: string[];
     tags: string[];
     locked: boolean;
     locked_at_pass: number | null;
     locked_at_version_id: string | null;
     created_at: string;
   }

   export interface CreateTestCasePayload {
     input: string;
     expected_output: string;
     obligation_ids: string[];
     tags: string[];
   }

2. In src/lib/api.ts, add:

   import { TestCaseV2, CreateTestCasePayload } from "./types";

   createTestCase: (agentId: string, versionId: string, payload: CreateTestCasePayload) =>
     request<TestCaseV2>(
       `/agents/${agentId}/versions/${versionId}/test-cases`,
       { method: "POST", body: JSON.stringify(payload) }
     ),

3. Create src/components/test-cases/TestCaseForm.tsx using react-hook-form + zod:

   import { useForm } from "react-hook-form";
   import { zodResolver } from "@hookform/resolvers/zod";
   import * as z from "zod";
   import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
   import { useNavigate } from "react-router-dom";
   import { Button } from "@/components/ui/button";
   import { Textarea } from "@/components/ui/textarea";
   import { Input } from "@/components/ui/input";
   import { Label } from "@/components/ui/label";
   import { Badge } from "@/components/ui/badge";
   import { Checkbox } from "@/components/ui/checkbox";
   import { useToast } from "@/components/ui/use-toast";
   import { api } from "@/lib/api";
   import { useState } from "react";

   const schema = z.object({
     input: z.string().min(1, "Input required"),
     expected_output: z.string().min(1, "Expected output required"),
     obligation_ids: z.array(z.string()),
     tags: z.array(z.string()),
   });

   type FormValues = z.infer<typeof schema>;

   interface Props {
     agentId: string;
     versionId: string;
   }

   export function TestCaseForm({ agentId, versionId }: Props) {
     const nav = useNavigate();
     const qc = useQueryClient();
     const { toast } = useToast();

     const contractQuery = useQuery({
       queryKey: ['agent', agentId, 'version', versionId, 'contract'],
       queryFn: () => api.getContractV2(agentId, versionId),
     });

     const form = useForm<FormValues>({
       resolver: zodResolver(schema),
       defaultValues: { input: "", expected_output: "", obligation_ids: [], tags: [] },
     });

     const [tagDraft, setTagDraft] = useState("");
     const tags = form.watch("tags");

     const mutation = useMutation({
       mutationFn: (values: FormValues) => api.createTestCase(agentId, versionId, values),
       onSuccess: () => {
         qc.invalidateQueries({ queryKey: ['test-cases', agentId, versionId] });
         toast({ title: "Test case created" });
         nav(-1); // back to list
       },
       onError: (err: Error) => {
         toast({ title: "Failed to create test case", description: err.message, variant: "destructive" });
       },
     });

     return (
       <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6 max-w-2xl">
         <div>
           <Label htmlFor="input">Input</Label>
           <Textarea id="input" rows={4} {...form.register("input")} />
           {form.formState.errors.input && <p className="text-xs text-destructive mt-1">{form.formState.errors.input.message}</p>}
         </div>

         <div>
           <Label htmlFor="expected">Expected output</Label>
           <Textarea id="expected" rows={4} {...form.register("expected_output")} />
           {form.formState.errors.expected_output && <p className="text-xs text-destructive mt-1">{form.formState.errors.expected_output.message}</p>}
         </div>

         <div>
           <Label>Obligations covered</Label>
           {contractQuery.isLoading && <p className="text-xs text-muted-foreground">Loading obligations…</p>}
           {contractQuery.error && <p className="text-xs text-destructive">Failed to load obligations.</p>}
           {contractQuery.data && contractQuery.data.obligations.length === 0 && (
             <p className="text-xs text-muted-foreground">This version has no obligations yet. Generate a contract first to link test cases to obligations.</p>
           )}
           {contractQuery.data && contractQuery.data.obligations.length > 0 && (
             <div className="space-y-2 mt-2">
               {contractQuery.data.obligations.map((o) => {
                 const checked = form.watch("obligation_ids").includes(o.id);
                 return (
                   <label key={o.id} className="flex items-start gap-2 text-sm">
                     <Checkbox
                       checked={checked}
                       onCheckedChange={(v) => {
                         const current = form.getValues("obligation_ids");
                         form.setValue("obligation_ids", v ? [...current, o.id] : current.filter((id) => id !== o.id));
                       }}
                     />
                     <span><span className="font-medium">{o.title}</span> <Badge variant="outline" className="text-[10px] ml-1">{o.failure_category}</Badge></span>
                   </label>
                 );
               })}
             </div>
           )}
         </div>

         <div>
           <Label>Tags</Label>
           <div className="flex gap-2 items-center">
             <Input
               value={tagDraft}
               onChange={(e) => setTagDraft(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === "Enter" && tagDraft.trim()) {
                   e.preventDefault();
                   form.setValue("tags", [...tags, tagDraft.trim()]);
                   setTagDraft("");
                 }
               }}
               placeholder="Type and press Enter"
             />
           </div>
           {tags.length > 0 && (
             <div className="flex flex-wrap gap-1 mt-2">
               {tags.map((t, i) => (
                 <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => form.setValue("tags", tags.filter((_, j) => j !== i))}>
                   {t} ×
                 </Badge>
               ))}
             </div>
           )}
         </div>

         <div className="flex gap-2">
           <Button type="submit" disabled={mutation.isPending}>
             {mutation.isPending ? "Creating…" : "Create test case"}
           </Button>
           <Button type="button" variant="outline" onClick={() => nav(-1)}>Cancel</Button>
         </div>
       </form>
     );
   }

4. Create src/pages/TestCaseNew.tsx:

   import { useParams } from "react-router-dom";
   import { TestCaseForm } from "@/components/test-cases/TestCaseForm";

   export default function TestCaseNew() {
     const { agentId, versionId } = useParams();
     if (!agentId || !versionId) return null;
     return (
       <div className="p-6">
         <h1 className="text-lg font-semibold mb-4">New test case</h1>
         <TestCaseForm agentId={agentId} versionId={versionId} />
       </div>
     );
   }

5. In src/App.tsx, add inside <Routes>:

   <Route path="/agents/:agentId/versions/:versionId/test-cases/new" element={<TestCaseNew />} />

   Add the import.

6. In src/pages/TestCaseAgentList.tsx, in the page header next to the existing "Generate" button, add:

   <Button asChild size="sm">
     <Link to={`/agents/${agentId}/versions/${activeVersionId}/test-cases/new`}>
       New test case
     </Link>
   </Button>

   (Use the existing variable names for agentId and the active version id from that page; if the page does not currently know an active versionId, source it from the existing version selection state on TestCaseAgentList.)

If react-hook-form, @hookform/resolvers, or zod are not in package.json, install them: npm install react-hook-form @hookform/resolvers zod
```

### Post-task cleanup

After Task 5 ships and you've verified manually:
- Search the repo for usages of these V1 wrappers in `api.ts`: `generateTestCases`, `getTestCases`, `getTestCase`, `lockTestCase`, `unlockTestCase` (the V1 versions, NOT the V2 ones).
- For each that has zero usages, delete its definition from `api.ts`.
- Re-run `npm run build` to confirm.

### Acceptance criteria

- [ ] Backend pre-check passed (or backend ask filed and Task 5 skipped)
- [ ] On `TestCaseAgentList`, "New test case" button visible in the header
- [ ] Clicking it opens the form page
- [ ] Form: validation prevents submission with empty input or expected output (inline errors)
- [ ] Obligations checklist loads from the version's contract; selecting/unselecting works
- [ ] Tags: typing + Enter adds a chip; clicking a chip removes it
- [ ] Submit creates the test case (verify via network tab → POST returns 201/200) and navigates back to the list
- [ ] New test case appears in the list (after invalidation refetch)
- [ ] Submission failure shows a destructive toast and keeps the form open
- [ ] No TypeScript errors; no console errors
- [ ] V1 test case wrappers that became unused after this task are deleted from `api.ts`

### Commit

```bash
git add -A
git commit -m "Phase A.5: manual test case creation form"
```

---

## End-of-phase smoke test

Run all of these in the browser before declaring Phase A complete:

1. **Sidebar:** Three entries — Agents, Test Cases, Behavioral Check. Test Cases entry navigates to `/test-cases`.
2. **Schema:** From an agent detail page, click "Schema" → schema page opens. If schema exists, JSON renders. If not, "Extract schema" button works and the schema appears after extraction.
3. **Contract surface:** On an agent with a contract, all four sections render (Obligations, Tool Sequences, Forbidden Behaviors, Latency Budgets). Empty arrays show empty states.
4. **Regenerate:** "Regenerate Contract" button is enabled when a contract exists; dialog warns; confirm refreshes the panel.
5. **Manual test case:** "New test case" → form → submit → new test case appears in list; obligation checkboxes drawn from contract.
6. **No regressions:** AgentList, AgentDetail, AgentUpload, TestCaseDetail, EvalRunHistory, RegressionDashboard all still load without console errors.
7. **Build:** `npm run build` exits 0 with no TypeScript errors.

If all pass, Phase A is shipped. Move to Plan B.
