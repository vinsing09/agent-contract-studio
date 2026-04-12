const API_BASE = "https://adina-uncomforting-wilfully.ngrok-free.dev";

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  tool_schemas: any[];
  contract?: Contract;
}

export interface Contract {
  obligations: string[];
  tool_stubs: Record<string, { response: any; latency_ms?: number; simulate_failure?: boolean }>;
}

export interface ToolStub {
  name: string;
  response: any;
  latency_ms?: number;
  simulate_failure?: boolean;
}

export interface TestCase {
  id: string;
  agent_id: string;
  scenario: string;
  input_text: string;
  tags: string[];
  assertions: Assertion[];
  tool_stubs: ToolStub[];
  locked: boolean;
  locked_at_pass?: number | null;
  status?: "PASS" | "FAIL" | "PENDING";
}

export interface Assertion {
  type: string;
  tool_name?: string;
  param?: string;
  expected?: any;
  operator?: string;
  result?: "PASS" | "FAIL";
  reason?: string;
}

export interface TraceCall {
  tool_name: string;
  params: any;
  response: any;
  latency_ms: number;
  simulate_failure?: boolean;
  order: number;
}

export interface TestCaseDetail extends TestCase {
  trace?: {
    calls: TraceCall[];
    final_output: string;
  };
  assertion_results?: Assertion[];
}

export interface EvalRun {
  id: string;
  agent_id: string;
  agent_name?: string;
  run_type: string;
  started_at: string;
  status: "PASS" | "FAIL" | "PENDING" | "RUNNING";
  pass_count: number;
  total_count: number;
}

export interface EvalResult {
  id: string;
  run_id: string;
  test_case_id: string;
  assertion_id: string;
  passed: boolean | null;
  reason: string;
  result_type: string;
  scenario?: string;
  assertion_type?: string;
  tool_name?: string;
  param?: string;
}

export interface RegressionCase {
  id: string;
  agent_id: string;
  scenario: string;
  tags: string[];
  assertion_count: number;
  last_run?: string;
  status?: "PASS" | "FAIL" | "NEVER_RUN";
}

export interface AgentDraft {
  id: string;
  name: string;
  business_goal: string;
  desired_behaviors: string[];
  raw_system_prompt: string;
  tool_schemas: any[];
  created_at: string;
}

export interface AuditIssue {
  id: string;
  severity: "high" | "medium" | "low";
  description: string;
  gap_type: "missing" | "ambiguous" | "contradicts_goal";
}

export interface SuggestedFix {
  id: string;
  issue_id: string;
  description: string;
  prompt_patch: string;
}

export interface AuditReport {
  id: string;
  agent_draft_id: string;
  issues: AuditIssue[];
  suggested_fixes: SuggestedFix[];
  created_at: string;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version_number: number;
  label: string;
  system_prompt: string;
  tool_schemas: any[];
  parent_version_id: string | null;
  source: string;
  created_at: string;
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
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  getAgents: () => request<Agent[]>("/agents"),

  createAgent: (data: { name: string; system_prompt: string; tool_schemas: any }) =>
    request<Agent>("/agents", { method: "POST", body: JSON.stringify(data) }),

  getAgent: (id: string) => request<Agent>(`/agents/${id}`),

  getAgentContract: (id: string) => request<Contract>(`/agents/${id}/contract`),

  generateContract: (agentId: string) =>
    request<Contract>(`/agents/${agentId}/contract/generate`, { method: "POST" }),

  generateTestCases: (agentId: string) =>
    request<TestCase[]>(`/agents/${agentId}/test-cases/generate`, { method: "POST" }),

  getTestCases: (agentId: string) =>
    request<TestCase[]>(`/agents/${agentId}/test-cases`),

  getTestCase: (id: string) => request<TestCaseDetail>(`/test-cases/${id}`),

  lockTestCase: (id: string) =>
    request<void>(`/test-cases/${id}/lock`, { method: "POST" }),

  unlockTestCase: (id: string) =>
    request<void>(`/test-cases/${id}/unlock`, { method: "POST" }),

  runEval: (agentId: string, runType: string = "full") =>
    request<EvalRun>(`/agents/${agentId}/eval-runs`, {
      method: "POST",
      body: JSON.stringify({ run_type: runType }),
    }),

  getEvalRuns: () => request<EvalRun[]>("/eval-runs"),

  getEvalRunResults: (runId: string) =>
    request<EvalResult[]>(`/eval-runs/${runId}/results`),

  deleteEvalRun: (runId: string) =>
    request<void>(`/eval-runs/${runId}`, { method: "DELETE" }),

  deleteTestCase: (id: string) =>
    request<void>(`/test-cases/${id}`, { method: "DELETE" }),

  deleteAgent: (id: string) =>
    request<void>(`/agents/${id}`, { method: "DELETE" }),

  getLatestRegressionRun: (agentId: string) =>
    request<any>(`/agents/${agentId}/regression-run/latest`),

  runRegressionRun: (agentId: string) =>
    fetch(`${API_BASE}/agents/${agentId}/regression-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
    }),

  runRegressionV2: (agentId: string, data: {
    challenger_version_id: string;
    baseline_version_id: string;
  }) =>
    fetch(`${API_BASE}/agents/${agentId}/regression-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify(data),
    }),

  createDraft: (data: {
    name: string;
    business_goal: string;
    desired_behaviors: string[];
    system_prompt: string;
    tool_schemas: any[];
  }) => request<AgentDraft>("/agents/draft", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  auditDraft: (draftId: string) =>
    request<AuditReport>(`/agents/draft/${draftId}/audit`, {
      method: "POST",
    }),

  commitDraft: (draftId: string, acceptedFixIds: string[]) =>
    request<{ agent_id: string; version_id: string; agent_name: string; fixes_applied: number }>(
      `/agents/draft/${draftId}/commit`,
      { method: "POST", body: JSON.stringify({ accepted_fix_ids: acceptedFixIds }) }
    ),

  getAgentVersions: (agentId: string) =>
    request<AgentVersion[]>(`/agents/${agentId}/versions`),

  extractSchema: (agentId: string) =>
    request<any>(`/agents/${agentId}/schema/extract`, { method: "POST" }),

  getSchema: (agentId: string) =>
    request<any>(`/agents/${agentId}/schema`),

  generateContractV2: (agentId: string, versionId: string) =>
    request<any>(
      `/agents/${agentId}/versions/${versionId}/contract/generate`,
      { method: "POST" }
    ),

  getContractV2: (agentId: string, versionId: string) =>
    request<any>(`/agents/${agentId}/versions/${versionId}/contract`),

  generateTestCasesV2: (agentId: string, versionId: string) =>
    request<any>(
      `/agents/${agentId}/versions/${versionId}/test-cases/generate`,
      { method: "POST" }
    ),

  getTestCasesV2: (agentId: string, versionId: string) =>
    request<any[]>(`/agents/${agentId}/versions/${versionId}/test-cases`),

  runEvalV2: (agentId: string, versionId: string) =>
    request<any>(
      `/agents/${agentId}/versions/${versionId}/eval-runs`,
      { method: "POST", body: JSON.stringify({ run_type: "full" }) }
    ),

  lockTestCaseWithIntent: (id: string, intent: "protect" | "track") =>
    request<any>(`/test-cases/${id}/lock`, {
      method: "POST",
      body: JSON.stringify({ intent }),
    }),

  getTestCaseDetail: (id: string) =>
    request<any>(`/test-cases/${id}`),

  createVersion: (agentId: string, data: {
    system_prompt: string;
    tool_schemas: any[];
    label: string;
  }) =>
    request<AgentVersion>(`/agents/${agentId}/versions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getEvalRunDetail: (runId: string) =>
    request<any>(`/eval-runs/${runId}`),

  getSuggestions: (agentId: string, versionId: string, evalRunId: string) =>
    request<{ suggestions: any[] }>(
      `/agents/${agentId}/versions/${versionId}/improvements?eval_run_id=${evalRunId}`,
      { method: "POST" }
    ),

  applySuggestions: (agentId: string, versionId: string, data: {
    accepted_fix_ids: string[];
    eval_run_id: string;
    label: string;
  }) =>
    request<any>(
      `/agents/${agentId}/versions/${versionId}/improvements/apply`,
      { method: "POST", body: JSON.stringify(data) }
    ),
};
