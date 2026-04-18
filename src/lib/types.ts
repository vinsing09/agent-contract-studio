export interface AgentSchema {
  id: string;
  agent_id: string;
  schema_json: Record<string, unknown>;
  extracted_from_version_id: string;
  human_edited: boolean;
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
