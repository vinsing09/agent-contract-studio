import { Clock } from "lucide-react";
import type { EvalResult } from "@/lib/api";

interface Props {
  informational: EvalResult[];
  scenarioMap: Record<string, string>;
}

function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return ms >= 1000 ? ms.toLocaleString() + "ms" : ms + "ms";
}

export function LatencyBudgetCard({ informational, scenarioMap }: Props) {
  if (informational.length === 0) return null;

  const within = informational.filter((r) => r.passed === true).length;
  const over = informational.filter((r) => r.passed === false).length;

  return (
    <div className="mt-6 border border-border rounded bg-card">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">Latency budgets</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          <span className="text-success">{within} within</span>
          <span className="mx-1 text-muted-foreground/50">•</span>
          <span className={over > 0 ? "text-destructive" : "text-muted-foreground"}>{over} over</span>
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/20">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scenario</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-24">Measured</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">Result</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Reason</th>
          </tr>
        </thead>
        <tbody>
          {informational.map((r, i) => {
            const scenario = scenarioMap[r.test_case_id] || r.scenario || `Test ${r.test_case_id.slice(0, 10)}…`;
            return (
              <tr key={r.id ?? i} className="border-b border-border last:border-b-0 hover:bg-muted/10 transition-colors">
                <td className="px-3 py-2 text-xs text-foreground">{scenario}</td>
                <td className="px-3 py-2 text-right text-xs font-mono text-muted-foreground">
                  {formatLatency(r.latency_ms)}
                </td>
                <td className="px-3 py-2">
                  {r.passed === true ? (
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-success/15 text-success border border-success/30 rounded-sm">
                      within
                    </span>
                  ) : r.passed === false ? (
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-destructive/15 text-destructive border border-destructive/30 rounded-sm">
                      over
                    </span>
                  ) : (
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                      —
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.reason || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
