import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, type AgentVersion } from "@/lib/api";
import type { ContractV2 } from "@/lib/types";
import { VersionPicker } from "@/components/version-diff/VersionPicker";
import { PromptDiff } from "@/components/version-diff/PromptDiff";
import { SchemaDiff } from "@/components/version-diff/SchemaDiff";
import { ContractDiff } from "@/components/version-diff/ContractDiff";
import { EvalDeltaTab } from "@/components/version-diff/EvalDeltaTab";

type Tab = "prompt" | "schema" | "contract" | "eval";

export default function VersionDiff() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const leftId = searchParams.get("left");
  const rightId = searchParams.get("right");

  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [leftContract, setLeftContract] = useState<ContractV2 | null>(null);
  const [rightContract, setRightContract] = useState<ContractV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [tab, setTab] = useState<Tab>("prompt");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getAgentVersions(id)
      .then((list) => {
        const sorted = [...list].sort((a, b) => b.version_number - a.version_number);
        setVersions(sorted);
        if (sorted.length >= 2 && (!leftId || !rightId)) {
          const next = new URLSearchParams(searchParams);
          if (!leftId) next.set("left", sorted[1].id);
          if (!rightId) next.set("right", sorted[0].id);
          setSearchParams(next, { replace: true });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const leftVersion = useMemo(() => versions.find((v) => v.id === leftId) ?? null, [versions, leftId]);
  const rightVersion = useMemo(() => versions.find((v) => v.id === rightId) ?? null, [versions, rightId]);

  useEffect(() => {
    if (!id || !leftId || !rightId) {
      setLeftContract(null);
      setRightContract(null);
      return;
    }
    setLoadingContracts(true);
    Promise.all([
      api.getContractV2(id, leftId).catch(() => null),
      api.getContractV2(id, rightId).catch(() => null),
    ])
      .then(([l, r]) => {
        setLeftContract(l);
        setRightContract(r);
      })
      .finally(() => setLoadingContracts(false));
  }, [id, leftId, rightId]);

  const handleLeftChange = (nextId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("left", nextId);
    setSearchParams(next, { replace: true });
  };
  const handleRightChange = (nextId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("right", nextId);
    setSearchParams(next, { replace: true });
  };

  if (!id) return null;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      </div>
    );
  }

  if (versions.length < 2) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-4">
        <Link to={`/agents/${id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to agent
        </Link>
        <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
          Need at least 2 versions to compare. This agent has {versions.length}.
        </div>
      </div>
    );
  }

  const leftLabel = leftVersion ? `v${leftVersion.version_number}${leftVersion.label ? ` · ${leftVersion.label}` : ""}` : "Baseline";
  const rightLabel = rightVersion ? `v${rightVersion.version_number}${rightVersion.label ? ` · ${rightVersion.label}` : ""}` : "Challenger";

  const tabs: { id: Tab; label: string }[] = [
    { id: "prompt", label: "Prompt" },
    { id: "schema", label: "Schema" },
    { id: "contract", label: "Contract" },
    { id: "eval", label: "Eval Delta" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Link to={`/agents/${id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Back to agent
        </Link>
        <h1 className="text-xl font-semibold text-foreground mt-2">Compare Versions</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <VersionPicker
          label="Baseline (left)"
          versions={versions}
          value={leftId}
          onChange={handleLeftChange}
          disabledIds={rightId ? [rightId] : []}
        />
        <VersionPicker
          label="Challenger (right)"
          versions={versions}
          value={rightId}
          onChange={handleRightChange}
          disabledIds={leftId ? [leftId] : []}
        />
      </div>

      {!leftId || !rightId ? (
        <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
          Pick two versions to compare.
        </div>
      ) : leftId === rightId ? (
        <div className="border border-border rounded bg-card p-4 text-sm text-muted-foreground">
          Pick two different versions.
        </div>
      ) : (
        <>
          <div className="border-b border-border flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  tab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "prompt" && (
            <PromptDiff
              left={leftVersion?.system_prompt ?? ""}
              right={rightVersion?.system_prompt ?? ""}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
            />
          )}

          {tab === "schema" && (
            <SchemaDiff
              left={leftVersion?.tool_schemas ?? []}
              right={rightVersion?.tool_schemas ?? []}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
            />
          )}

          {tab === "contract" && (
            loadingContracts ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : (
              <ContractDiff
                left={leftContract}
                right={rightContract}
                leftLabel={leftLabel}
                rightLabel={rightLabel}
              />
            )
          )}

          {tab === "eval" && (
            <EvalDeltaTab agentId={id} leftVersionId={leftId} rightVersionId={rightId} />
          )}
        </>
      )}
    </div>
  );
}
