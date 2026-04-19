import type { ContractV2, ObligationV2, ForbiddenBehavior, LatencyBudget, ToolSequence } from "@/lib/types";
import { Plus, Minus, Equal } from "lucide-react";

interface Props {
  left: ContractV2 | null;
  right: ContractV2 | null;
  leftLabel?: string;
  rightLabel?: string;
}

type DiffState = "added" | "removed" | "unchanged";

function diffStrings(
  leftItems: string[],
  rightItems: string[]
): { text: string; state: DiffState }[] {
  const leftSet = new Set(leftItems);
  const rightSet = new Set(rightItems);
  const union = Array.from(new Set([...leftItems, ...rightItems]));
  return union.map((text) => {
    if (leftSet.has(text) && rightSet.has(text)) return { text, state: "unchanged" as const };
    if (rightSet.has(text)) return { text, state: "added" as const };
    return { text, state: "removed" as const };
  });
}

function Row({ state, children }: { state: DiffState; children: React.ReactNode }) {
  const icon =
    state === "added" ? <Plus className="w-3 h-3 text-success" /> :
    state === "removed" ? <Minus className="w-3 h-3 text-destructive" /> :
    <Equal className="w-3 h-3 text-muted-foreground" />;
  const bg =
    state === "added" ? "bg-success/5" :
    state === "removed" ? "bg-destructive/5 line-through opacity-70" :
    "";
  return (
    <div className={`flex items-start gap-2 px-3 py-1.5 text-xs border-b border-border last:border-b-0 ${bg}`}>
      <span className="mt-0.5">{icon}</span>
      <span className="text-foreground break-words">{children}</span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

export function ContractDiff({ left, right, leftLabel, rightLabel }: Props) {
  if (!left && !right) {
    return (
      <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
        No contract data for either version.
      </div>
    );
  }

  const leftObs: ObligationV2[] = left?.obligations ?? [];
  const rightObs: ObligationV2[] = right?.obligations ?? [];
  const obligationDiff = diffStrings(
    leftObs.map((o) => o.text),
    rightObs.map((o) => o.text)
  );

  const leftForbidden: ForbiddenBehavior[] = left?.forbidden_behaviors ?? [];
  const rightForbidden: ForbiddenBehavior[] = right?.forbidden_behaviors ?? [];
  const forbiddenDiff = diffStrings(
    leftForbidden.map((f) => f.text),
    rightForbidden.map((f) => f.text)
  );

  const leftLatency: LatencyBudget[] = left?.latency_budgets ?? [];
  const rightLatency: LatencyBudget[] = right?.latency_budgets ?? [];
  const latencyDiff = diffStrings(
    leftLatency.map((b) => `${b.scenario}: ≤${b.max_latency_ms}ms`),
    rightLatency.map((b) => `${b.scenario}: ≤${b.max_latency_ms}ms`)
  );

  const leftSeq: ToolSequence[] = left?.tool_sequences ?? [];
  const rightSeq: ToolSequence[] = right?.tool_sequences ?? [];
  const sequenceDiff = diffStrings(
    leftSeq.map((s) => `${s.scenario}: ${s.sequence.join(" → ")}`),
    rightSeq.map((s) => `${s.scenario}: ${s.sequence.join(" → ")}`)
  );

  return (
    <div className="space-y-4">
      {(leftLabel || rightLabel) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{leftLabel ?? "Baseline"}</span>
          <span>→</span>
          <span>{rightLabel ?? "Challenger"}</span>
        </div>
      )}

      <Section title="Obligations" count={obligationDiff.length}>
        {obligationDiff.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">No obligations.</p>
        ) : (
          obligationDiff.map((d, i) => (
            <Row key={i} state={d.state}>{d.text}</Row>
          ))
        )}
      </Section>

      <Section title="Forbidden behaviors" count={forbiddenDiff.length}>
        {forbiddenDiff.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">None.</p>
        ) : (
          forbiddenDiff.map((d, i) => (
            <Row key={i} state={d.state}>{d.text}</Row>
          ))
        )}
      </Section>

      <Section title="Latency budgets" count={latencyDiff.length}>
        {latencyDiff.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">None.</p>
        ) : (
          latencyDiff.map((d, i) => (
            <Row key={i} state={d.state}>{d.text}</Row>
          ))
        )}
      </Section>

      <Section title="Tool sequences" count={sequenceDiff.length}>
        {sequenceDiff.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">None.</p>
        ) : (
          sequenceDiff.map((d, i) => (
            <Row key={i} state={d.state}>{d.text}</Row>
          ))
        )}
      </Section>
    </div>
  );
}
