import type { AgentVersion } from "@/lib/api";
import type { ContractV2 } from "@/lib/types";

type Tab = "prompt" | "schema" | "contract" | "eval";

interface Props {
  leftVersion: AgentVersion | null;
  rightVersion: AgentVersion | null;
  leftContract: ContractV2 | null;
  rightContract: ContractV2 | null;
  onJump: (tab: Tab) => void;
}

function stringEq(a: string | undefined | null, b: string | undefined | null): boolean {
  return (a ?? "") === (b ?? "");
}

function jsonEq(a: any, b: any): boolean {
  try {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  } catch {
    return false;
  }
}

function countDelta(leftItems: string[], rightItems: string[]): { added: number; removed: number } {
  const leftSet = new Set(leftItems);
  const rightSet = new Set(rightItems);
  let added = 0;
  let removed = 0;
  for (const t of rightSet) if (!leftSet.has(t)) added++;
  for (const t of leftSet) if (!rightSet.has(t)) removed++;
  return { added, removed };
}

function Pill({
  label,
  changed,
  detail,
  tone = "default",
  onClick,
}: {
  label: string;
  changed: boolean;
  detail?: string;
  tone?: "default" | "added" | "removed" | "mixed";
  onClick: () => void;
}) {
  const base = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors cursor-pointer";
  const toneClass = !changed
    ? "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
    : tone === "added"
      ? "bg-success/10 border-success/30 text-success hover:bg-success/20"
      : tone === "removed"
        ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
        : tone === "mixed"
          ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
          : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20";
  return (
    <button type="button" onClick={onClick} className={`${base} ${toneClass}`}>
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-[10px] font-mono opacity-90">{detail ?? (changed ? "changed" : "same")}</span>
    </button>
  );
}

export function VersionDiffSummary({ leftVersion, rightVersion, leftContract, rightContract, onJump }: Props) {
  if (!leftVersion || !rightVersion) return null;

  const promptChanged = !stringEq(leftVersion.system_prompt, rightVersion.system_prompt);
  const schemaChanged = !jsonEq(leftVersion.tool_schemas, rightVersion.tool_schemas);

  const obligationsDelta = countDelta(
    (leftContract?.obligations ?? []).map((o) => o.text),
    (rightContract?.obligations ?? []).map((o) => o.text)
  );
  const forbiddenDelta = countDelta(
    (leftContract?.forbidden_behaviors ?? []).map((f) => f.text),
    (rightContract?.forbidden_behaviors ?? []).map((f) => f.text)
  );
  const latencyDelta = countDelta(
    (leftContract?.latency_budgets ?? []).map((b) => `${b.scenario}: ≤${b.max_latency_ms}ms`),
    (rightContract?.latency_budgets ?? []).map((b) => `${b.scenario}: ≤${b.max_latency_ms}ms`)
  );
  const sequencesDelta = countDelta(
    (leftContract?.tool_sequences ?? []).map((s) => `${s.scenario}: ${s.sequence.join(" → ")}`),
    (rightContract?.tool_sequences ?? []).map((s) => `${s.scenario}: ${s.sequence.join(" → ")}`)
  );

  const deltaDetail = (d: { added: number; removed: number }): { detail: string; changed: boolean; tone: "default" | "added" | "removed" | "mixed" } => {
    const changed = d.added > 0 || d.removed > 0;
    if (!changed) return { detail: "same", changed, tone: "default" };
    if (d.added > 0 && d.removed > 0) return { detail: `+${d.added} −${d.removed}`, changed, tone: "mixed" };
    if (d.added > 0) return { detail: `+${d.added}`, changed, tone: "added" };
    return { detail: `−${d.removed}`, changed, tone: "removed" };
  };

  const obligations = deltaDetail(obligationsDelta);
  const forbidden = deltaDetail(forbiddenDelta);
  const latency = deltaDetail(latencyDelta);
  const sequences = deltaDetail(sequencesDelta);

  const anythingChanged =
    promptChanged ||
    schemaChanged ||
    obligations.changed ||
    forbidden.changed ||
    latency.changed ||
    sequences.changed;

  return (
    <div className="border border-border rounded bg-card px-3 py-2.5 flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide mr-1">
        {anythingChanged ? "What changed" : "No changes"}
      </span>
      <Pill label="Prompt" changed={promptChanged} onClick={() => onJump("prompt")} />
      <Pill label="Schema" changed={schemaChanged} onClick={() => onJump("schema")} />
      <Pill
        label="Obligations"
        changed={obligations.changed}
        detail={obligations.detail}
        tone={obligations.tone}
        onClick={() => onJump("contract")}
      />
      <Pill
        label="Forbidden"
        changed={forbidden.changed}
        detail={forbidden.detail}
        tone={forbidden.tone}
        onClick={() => onJump("contract")}
      />
      <Pill
        label="Latency"
        changed={latency.changed}
        detail={latency.detail}
        tone={latency.tone}
        onClick={() => onJump("contract")}
      />
      <Pill
        label="Sequences"
        changed={sequences.changed}
        detail={sequences.detail}
        tone={sequences.tone}
        onClick={() => onJump("contract")}
      />
    </div>
  );
}
