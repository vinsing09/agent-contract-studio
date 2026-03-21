import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Agent, type Contract } from "@/lib/api";
import { CodeBlock } from "@/components/ui-shared";
import { Loader2, ChevronDown, ChevronRight, ArrowRight, CheckCircle2, XCircle } from "lucide-react";

export default function AgentUpload() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [toolSchemas, setToolSchemas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [testCasesGenerated, setTestCasesGenerated] = useState(false);
  const [testCaseCount, setTestCaseCount] = useState(0);
  const [runningEval, setRunningEval] = useState(false);
  const [evalResult, setEvalResult] = useState<{ passed: number; total: number } | null>(null);
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
    setError("");
    try {
      const c = await api.generateContract(agent.id);
      setContract({
        behavioral_obligations: c.behavioral_obligations || [],
        tool_stubs: c.tool_stubs || [],
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingContract(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!agent) return;
    setGeneratingTests(true);
    setError("");
    try {
      const cases = await api.generateTestCases(agent.id);
      setTestCaseCount(cases.length);
      setTestCasesGenerated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingTests(false);
    }
  };

  const handleRunEval = async () => {
    if (!agent) return;
    setRunningEval(true);
    setError("");
    try {
      const run = await api.runEval(agent.id, "full");
      const results = await api.getEvalRunResults(run.id);
      const passed = results.filter((r) => r.status === "PASS").length;
      setEvalResult({ passed, total: results.length });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningEval(false);
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

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGenerateContract}
              disabled={generatingContract || !!contract}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {generatingContract && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {generatingContract
                ? "Generating contract..."
                : contract ? "✓ Contract Generated" : "Generate Contract"}
            </button>

            <button
              onClick={handleGenerateTests}
              disabled={generatingTests || !contract || testCasesGenerated}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border bg-card text-foreground rounded hover:bg-muted transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {generatingTests && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {generatingTests
                ? "Generating test cases..."
                : testCasesGenerated
                  ? `✓ ${testCaseCount} Test Cases`
                  : "Generate Test Cases"}
            </button>

            <button
              onClick={handleRunEval}
              disabled={runningEval || !testCasesGenerated || !!evalResult}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border bg-card text-foreground rounded hover:bg-muted transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {runningEval && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {evalResult ? `${evalResult.passed}/${evalResult.total} Passed` : "Run Full Eval"}
            </button>
          </div>

          {/* Eval Result Summary */}
          {evalResult && (
            <div className={`px-4 py-3 rounded border text-sm font-medium flex items-center gap-2 ${
              evalResult.passed === evalResult.total
                ? "bg-success/10 border-success/30 text-success"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}>
              {evalResult.passed === evalResult.total ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {evalResult.passed}/{evalResult.total} assertions passed
              <button
                onClick={() => navigate("/eval-runs")}
                className="ml-auto text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
              >
                View Eval Runs →
              </button>
            </div>
          )}

          {/* Test Cases Link */}
          {testCasesGenerated && (
            <button
              onClick={() => navigate(`/agents/${agent.id}/test-cases`)}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-2"
            >
              View Test Cases <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {error && (
            <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive">
              {error}
            </div>
          )}

          {/* Contract Display */}
          {contract && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
                  Behavioral Obligations
                </h2>
                <div className="space-y-2">
                 {(contract.behavioral_obligations ?? []).map((obligation, i) => (
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
                  {(contract.tool_stubs ?? []).map((stub, i) => (
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
