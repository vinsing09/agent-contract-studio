import { useState } from "react";
import { api, type Agent, type Contract } from "@/lib/api";
import { CodeBlock } from "@/components/ui-shared";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";

export default function AgentUpload() {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [toolSchemas, setToolSchemas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [error, setError] = useState("");
  const [expandedStubs, setExpandedStubs] = useState<Set<number>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      let schemas: any;
      try {
        schemas = toolSchemas ? JSON.parse(toolSchemas) : [];
      } catch {
        setError("Invalid JSON in tool schemas");
        setSubmitting(false);
        return;
      }
      const result = await api.createAgent({ name, system_prompt: systemPrompt, tool_schemas: schemas });
      setAgent(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!agent) return;
    setGeneratingContract(true);
    try {
      const c = await api.generateContract(agent.id);
      setContract(c);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingContract(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!agent) return;
    setGeneratingTests(true);
    try {
      await api.generateTestCases(agent.id);
      // Navigate to test cases could go here
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingTests(false);
    }
  };

  const toggleStub = (i: number) => {
    setExpandedStubs((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="px-6 py-8 max-w-[680px] mx-auto animate-fade-in">
      <h1 className="text-xl font-semibold text-foreground mb-1">Upload Agent</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Register a new AI agent for behavioral contract testing.
      </p>

      {!agent ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="my-support-agent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              required
              rows={6}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-y"
              placeholder="You are a helpful customer support agent..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Tool Schemas</label>
            <textarea
              value={toolSchemas}
              onChange={(e) => setToolSchemas(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-y"
              placeholder='Paste OpenAI-format tool schemas JSON array'
            />
          </div>

          {error && (
            <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Agent
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Agent created successfully.</p>
            <CodeBlock label="Agent ID">{agent.id}</CodeBlock>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerateContract}
              disabled={generatingContract || !!contract}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {generatingContract && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {contract ? "Contract Generated" : "Generate Contract"}
            </button>

            <button
              onClick={handleGenerateTests}
              disabled={generatingTests || !contract}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border bg-card text-foreground rounded hover:bg-muted transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {generatingTests && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Generate Test Cases
            </button>
          </div>

          {error && (
            <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive">
              {error}
            </div>
          )}

          {contract && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                  Behavioral Obligations
                </h2>
                <div className="space-y-2">
                  {contract.behavioral_obligations.map((obligation, i) => (
                    <div
                      key={i}
                      className="flex gap-3 p-3 bg-card border border-border rounded border-l-2 border-l-primary"
                    >
                      <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="text-sm text-foreground">{obligation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                  Tool Stubs
                </h2>
                <div className="space-y-2">
                  {contract.tool_stubs.map((stub, i) => (
                    <div key={i} className="border border-border rounded bg-card overflow-hidden">
                      <button
                        onClick={() => toggleStub(i)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        {expandedStubs.has(i) ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="font-mono text-primary">{stub.name}</span>
                      </button>
                      {expandedStubs.has(i) && (
                        <div className="border-t border-border">
                          <CodeBlock>{JSON.stringify(stub.response, null, 2)}</CodeBlock>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
