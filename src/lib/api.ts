const API_BASE = "http://localhost:8000";

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
}

export interface EvalRun {
  id: string;
  agent_id: string;
  run_type: string;
  results: EvalResult[];
}

export interface EvalResult {
  test_case_id: string;
  status: "PASS" | "FAIL" | "PENDING";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  createAgent: (data: { name: string; system_prompt: string; tool_schemas: any }) =>
    request<Agent>("/agents", { method: "POST", body: JSON.stringify(data) }),

  getAgent: (id: string) => request<Agent>(`/agents/${id}`),

  generateContract: (agentId: string) =>
    request<Contract>(`/agents/${agentId}/contract/generate`, { method: "POST" }),

  generateTestCases: (agentId: string) =>
    request<TestCase[]>(`/agents/${agentId}/test-cases/generate`, { method: "POST" }),

  getTestCases: (agentId: string) =>
    request<TestCase[]>(`/agents/${agentId}/test-cases`),

  getTestCase: (id: string) => request<TestCase>(`/test-cases/${id}`),

  runEval: (agentId: string) =>
    request<EvalRun>(`/agents/${agentId}/eval-runs`, {
      method: "POST",
      body: JSON.stringify({ run_type: "full" }),
    }),
};
