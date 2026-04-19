import type { RegressionType } from "@/lib/api";

export type RegressionFilter = "ALL" | "STABLE" | "REGRESSION" | "IMPROVEMENT" | "NO_PROGRESS";

interface Props {
  value: RegressionFilter;
  counts: Partial<Record<RegressionFilter, number>>;
  onChange: (f: RegressionFilter) => void;
}

const order: { key: RegressionFilter; label: string; tone: string }[] = [
  { key: "ALL", label: "All", tone: "bg-muted text-foreground border-border" },
  { key: "REGRESSION", label: "Regression", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  { key: "IMPROVEMENT", label: "Improvement", tone: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { key: "STABLE", label: "Stable", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  { key: "NO_PROGRESS", label: "No progress", tone: "bg-muted text-muted-foreground border-border" },
];

export function RegressionFilterChips({ value, counts, onChange }: Props) {
  const total = counts.ALL ?? 0;
  const shown = order.filter((o) => o.key === "ALL" || (counts[o.key] ?? 0) > 0);
  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((o) => {
        const count = counts[o.key] ?? 0;
        const active = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border transition-colors ${
              active ? o.tone : "bg-transparent text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {o.label}
            <span className="font-mono text-[10px] opacity-75">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function filterByRegressionType<T extends { regression_type?: RegressionType | null }>(
  rows: T[],
  filter: RegressionFilter
): T[] {
  if (filter === "ALL") return rows;
  return rows.filter((r) => {
    const rt = r.regression_type;
    if (!rt) return false;
    return String(rt).toUpperCase() === filter;
  });
}

export function countByRegressionType<T extends { regression_type?: RegressionType | null }>(
  rows: T[]
): Partial<Record<RegressionFilter, number>> {
  const counts: Partial<Record<RegressionFilter, number>> = { ALL: rows.length };
  for (const r of rows) {
    const rt = r.regression_type;
    if (!rt) continue;
    const key = String(rt).toUpperCase() as RegressionFilter;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
