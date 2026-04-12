import React, { useState, useEffect } from "react";
import { api, type EvalRun, type EvalResult, type Agent, type AgentVersion } from "@/lib/api";
import { parseApiError } from "@/lib/utils";
import { StatusBadge } from "@/components/ui-shared";
import {
  Loader2, AlertCircle, PlayCircle, ChevronDown, ChevronRight,
  Trash2, ArrowLeft, CheckCircle2, XCircle, Clock
} from "lucide-react";
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
}

function formatLatency(ms: number): string {
  return ms >= 1000 ? ms.toLocaleString() + "ms" : ms + "ms";
}

function groupByTestCase(results: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const r of results) {
    const key = r.test_case_id ?? "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  return groups;
}

type View = { type: "list" } | { type: "detail"; runId: string };

export default function EvalRunHistory() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [versionMap, setVersionMap] = useState<Record<string, number>>({});
  const [passRates, setPassRates] = useState<Record<string, { passed: number; total: number }>>({});
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Detail view state
  const [view, setView] = useState<View>({ type: "list" });
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scenarioMap, setScenarioMap] = useState<Record<string, string>>({});
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);

    const agentPromise = api.getAgents().then((agents) => {
      const nameMap: Record<string, string> = {};
      for (const a of agents) nameMap[a.id] = a.name;
      setAgentNames(nameMap);

      // Build version map from all agents
      return Promise.all(
        agents.map((a) =>
          api.getAgentVersions(a.id).then((versions) => {
            const vm: Record<string, number> = {};
            for (const v of versions) vm[v.id] = v.version_number;
            return vm;
          }).catch(() => ({} as Record<string, number>))
        )
      ).then((maps) => {
        const merged: Record<string, number> = {};
        for (const m of maps) Object.assign(merged, m);
        setVersionMap(merged);
      });
    }).catch(() => {});

    const runsPromise = api.getEvalRuns().then(async (fetchedRuns) => {
      setRuns(fetchedRuns);
      const rates: Record<string, { passed: number; total: number }> = {};
      await Promise.all(
        fetchedRuns.map(async (run) => {
          try {
            // Try to get summary from the run itself first
            const r = run as any;
            if (r.summary_json) {
              rates[run.id] = {
                passed: r.summary_json.passed ?? 0,
                total: r.summary_json.total ?? 0,
              };
            } else {
              const results = await api.getEvalRunResults(run.id);
              const passed = results.filter((res) => res.passed === true).length;
              rates[run.id] = { passed, total: results.length };
            }
          } catch {
            rates[run.id] = { passed: 0, total: 0 };
          }
        })
      );
      setPassRates(rates);
    });

    Promise.all([agentPromise, runsPromise])
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (runId: string) => {
    setView({ type: "detail", runId });
    setDetailLoading(true);
    setDetailData(null);
    try {
      const data = await api.getEvalRunDetail(runId);
      setDetailData(data);

      // Build scenario map from test_case_ids in results
      const tcIds = new Set((data.results ?? []).map((r: any) => r.test_case_id).filter(Boolean));
      const scenarios: Record<string, string> = {};
      await Promise.all(
        Array.from(tcIds).map(async (tcId) => {
          try {
            const tc = await api.getTestCaseDetail(tcId as string);
            if (tc?.scenario) scenarios[tcId as string] = tc.scenario;
          } catch {}
        })
      );
      setScenarioMap(scenarios);
    } catch (err: any) {
      setError(parseApiError(err));
      setView({ type: "list" });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!deleteModal) return;
    setDeletingId(deleteModal);
    try {
      await api.deleteEvalRun(deleteModal);
      setRuns((prev) => prev.filter((r) => r.id !== deleteModal));
      setDeleteModal(null);
      if (view.type === "detail" && view.runId === deleteModal) setView({ type: "list" });
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleReason = (id: string) => {
    setExpandedReasons((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  );
  const runNumberMap: Record<string, number> = {};
  sortedRuns.forEach((run, i) => { runNumberMap[run.id] = i + 1; });
  const displayRuns = [...sortedRuns].reverse();

  // ─── DETAIL VIEW ───
  if (view.type === "detail") {
    const run = runs.find((r) => r.id === view.runId);
    const runAny = run as any;

    if (detailLoading) {
      return (
        <div className="px-6 py-6 animate-fade-in">
          <button onClick={() => setView({ type: "list" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Eval Runs
          </button>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        </div>
      );
    }

    const evalRun = detailData?.eval_run ?? run;
    const summary = detailData?.summary ?? {};
    const results: any[] = detailData?.results ?? [];
    const grouped = groupByTestCase(results);

    const total = summary.total ?? results.length;
    const passed = summary.passed ?? results.filter((r: any) => r.passed === true).length;
    const failed = summary.failed ?? results.filter((r: any) => r.passed === false).length;
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgLatency = (runAny?.summary_json?.avg_latency_ms) ?? (evalRun?.summary_json?.avg_latency_ms) ?? null;
    const versionId = evalRun?.agent_version_id ?? runAny?.agent_version_id;
    const versionNum = versionId ? versionMap[versionId] : null;
    const agentId = evalRun?.agent_id ?? run?.agent_id;
    const agentName = agentId ? agentNames[agentId] : "Unknown";
    const runType = evalRun?.run_type ?? run?.run_type ?? "full";
    const status = evalRun?.status ?? run?.status;

    return (
      <div className="px-6 py-6 animate-fade-in">
        <button onClick={() => { setView({ type: "list" }); setExpandedReasons(new Set()); }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Eval Runs
        </button>

        {error && (
          <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-foreground">Run #{runNumberMap[view.runId] ?? "?"}</h1>
            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono border rounded-sm ${runType === "full" ? "bg-primary/15 text-primary border-primary/30" : "bg-purple-500/15 text-purple-400 border-purple-500/30"}`}>
              {runType}
            </span>
            <StatusBadge status={status} />
            {versionNum != null && (
              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">v{versionNum}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{agentName}</p>

          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-foreground">{passed}/{total} passed ({pct}%)</span>
            </div>
            {avgLatency != null && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{formatLatency(Math.round(avgLatency))} avg</span>
              </div>
            )}
            {evalRun?.started_at && (
              <span className="text-xs text-muted-foreground">{formatDate(evalRun.started_at)}</span>
            )}
          </div>

          {/* Summary breakdown */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {summary.deterministic != null && <span>Deterministic: {summary.deterministic}</span>}
            {summary.semantic != null && <span>Semantic: {summary.semantic}</span>}
            {failed > 0 && <span className="text-destructive">Failed: {failed}</span>}
          </div>
        </div>

        {/* Results table */}
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No results for this run.</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scenario</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Assertion</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-16">Result</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Reason</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">Latency</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([tcId, assertions]) => {
                  const scenario = scenarioMap[tcId] || assertions[0]?.scenario || `Test ${tcId.slice(0, 10)}…`;
                  return (
                    <React.Fragment key={tcId}>
                      {/* Group header */}
                      <tr className="border-b border-border bg-muted/20">
                        <td colSpan={6} className="px-3 py-2">
                          <span className="text-xs font-medium text-foreground">{scenario}</span>
                          <span className="ml-2 text-[10px] font-mono text-muted-foreground">{tcId.slice(0, 12)}…</span>
                        </td>
                      </tr>
                      {assertions.map((r: any, i: number) => {
                        const reasonId = `${tcId}-${i}`;
                        const reason = r.reason || "—";
                        const isTruncated = reason.length > 100;
                        const showFull = expandedReasons.has(reasonId);
                        return (
                          <tr key={r.id ?? i} className="border-b border-border hover:bg-muted/10 transition-colors">
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono border rounded-sm ${
                                r.result_type === "semantic"
                                  ? "bg-primary/15 text-primary border-primary/30"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}>
                                {r.result_type || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs font-mono text-foreground">
                              {r.assertion_id?.slice(0, 12) ?? "—"}
                            </td>
                            <td className="px-3 py-2">
                              <PassedBadge passed={r.passed} />
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground max-w-[300px]">
                              {isTruncated && !showFull ? (
                                <span>
                                  {reason.slice(0, 100)}…{" "}
                                  <button onClick={() => toggleReason(reasonId)} className="text-primary hover:underline text-[11px]">show more</button>
                                </span>
                              ) : isTruncated && showFull ? (
                                <span>
                                  {reason}{" "}
                                  <button onClick={() => toggleReason(reasonId)} className="text-primary hover:underline text-[11px]">show less</button>
                                </span>
                              ) : (
                                reason
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-mono text-muted-foreground">
                              {r.latency_ms != null ? formatLatency(r.latency_ms) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="px-6 py-6 animate-fade-in">
      <h1 className="text-lg font-semibold text-foreground mb-1">Eval Runs</h1>
      <p className="text-sm text-muted-foreground mb-5">History of evaluation runs across all agents.</p>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
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
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Run</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Agent</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Version</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pass Rate</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Avg Latency</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28"></th>
              </tr>
            </thead>
            <tbody>
              {displayRuns.map((run) => {
                const runAny = run as any;
                const rate = passRates[run.id];
                const pct = rate && rate.total > 0 ? Math.round((rate.passed / rate.total) * 100) : 0;
                const barColor = rate && rate.total > 0 && rate.passed === rate.total ? "bg-success" : "bg-destructive";
                const runNum = runNumberMap[run.id];
                const versionId = runAny.agent_version_id;
                const versionNum = versionId ? versionMap[versionId] : null;
                const avgLatency = runAny.summary_json?.avg_latency_ms;
                const typeBadge = run.run_type === "full"
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-purple-500/15 text-purple-400 border-purple-500/30";

                return (
                  <tr key={run.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono text-xs text-foreground cursor-default">Run #{runNum}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="font-mono text-xs">{run.id}</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2.5 text-foreground">
                      {agentNames[run.agent_id] || run.agent_name || run.agent_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2.5">
                      {versionNum != null ? (
                        <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">v{versionNum}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono border rounded-sm ${typeBadge}`}>
                        {run.run_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={run.status} /></td>
                    <td className="px-3 py-2.5">
                      {rate ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-foreground">{rate.passed}/{rate.total} ({pct}%)</span>
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      ) : (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                      {avgLatency != null ? formatLatency(Math.round(avgLatency)) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {run.started_at ? formatDate(run.started_at) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => openDetail(run.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        View Details →
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteModal(run.id); }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Modal */}
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
              <button onClick={() => setDeleteModal(null)} className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors">Cancel</button>
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
