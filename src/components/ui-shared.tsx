import { cn } from "@/lib/utils";

interface CodeBlockProps {
  children: string;
  className?: string;
  label?: string;
}

export function CodeBlock({ children, className, label }: CodeBlockProps) {
  return (
    <div className={cn("rounded border border-border bg-background overflow-hidden", className)}>
      {label && (
        <div className="px-3 py-1.5 border-b border-border bg-muted/50">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
      )}
      <pre className="p-3 overflow-x-auto text-sm font-mono text-foreground leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

interface StatusBadgeProps {
  status: "PASS" | "FAIL" | "PENDING" | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    PASS: "bg-success/15 text-success border-success/30",
    FAIL: "bg-destructive/15 text-destructive border-destructive/30",
    PENDING: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-medium border rounded-sm", styles[status] || styles.PENDING)}>
      {status}
    </span>
  );
}

interface TagBadgeProps {
  tag: string;
}

const tagColors: Record<string, string> = {
  happy_path: "bg-success/15 text-success border-success/30",
  tool_failure: "bg-destructive/15 text-destructive border-destructive/30",
  edge_case: "bg-warning/15 text-warning border-warning/30",
};

export function TagBadge({ tag }: TagBadgeProps) {
  const style = tagColors[tag] || "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border rounded-sm", style)}>
      {tag}
    </span>
  );
}
