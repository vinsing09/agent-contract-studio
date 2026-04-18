export interface AgentSchema {
  id: string;
  agent_id: string;
  schema_json: Record<string, unknown>;
  extracted_from_version_id: string;
  human_edited: boolean;
  created_at: string;
}

export interface ObligationV2 {
  id: string;
  text: string;
  source: "goal" | "behavioral" | "desired_behavior" | string;
  failure_category: FailureCategory;
}

export interface ToolSequence {
  scenario: string;
  sequence: string[];
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

export interface ToolStubV2 {
  response: Record<string, unknown>;
  latency_ms: number;
  simulate_failure: boolean;
}

export interface AssertionV2 {
  id: string;
  type:
    | "tool_called"
    | "tool_not_called"
    | "param_contains"
    | "output_contains"
    | "max_latency_ms"
    | "tool_sequence"
    | string;
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
  input_text: string;
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

export interface ContractV2 {
  id: string;
  agent_id: string;
  agent_version_id: string;
  obligations: ObligationV2[];
  tool_sequences: ToolSequence[];
  forbidden_behaviors: ForbiddenBehavior[];
  latency_budgets: LatencyBudget[];
  created_at: string;
}

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
  fixes_watching?: string[];
  must_hold_risk?: "None" | "Low" | "Medium" | string;
  confidence?: number;
}

export interface ApplySuggestionsRequest {
  accepted_fix_ids: string[];
  eval_run_id: string;
  label?: string;
  accepted_patches?: Record<string, string>;
}

export interface ApplySuggestionsResponse {
  [key: string]: unknown;
}

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
