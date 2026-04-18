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
