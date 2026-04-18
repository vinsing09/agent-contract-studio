import type { RegressionType } from "@/lib/api";

interface Props {
  type?: RegressionType | null;
  className?: string;
}

const styles: Record<string, string> = {
  STABLE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  REGRESSION: "bg-destructive/15 text-destructive border-destructive/30",
  IMPROVEMENT: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  NO_PROGRESS: "bg-muted text-muted-foreground border-border",
};

const labels: Record<string, string> = {
  STABLE: "stable",
  REGRESSION: "regression",
  IMPROVEMENT: "improvement",
  NO_PROGRESS: "no progress",
};

export function RegressionTypeBadge({ type, className = "" }: Props) {
  if (!type) return null;
  const key = String(type).toUpperCase();
  const toneClass = styles[key] ?? "bg-muted text-muted-foreground border-border";
  const label = labels[key] ?? String(type).toLowerCase();
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono border rounded-sm ${toneClass} ${className}`}
    >
      {label}
    </span>
  );
}
