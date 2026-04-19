import { http, HttpResponse } from "msw";

const API_BASE = "https://adina-uncomforting-wilfully.ngrok-free.dev";

export const sampleVersions = [
  {
    id: "v-1",
    agent_id: "agent-1",
    version_number: 1,
    label: "baseline",
    system_prompt: "You are a helpful agent.\nAlways respond politely.",
    tool_schemas: [],
    parent_version_id: null,
    source: "upload",
    created_at: "2026-04-10T00:00:00Z",
  },
  {
    id: "v-2",
    agent_id: "agent-1",
    version_number: 2,
    label: "challenger",
    system_prompt: "You are a helpful agent.\nAlways respond politely and concisely.",
    tool_schemas: [],
    parent_version_id: "v-1",
    source: "edit",
    created_at: "2026-04-15T00:00:00Z",
  },
];

export const sampleContract = {
  id: "c-1",
  agent_id: "agent-1",
  agent_version_id: "v-2",
  obligations: [
    { id: "o-1", text: "Respond within 5 seconds", source: "extracted", failure_category: "latency" },
  ],
  tool_sequences: [],
  forbidden_behaviors: [],
  latency_budgets: [],
};

export const handlers = [
  http.get(`${API_BASE}/agents/:agentId/versions`, () =>
    HttpResponse.json(sampleVersions)
  ),
  http.get(`${API_BASE}/agents/:agentId/versions/:versionId/contract`, () =>
    HttpResponse.json(sampleContract)
  ),
  http.get(`${API_BASE}/eval-runs`, () => HttpResponse.json([])),
];
