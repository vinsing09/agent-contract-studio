import React, { useState, useEffect } from "react";
import { api, type EvalRun, type EvalResult, type Agent } from "@/lib/api";
import { StatusBadge } from "@/components/ui-shared";
import { Loader2, AlertCircle, PlayCircle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function PassedBadge({ passed }: { passed: boolean | null }) {
  if (passed === true) return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium bg-success/15 text-success border border-success/30 rounded-sm">PASS</span>;
  if (passed === false) return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium bg-destructive/15 text-destructive border border-destructive/30 rounded-sm">FAIL</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono font-medium bg-muted text-muted-foreground border border-border rounded-sm cursor-default">SKIP</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Judge skipped due to response parsing error</TooltipContent>
    </Tooltip>
  );
}

function formatAssertionLabel(r: EvalResult): string {
  if (r.assertion_type && r.tool_name && r.param) {
    return `${r.assertion_type}: ${r.tool_name} → ${r.param}`;
  }
  if (r.assertion_type && r.tool_name) {
    return `${r.assertion_type}: ${r.tool_name}`;
  }
  if (r.assertion_type) {
    return r.assertion_type;
  }
  return r.assertion_id;
}

function groupByTestCase(results: EvalResult[]): Record<string, EvalResult[]> {
  const groups: Record<string, EvalResult[]> = {};
  for (const r of results) {
    const key = r.test_case_id ?? "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

export default function EvalRunHistory() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, EvalResult[]>>({});
  const [loadingResults, setLoadingResults] = useState<string | null>(null);
  const [passRates, setPassRates] = useState<Record<string, { passed: number; total: number }>>({});
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getAgents()
      .then((agents) => {
        const map: Record<string, string> = {};
        for (const a of agents) map[a.id] = a.name;
        setAgentNames(map);
      })
      .catch(() => {});

    api.getEvalRuns()
      .then(async (fetchedRuns) => {
        setRuns(fetchedRuns);
        const rates: Record<string, { passed: number; total: number }> = {};
        await Promise.all(
          fetchedRuns.map(async (run) => {
            try {
              const r = await api.getEvalRunResults(run.id);
              setResults((prev) => ({ ...prev, [run.id]: r }));
              const passed = r.filter((res) => res.passed === true).length;
              rates[run.id] = { passed, total: r.length };
            } catch {
              rates[run.id] = { passed: 0, total: 0 };
            }
          })
        );
        setPassRates(rates);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);
    if (!results[runId]) {
      setLoadingResults(runId);
      try {
        const r = await api.getEvalRunResults(runId);
        setResults((prev) => ({ ...prev, [runId]: r }));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingResults(null);
      }
    }
  };

  const handleDeleteRun = async () => {
    if (!deleteModal) return;
    setDeletingId(deleteModal);
    try {
      await api.deleteEvalRun(deleteModal);
      setRuns((prev) => prev.filter((r) => r.id !== deleteModal));
      setDeleteModal(null);
      if (expandedRun === deleteModal) setExpandedRun(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );
  const runNumberMap: Record<string, number> = {};
  sortedRuns.forEach((run, i) => { runNumberMap[run.id] = i + 1; });
  const displayRuns = [...sortedRuns].reverse();

  return (
    <div className="px-6 py-6 animate-fade-in">
      <h1 className="text-lg font-semibold text-foreground mb-1">Eval Runs</h1>
      <p className="text-sm text-muted-foreground mb-5">History of evaluation runs across all agents.</p>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <PlayCircle className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No eval runs yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8"></th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Run</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Agent</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Started</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pass Rate</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-12"></th>
              </tr>
            </thead>
            <tbody>
              {displayRuns.map((run) => {
                const isExpanded = expandedRun === run.id;
                const runResults = results[run.id];
                const rate = passRates[run.id];
                const typeBadge = run.run_type === "full"
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-warning/15 text-warning border-warning/30";
                const pct = rate && rate.total > 0 ? (rate.passed / rate.total) * 100 : 0;
                const barColor = rate && rate.total > 0 && rate.passed === rate.total ? "bg-success" : "bg-destructive";
                const runNum = runNumberMap[run.id];
                return (
                  <React.Fragment key={run.id}>
                    <tr
                      className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(run.id)}
                    >
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono text-xs text-foreground cursor-default">Run #{runNum}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="font-mono text-xs">
                            {run.id}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2.5 text-foreground">
                        {agentNames[run.agent_id] || run.agent_name || run.agent_id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono border rounded-sm ${typeBadge}`}>
                          {run.run_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={run.status} /></td>
                      <td className="px-3 py-2.5">
                        {rate ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-foreground">{rate.passed}/{rate.total}</span>
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${barColor}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteModal(run.id); }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-border">
                        <td colSpan={8} className="px-6 py-4 bg-muted/10">
                          {loadingResults === run.id ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading results…
                            </div>
                          ) : runResults ? (
                            runResults.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No results for this run.</p>
                            ) : (
                              <div className="space-y-3">
                                {/* Legend */}
                                <div className="flex items-center gap-3 pb-2 border-b border-border">
                                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Legend:</span>
                                  <span className="inline-flex items-center gap-1 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-success" />PASS</span>
                                  <span className="inline-flex items-center gap-1 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-destructive" />FAIL</span>
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />SKIP — parsing error</span>
                                </div>
                                {Object.entries(groupByTestCase(runResults)).map(([tcId, assertions]) => {
                                  const scenario = assertions[0]?.scenario;
                                  return (
                                  <div key={tcId}>
                                    <div className="mb-1.5 border-b border-border pb-1">
                                      <p className="text-xs font-medium text-foreground">
                                        {scenario || `Test Case ${tcId.slice(0, 12)}…`}
                                      </p>
                                      <p className="text-[10px] font-mono text-muted-foreground">{tcId}</p>
                                    </div>
                                    <div className="space-y-1 ml-2">
                                      {assertions.map((r, i) => {
                                        const label = formatAssertionLabel(r);
                                        return (
                                        <div key={r.id ?? i} className="flex items-center gap-2 text-sm">
                                          <PassedBadge passed={r.passed} />
                                          <span className="font-mono text-xs text-foreground">{label}</span>
                                          <span className="text-xs text-muted-foreground truncate max-w-[400px]">{r.reason || "—"}</span>
                                          {r.result_type === "semantic" && (
                                            <span className="inline-flex px-1 py-0.5 text-[9px] font-mono bg-muted text-muted-foreground border border-border rounded-sm ml-auto shrink-0">AI judge</span>
                                          )}
                                        </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground">No results available.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Eval Run Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteModal(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-5 h-5 text-destructive" />
              <h3 className="text-base font-semibold text-foreground">Delete Eval Run</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Delete this eval run and all its results? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRun}
                disabled={deletingId === deleteModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deletingId === deleteModal && <Loader2 className="w-3 h-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
