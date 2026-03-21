const API_BASE = "https://adina-uncomforting-wilfully.ngrok-free.dev";

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
  tool_schemas: any[];
  contract?: Contract;
}

export interface Contract {
  behavioral_obligations: string[];
  tool_stubs: ToolStub[];
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
  test_case_id: string;
  scenario: string;
  status: "PASS" | "FAIL" | "PENDING";
  failed_assertions: { type: string; reason: string }[];
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
};
