import { useState, useEffect } from "react";
import { api, type EvalRun, type EvalResult } from "@/lib/api";
import { StatusBadge } from "@/components/ui-shared";
import { Loader2, AlertCircle, PlayCircle, ChevronDown, ChevronRight } from "lucide-react";

export default function EvalRunHistory() {
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, EvalResult[]>>({});
  const [loadingResults, setLoadingResults] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getEvalRuns()
      .then(setRuns)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

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
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Run ID</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Agent</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Started</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const isExpanded = expandedRun === run.id;
                const runResults = results[run.id];
                const typeBadge = run.run_type === "full"
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-warning/15 text-warning border-warning/30";
                return (
                  <>
                    <tr
                      key={run.id}
                      className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(run.id)}
                    >
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-foreground">{run.id.slice(0, 8)}…</td>
                      <td className="px-3 py-2.5 text-foreground">{run.agent_name || run.agent_id.slice(0, 8)}</td>
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-foreground">{run.pass_count}/{run.total_count}</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-success rounded-full transition-all"
                              style={{ width: run.total_count ? `${(run.pass_count / run.total_count) * 100}%` : "0%" }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${run.id}-detail`} className="border-b border-border">
                        <td colSpan={7} className="px-6 py-4 bg-muted/10">
                          {loadingResults === run.id ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading results…
                            </div>
                          ) : runResults ? (
                            <div className="space-y-1">
                              {runResults.map((r, i) => (
                                <div key={i} className="flex items-start gap-3 px-3 py-2 border border-border rounded bg-card text-sm">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-foreground">{r.scenario}</span>
                                  </div>
                                  <StatusBadge status={r.status} />
                                  {r.failed_assertions.length > 0 && (
                                    <div className="text-xs text-destructive space-y-0.5 max-w-[300px]">
                                      {r.failed_assertions.map((fa, j) => (
                                        <div key={j} className="font-mono">{fa.type}: {fa.reason}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
