import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Agent, type Contract, type TestCase, type EvalRun, type EvalResult } from "@/lib/api";
import { CodeBlock, StatusBadge } from "@/components/ui-shared";
import {
  Loader2, AlertCircle, ArrowLeft, ChevronDown, ChevronRight, Trash2,
  FileText, ListChecks, PlayCircle, CheckCircle2, XCircle
} from "lucide-react";

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [latestRun, setLatestRun] = useState<EvalRun | null>(null);
  const [latestResults, setLatestResults] = useState<EvalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showPrompt, setShowPrompt] = useState(false);
  const [showSchemas, setShowSchemas] = useState(false);
  const [expandedStubs, setExpandedStubs] = useState<Set<string>>(new Set());

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [generatingContract, setGeneratingContract] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [runningEval, setRunningEval] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.getAgent(id),
      api.getAgentContract(id).catch(() => null),
      api.getTestCases(id).catch(() => []),
      api.getEvalRuns().catch(() => []),
    ])
      .then(([agentData, contractData, cases, runs]) => {
        setAgent(agentData);
        setContract(contractData || agentData.contract || null);
        setTestCases(Array.isArray(cases) ? cases : []);
        const agentRuns = (runs as EvalRun[]).filter((r) => r.agent_id === id);
        if (agentRuns.length > 0) {
          const latest = agentRuns[0];
          setLatestRun(latest);
          api.getEvalRunResults(latest.id)
            .then((res) => setLatestResults(res))
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAgent(id);
      navigate("/agents");
    } catch (err: any) {
      const msg = err.message || "Failed to delete agent";
      if (msg.includes("400")) {
        setDeleteModal(false);
        setDeleteError(msg);
      } else {
        setDeleteError(msg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!id) return;
    setGeneratingContract(true);
    try {
      const c = await api.generateContract(id);
      setContract(c);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingContract(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!id) return;
    setGeneratingTests(true);
    try {
      const cases = await api.generateTestCases(id);
      setTestCases(Array.isArray(cases) ? cases : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingTests(false);
    }
  };

  const handleRunEval = async () => {
    if (!id) return;
    setRunningEval(true);
    try {
      const response = await api.runEval(id) as any;
      const runId = response?.eval_run?.id || response?.id;
      const results = await api.getEvalRunResults(runId);
      setLatestRun(response?.eval_run || response);
      setLatestResults(results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningEval(false);
    }
  };

  const toggleStub = (name: string) => {
    setExpandedStubs((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="px-6 py-8">
        <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error || "Agent not found"}
        </div>
      </div>
    );
  }

  const hasContract = !!contract;
  const hasTests = testCases.length > 0;
  const passedCount = latestResults.filter((r) => r.passed === true).length;
  const totalCount = latestResults.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  // Tag breakdown
  const tagCounts: Record<string, number> = {};
  for (const tc of testCases) {
    for (const tag of tc.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return (
    <div className="px-6 py-6 animate-fade-in">
      <Link
        to="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 active:scale-[0.97]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Agents
      </Link>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {deleteError && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {deleteError}
        </div>
      )}

      <div className="flex gap-6">
        {/* Left Column - 30% */}
        <div className="w-[30%] shrink-0 space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{agent.name}</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1">{agent.id}</p>
          </div>

          {/* System Prompt */}
          <div className="border border-border rounded bg-card">
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              {showPrompt ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Prompt</span>
            </button>
            {showPrompt && (
              <div className="border-t border-border px-3 py-2">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{agent.system_prompt}</p>
              </div>
            )}
          </div>

          {/* Tool Schemas */}
          <div className="border border-border rounded bg-card">
            <button
              onClick={() => setShowSchemas(!showSchemas)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              {showSchemas ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tool Schemas</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{agent.tool_schemas?.length || 0}</span>
            </button>
            {showSchemas && (
              <div className="border-t border-border">
                <CodeBlock>{JSON.stringify(agent.tool_schemas, null, 2)}</CodeBlock>
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => setDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-destructive border border-destructive/30 rounded hover:bg-destructive/10 transition-colors active:scale-[0.97]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Agent
          </button>
        </div>

        {/* Right Column - 70% */}
        <div className="flex-1 space-y-6">
          {/* Contract Status */}
          <section className="border border-border rounded bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Contract</h2>
              {hasContract ? (
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-success/15 text-success border border-success/30 rounded-sm">GENERATED</span>
              ) : (
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">NONE</span>
              )}
            </div>
            {hasContract && contract && (
              <div className="space-y-3">
                {contract.obligations && contract.obligations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Obligations</p>
                    <ol className="space-y-1 list-decimal list-inside">
                      {contract.obligations.map((ob, i) => (
                        <li key={i} className="text-sm text-foreground">{ob}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {contract.tool_stubs && Object.keys(contract.tool_stubs).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tool Stubs</p>
                    <div className="space-y-1">
                      {Object.entries(contract.tool_stubs).map(([toolName, stub]) => (
                        <div key={toolName} className="border border-border rounded">
                          <button
                            onClick={() => toggleStub(toolName)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                          >
                            {expandedStubs.has(toolName) ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                            <span className="font-mono text-foreground">{toolName}</span>
                          </button>
                          {expandedStubs.has(toolName) && (
                            <div className="border-t border-border">
                              <CodeBlock>{JSON.stringify(stub, null, 2)}</CodeBlock>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Test Cases Summary */}
          <section className="border border-border rounded bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Test Cases</h2>
              <span className="text-xs font-mono text-muted-foreground">{testCases.length}</span>
            </div>
            {Object.keys(tagCounts).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {Object.entries(tagCounts).map(([tag, count]) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                    {tag} <span className="text-foreground font-medium">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Latest Eval */}
          {latestRun && (
            <section className="border border-border rounded bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <PlayCircle className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Last Eval</h2>
                <StatusBadge status={latestRun.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">{passedCount}/{totalCount} passed ({passRate}%)</span>
                <span>{new Date(latestRun.started_at).toLocaleDateString()}</span>
              </div>
            </section>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateContract}
              disabled={hasContract || generatingContract}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted active:scale-[0.97]"
            >
              {generatingContract && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasContract ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Contract Generated</>
              ) : (
                "Generate Contract"
              )}
            </button>
            <button
              onClick={handleGenerateTests}
              disabled={!hasContract || generatingTests}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted active:scale-[0.97]"
            >
              {generatingTests && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasTests ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-success" /> {testCases.length} Test Cases</>
              ) : (
                "Generate Test Cases"
              )}
            </button>
            <button
              onClick={handleRunEval}
              disabled={!hasTests || runningEval}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
            >
              {runningEval && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Run Full Eval
            </button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteModal(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-5 h-5 text-destructive" />
              <h3 className="text-base font-semibold text-foreground">Delete Agent</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              This will delete all test cases, eval runs, and regression locks for this agent. This cannot be undone.
            </p>
            {deleteError && (
              <div className="mb-3 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(false)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
