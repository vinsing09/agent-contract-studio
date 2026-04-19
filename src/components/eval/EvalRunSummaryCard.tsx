import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { EvalResult } from "@/lib/api";

interface Props {
  results: EvalResult[];
  summary?: Record<string, unknown> | null;
}

function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return ms >= 1000 ? ms.toLocaleString() + "ms" : ms + "ms";
}

function computeAvgLatency(results: EvalResult[]): number | null {
  const latencies = results
    .map((r) => r.latency_ms)
    .filter((ms): ms is number => ms != null);
  if (latencies.length === 0) return null;
  return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
}

function Tile({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "danger" | "muted";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
      ? "text-destructive"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";
  return (
    <div className="flex-1 min-w-[140px] px-4 py-3 border-r border-border last:border-r-0">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function EvalRunSummaryCard({ results, summary }: Props) {
  const passFail = results.filter((r) => r.result_type !== "informational");
  const informational = results.filter((r) => r.result_type === "informational");
  const deterministic = passFail.filter((r) => r.result_type === "deterministic");
  const semantic = passFail.filter((r) => r.result_type === "semantic");

  const total = (summary?.total as number | undefined) ?? passFail.length;
  const passed =
    (summary?.passed as number | undefined) ??
    passFail.filter((r) => r.passed === true).length;
  const failed =
    (summary?.failed as number | undefined) ??
    passFail.filter((r) => r.passed === false).length;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;

  const avgLatency = computeAvgLatency(passFail);
  const budgetOver = informational.filter((r) => r.passed === false).length;

  const detPassed = deterministic.filter((r) => r.passed === true).length;
  const semPassed = semantic.filter((r) => r.passed === true).length;

  const passTone = pct >= 90 ? "success" : pct >= 70 ? "default" : "danger";

  return (
    <div className="border border-border rounded bg-card">
      <div className="flex flex-wrap">
        <Tile
          label="Pass rate"
          value={`${pct}%`}
          sub={`${passed}/${total} passed`}
          tone={passTone}
          icon={<CheckCircle2 className="w-3 h-3" />}
        />
        <Tile
          label="Avg latency"
          value={formatLatency(avgLatency)}
          sub={informational.length > 0 ? `${budgetOver} over budget` : undefined}
          tone={budgetOver > 0 ? "danger" : "default"}
          icon={<Clock className="w-3 h-3" />}
        />
        {deterministic.length > 0 && (
          <Tile
            label="Deterministic"
            value={`${detPassed}/${deterministic.length}`}
            tone="muted"
          />
        )}
        {semantic.length > 0 && (
          <Tile
            label="Semantic"
            value={`${semPassed}/${semantic.length}`}
            tone="muted"
          />
        )}
        {failed > 0 && (
          <Tile
            label="Failed"
            value={String(failed)}
            tone="danger"
            icon={<XCircle className="w-3 h-3" />}
          />
        )}
      </div>
    </div>
  );
}
