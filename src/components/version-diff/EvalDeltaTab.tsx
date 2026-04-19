import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, type EvalRun, type EvalResult } from "@/lib/api";

interface Props {
  agentId: string;
  leftVersionId: string;
  rightVersionId: string;
}

interface VersionStats {
  runId: string | null;
  total: number;
  passed: number;
  avgLatency: number | null;
  resultById: Map<string, EvalResult>;
}

async function fetchLatestRunStats(agentId: string, versionId: string): Promise<VersionStats> {
  const runs = (await api.getEvalRuns().catch(() => [])) as EvalRun[];
  const versionRuns = runs
    .filter((r: any) => r.agent_id === agentId && r.agent_version_id === versionId)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  const latest = versionRuns[0];
  if (!latest) {
    return { runId: null, total: 0, passed: 0, avgLatency: null, resultById: new Map() };
  }
  const results = await api.getEvalRunResults(latest.id).catch(() => [] as EvalResult[]);
  const passFail = results.filter((r) => r.result_type !== "informational");
  const passed = passFail.filter((r) => r.passed === true).length;
  const latencies = results
    .map((r) => r.latency_ms)
    .filter((ms): ms is number => ms != null);
  const avgLatency = latencies.length === 0
    ? null
    : Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const resultById = new Map<string, EvalResult>();
  for (const r of results) {
    if (r.test_case_id) resultById.set(r.test_case_id, r);
  }
  return { runId: latest.id, total: passFail.length, passed, avgLatency, resultById };
}

export function EvalDeltaTab({ agentId, leftVersionId, rightVersionId }: Props) {
  const [loading, setLoading] = useState(true);
  const [left, setLeft] = useState<VersionStats | null>(null);
  const [right, setRight] = useState<VersionStats | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchLatestRunStats(agentId, leftVersionId),
      fetchLatestRunStats(agentId, rightVersionId),
    ])
      .then(([l, r]) => {
        setLeft(l);
        setRight(r);
      })
      .finally(() => setLoading(false));
  }, [agentId, leftVersionId, rightVersionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  if (!left || !right) return null;

  if (!left.runId || !right.runId) {
    return (
      <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
        One or both versions have no eval run yet. Run an eval on each version to compare.
      </div>
    );
  }

  const leftPct = left.total > 0 ? Math.round((left.passed / left.total) * 100) : 0;
  const rightPct = right.total > 0 ? Math.round((right.passed / right.total) * 100) : 0;
  const passDelta = rightPct - leftPct;
  const latencyDelta =
    left.avgLatency != null && right.avgLatency != null
      ? right.avgLatency - left.avgLatency
      : null;

  const newlyPassing: string[] = [];
  const newlyFailing: string[] = [];
  const allIds = new Set([...left.resultById.keys(), ...right.resultById.keys()]);
  for (const id of allIds) {
    const l = left.resultById.get(id);
    const r = right.resultById.get(id);
    if (l?.passed === false && r?.passed === true) newlyPassing.push(id);
    else if (l?.passed === true && r?.passed === false) newlyFailing.push(id);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 border border-border rounded overflow-hidden">
        <div className="p-3 border-r border-border">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Pass rate</div>
          <div className="text-sm text-muted-foreground mt-1">
            {leftPct}% → <span className="text-foreground font-semibold">{rightPct}%</span>
          </div>
          <div className={`text-xs mt-0.5 ${passDelta > 0 ? "text-success" : passDelta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {passDelta > 0 ? "+" : ""}{passDelta} pts
          </div>
        </div>
        <div className="p-3 border-r border-border">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Avg latency</div>
          <div className="text-sm text-muted-foreground mt-1">
            {left.avgLatency ?? "—"}ms → <span className="text-foreground font-semibold">{right.avgLatency ?? "—"}ms</span>
          </div>
          {latencyDelta != null && (
            <div className={`text-xs mt-0.5 ${latencyDelta < 0 ? "text-success" : latencyDelta > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              {latencyDelta > 0 ? "+" : ""}{latencyDelta}ms
            </div>
          )}
        </div>
        <div className="p-3">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Cases</div>
          <div className="text-sm text-muted-foreground mt-1">
            {left.total} → <span className="text-foreground font-semibold">{right.total}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-border rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-success/10">
            <h3 className="text-xs font-semibold text-success uppercase tracking-wider">
              Newly passing ({newlyPassing.length})
            </h3>
          </div>
          {newlyPassing.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No cases flipped to passing.</p>
          ) : (
            <ul className="divide-y divide-border">
              {newlyPassing.map((id) => (
                <li key={id} className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
                  {id.slice(0, 12)}…
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border border-border rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-destructive/10">
            <h3 className="text-xs font-semibold text-destructive uppercase tracking-wider">
              Newly failing ({newlyFailing.length})
            </h3>
          </div>
          {newlyFailing.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No cases flipped to failing.</p>
          ) : (
            <ul className="divide-y divide-border">
              {newlyFailing.map((id) => (
                <li key={id} className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
                  {id.slice(0, 12)}…
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
