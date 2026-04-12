import { useState, useEffect } from "react";
import { parseApiError } from "@/lib/utils";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type TestCaseDetail, type EvalResult } from "@/lib/api";
import { CodeBlock, StatusBadge } from "@/components/ui-shared";
import { Loader2, AlertCircle, ChevronDown, ChevronRight, Clock, XCircle, CheckCircle2, Inbox, Lock, Unlock, ArrowLeft } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
const assertionTypeColors: Record<string, string> = {
  tool_called: "bg-primary/15 text-primary border-primary/30",
  tool_not_called: "bg-warning/15 text-warning border-warning/30",
  param_contains: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  output_contains: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

function PassedBadge({ passed }: { passed: boolean | null }) {
  if (passed === true) return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium bg-success/15 text-success border border-success/30 rounded-sm">PASS</span>;
  if (passed === false) return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium bg-destructive/15 text-destructive border border-destructive/30 rounded-sm">FAIL</span>;
  return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border rounded-sm">SKIP</span>;
}

export default function TestCaseDetailPage() {
  const { id, agentId } = useParams<{ id: string; agentId: string }>();
  const navigate = useNavigate();
  const [tc, setTc] = useState<TestCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lockLoading, setLockLoading] = useState(false);
  const [lockError, setLockError] = useState("");
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set());
  const [evalResults, setEvalResults] = useState<EvalResult[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);
  const [agentName, setAgentName] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getTestCase(id)
      .then(setTc)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Resolve agentId from URL or from test case data
  const resolvedAgentId = agentId || (tc as any)?.agent_id;

  useEffect(() => {
    if (!resolvedAgentId) return;
    api.getAgent(resolvedAgentId)
      .then((agent) => setAgentName(agent.name))
      .catch(() => {});
  }, [resolvedAgentId]);

  // Fetch latest eval run results for this test case
  useEffect(() => {
    if (!id || !resolvedAgentId) return;

    setEvalLoading(true);
    api.getEvalRuns()
      .then((runs) => {
        const agentRuns = runs
          .filter((r) => r.agent_id === resolvedAgentId)
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        if (agentRuns.length === 0) return null;
        return api.getEvalRunResults(agentRuns[0].id);
      })
      .then((results) => {
        if (!results) return;
        const matched = results.filter((r) => r.test_case_id === id);
        setEvalResults(matched);
      })
      .catch(() => {})
      .finally(() => setEvalLoading(false));
  }, [resolvedAgentId, id]);

  const toggleCall = (i: number) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleToggleLock = async () => {
    if (!tc || !id) return;
    setLockLoading(true);
    setLockError("");
    try {
      if (tc.locked) {
        await api.unlockTestCase(id);
      } else {
        await api.lockTestCase(id);
      }
      setTc({ ...tc, locked: !tc.locked });
    } catch (err: any) {
      setLockError(parseApiError(err));
    } finally {
      setLockLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !tc) {
    return (
      <div className="px-6 py-8">
        <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error || "Test case not found"}
        </div>
      </div>
    );
  }

  const toolStubEntries = tc.tool_stubs && typeof tc.tool_stubs === 'object' && !Array.isArray(tc.tool_stubs)
    ? Object.entries(tc.tool_stubs as Record<string, any>)
    : Array.isArray(tc.tool_stubs)
      ? (tc.tool_stubs as any[]).map((s: any, i: number) => [s.name || `stub_${i}`, s])
      : [];
  const assertions = Array.isArray(tc.assertions) ? tc.assertions : [];
  const passedCount = evalResults.filter((r) => r.passed === true).length;
  const hasEvalResults = evalResults.length > 0;

  // Split eval results into deterministic and semantic
  const deterministicResults = evalResults.filter((r) => r.result_type !== "semantic");
  const semanticResults = evalResults.filter((r) => r.result_type === "semantic");

  return (
    <div className="px-6 py-6 animate-fade-in">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/agents">Agents</Link></BreadcrumbLink>
          </BreadcrumbItem>
          {resolvedAgentId && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to={`/agents/${resolvedAgentId}`}>{agentName || "Agent"}</Link></BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to={resolvedAgentId ? `/test-cases?agent=${resolvedAgentId}` : "/test-cases"}>Test Cases</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{tc?.scenario ? (tc.scenario.length > 40 ? tc.scenario.slice(0, 40) + "…" : tc.scenario) : "Detail"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {resolvedAgentId && (
        <Link
          to={`/agents/${resolvedAgentId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {agentName || "Agent"}
        </Link>
      )}
      <div className="flex items-start justify-between mb-1 gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{tc.scenario}</h1>
          {tc.locked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-primary/15 text-primary border border-primary/30 rounded-sm shrink-0">
              <Lock className="w-3 h-3" />
              Spec Case
            </span>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {tc.locked ? (
            <>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded">
                🔒 Spec Case
              </span>
              <button
                onClick={handleToggleLock}
                disabled={lockLoading}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {lockLoading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Unlock"}
              </button>
            </>
          ) : (
            <button
              onClick={handleToggleLock}
              disabled={lockLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary/30 text-primary rounded hover:bg-primary/10 transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {lockLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
              Lock
            </button>
          )}
        </div>
      </div>
      {lockError && (
        <p className="text-xs text-destructive mt-1">{lockError}</p>
      )}
      <p className="text-sm text-muted-foreground mb-6">Test Case {tc.id}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-5">
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Input</h2>
            <div className="border-l-2 border-primary/50 pl-4 py-2 bg-card rounded-r border border-l-0 border-border">
              <p className="text-sm text-foreground italic">{tc.input_text}</p>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tool Stubs</h2>
            {toolStubEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No tool stubs configured for this test case.</p>
            ) : (
              <div className="space-y-2">
                {toolStubEntries.map(([toolName, stub]) => (
                  <div key={toolName} className="border border-border rounded bg-card">
                    <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-foreground font-medium">{toolName}</span>
                      {stub.latency_ms != null && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                          <Clock className="w-2.5 h-2.5" />
                          {stub.latency_ms}ms
                        </span>
                      )}
                      {stub.simulate_failure ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-destructive/15 text-destructive border border-destructive/30 rounded-sm">
                          Simulates Failure
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-success/15 text-success border border-success/30 rounded-sm">
                          Normal
                        </span>
                      )}
                    </div>
                    <div className="border-t border-border">
                      <CodeBlock>{JSON.stringify(stub.response, null, 2)}</CodeBlock>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assertions</h2>
            <div className="space-y-1">
              {assertions.map((a: any, i: number) => {
                const typeStyle = assertionTypeColors[a.type] || "bg-muted text-muted-foreground border-border";
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 border border-border rounded bg-card text-sm flex-wrap">
                    <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono border rounded-sm shrink-0 ${typeStyle}`}>
                      {a.type}
                    </span>
                    {(a.tool_name || a.tool) && (
                      <span className="font-mono text-foreground text-xs">{a.tool_name || a.tool}</span>
                    )}
                    {a.param && (
                      <span className="text-muted-foreground text-xs font-mono">.{a.param}</span>
                    )}
                    {(a.expected != null || a.value != null) && (
                      <span className="text-xs text-muted-foreground font-mono">= {JSON.stringify(a.expected ?? a.value)}</span>
                    )}
                    {a.required && (
                      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-warning/15 text-warning border border-warning/30 rounded-sm shrink-0 ml-auto">
                        required
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Execution Trace</h2>

            {tc.trace && (
              <div className="space-y-2 mb-4">
                <div className="relative pl-4 border-l border-border space-y-3">
                  {tc.trace.calls.map((call, i) => (
                    <div key={i} className="border border-border rounded bg-card">
                      <button
                        onClick={() => toggleCall(i)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                      >
                        {expandedCalls.has(i) ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-mono font-medium text-foreground">{call.tool_name}</span>
                        <span className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm border border-border">
                            {call.latency_ms}ms
                          </span>
                          {call.simulate_failure && (
                            <span className="text-[10px] font-mono text-destructive bg-destructive/15 px-1.5 py-0.5 rounded-sm border border-destructive/30">
                              FAILURE
                            </span>
                          )}
                        </span>
                      </button>
                      {expandedCalls.has(i) && (
                        <div className="border-t border-border space-y-0">
                          <CodeBlock label="Params">{JSON.stringify(call.params, null, 2)}</CodeBlock>
                          <CodeBlock label="Response">{JSON.stringify(call.response, null, 2)}</CodeBlock>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Final Output</h3>
                  <div className="p-3 bg-card border border-border rounded text-sm text-foreground">
                    {tc.trace.final_output}
                  </div>
                </div>
              </div>
            )}

            {evalLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground border border-border rounded bg-card">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : hasEvalResults ? (
              <div className="space-y-4">
                {deterministicResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deterministic Checks</h3>
                    <div className="space-y-1">
                      {deterministicResults.map((r, i) => (
                        <div key={r.id ?? i} className="flex items-start gap-2 px-3 py-2 border border-border rounded bg-card text-sm">
                          <PassedBadge passed={r.passed} />
                          <span className="font-mono text-xs text-foreground shrink-0">{r.assertion_id}</span>
                          <span className="text-xs text-muted-foreground">{r.reason || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {semanticResults.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Judges</h3>
                    <div className="space-y-1">
                      {semanticResults.map((r, i) => (
                        <div key={r.id ?? i} className="flex items-start gap-2 px-3 py-2 border border-border rounded bg-card text-sm">
                          <PassedBadge passed={r.passed} />
                          <span className="font-mono text-xs text-foreground shrink-0">{r.assertion_id}</span>
                          <span className="text-xs text-muted-foreground">{r.reason || "—"}</span>
                          <span className="inline-flex px-1 py-0.5 text-[9px] font-mono bg-muted text-muted-foreground border border-border rounded-sm ml-auto shrink-0">AI judge</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`px-4 py-3 rounded border text-sm font-medium flex items-center gap-2 ${
                  passedCount === evalResults.length
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                }`}>
                  {passedCount === evalResults.length
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <XCircle className="w-4 h-4" />}
                  {passedCount} of {evalResults.length} checks passed
                </div>
              </div>
            ) : !tc.trace ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-border rounded bg-card">
                <Inbox className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Run eval to see results</p>
                {resolvedAgentId && (
                  <Link to={`/agents/${resolvedAgentId}`} className="text-xs text-primary hover:underline mt-2">
                    ← Back to {agentName || "agent"} to run eval
                  </Link>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
