import { Check, XCircle } from "lucide-react";
import type { Suggestion } from "@/lib/types";

interface Props {
  suggestion: Suggestion;
  accepted: boolean;
  rejected: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function SuggestionCard({
  suggestion: s,
  accepted,
  rejected,
  onAccept,
  onReject,
}: Props) {
  const watching = s.fixes_watching ?? [];
  return (
    <div className="border border-border rounded bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onAccept}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border transition-colors ${
            accepted
              ? "bg-success/15 text-success border-success/30"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
          }`}
        >
          <Check className="w-3 h-3" />
          Accept
        </button>
        <button
          onClick={onReject}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border transition-colors ${
            rejected
              ? "bg-destructive/15 text-destructive border-destructive/30"
              : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
          }`}
        >
          <XCircle className="w-3 h-3" />
          Reject
        </button>
        {s.confidence != null && (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground">
            {Math.round(s.confidence * 100)}% confidence
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-foreground">{s.failure_pattern}</p>
      <p className="text-xs text-muted-foreground">{s.description}</p>
      {s.prompt_patch && (
        <pre className="p-2 text-xs font-mono bg-muted/50 border border-border rounded overflow-x-auto max-w-full text-foreground leading-relaxed whitespace-pre-wrap break-words">
          <code>{s.prompt_patch}</code>
        </pre>
      )}
      {watching.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-muted-foreground">
            Watching {watching.length} case{watching.length === 1 ? "" : "s"}:
          </span>
          {watching.map((w, i) => (
            <span
              key={i}
              className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm"
            >
              {w}
            </span>
          ))}
        </div>
      )}
      {s.must_hold_risk && s.must_hold_risk !== "None" && (
        <p className="text-[10px] text-amber-500">
          Must-hold risk: {s.must_hold_risk}
        </p>
      )}
    </div>
  );
}
