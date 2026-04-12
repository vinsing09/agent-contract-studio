import { useState, useEffect } from "react";
import { api, type Agent, type AgentVersion } from "@/lib/api";
import { Loader2, AlertCircle, ChevronDown, ChevronRight, Check, X, Info } from "lucide-react";
import { parseApiError } from "@/lib/utils";

interface FailedAssertion {
  assertion_id: string;
  reason: string;
}

interface RegressionCase {
  test_case_id: string;
  scenario: string;
  failed_assertions: FailedAssertion[];
}

interface ImprovementCase {
  test_case_id: string;
  scenario: string;
}

interface NoProgressCase {
  test_case_id: string;
  scenario: string;
}

interface RegressionResult {
  status: "PASSED" | "BLOCKED";
  run_id: string;
  challenger_version_id: string;
  baseline_version_id: string;
  summary: {
    locked_cases_total: number;
    stable_count: number;
    regression_count: number;
    improvement_count: number;
    no_progress_count: number;
  };
  regressions: RegressionCase[];
  improvements: ImprovementCase[];
  no_progress?: NoProgressCase[];
}

export default function RegressionDashboard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [lockedCounts, setLockedCounts] = useState<Record<string, number>>({});
  const [challengerVersionId, setChallengerVersionId] = useState<string | null>(null);
  const [baselineVersionId, setBaselineVersionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RegressionResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getAgents()
      .then(setAgents)
      .catch((err) => setError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAgentId) {
      setVersions([]);
      setChallengerVersionId(null);
      setBaselineVersionId(null);
      setResult(null);
      setLockedCounts({});
      return;
    }
    api.getAgentVersions(selectedAgentId)
      .then(async (v) => {
        setVersions(v);
        setChallengerVersionId(v.length > 0 ? v[v.length - 1].id : null);
        setResult(null);

        // Fetch locked counts per version
        const counts: Record<string, number> = {};
        await Promise.all(
          v.map(async (ver) => {
            try {
              const cases = await api.getTestCasesV2(selectedAgentId, ver.id);
              counts[ver.id] = Array.isArray(cases) ? cases.filter((c: any) => c.locked).length : 0;
            } catch {
              counts[ver.id] = 0;
            }
          })
        );
        setLockedCounts(counts);

        // Auto-select baseline: version with most locked cases
        let bestBaselineId: string | null = null;
        let bestCount = 0;
        for (const ver of v) {
          if ((counts[ver.id] || 0) > bestCount) {
            bestCount = counts[ver.id];
            bestBaselineId = ver.id;
          }
        }
        setBaselineVersionId(bestBaselineId);
      })
      .catch((err) => setError(parseApiError(err)));
  }, [selectedAgentId]);

  const toggleScenario = (id: string) => {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRun = async () => {
    if (!selectedAgentId || !baselineVersionId || !challengerVersionId) return;
    setRunning(true);
    setError("");
    setResult(null);
    setExpandedScenarios(new Set());

    try {
      const res = await api.runRegressionV2(selectedAgentId, {
        challenger_version_id: challengerVersionId,
        baseline_version_id: baselineVersionId,
      });

      if (res.ok) {
        const json = await res.json();
        setResult({ ...json, status: json.status || "PASSED" });
      } else if (res.status === 422) {
        const json = await res.json();
        const detail = json.detail || json;
        setResult({ ...detail, status: detail.status || "BLOCKED" });
      } else {
        // Parse error body for friendly messages
        let msg = `Regression run failed (HTTP ${res.status})`;
        try {
          const json = await res.json();
          const detail = typeof json.detail === "string" ? json.detail : "";
          if (res.status === 404) {
            msg = "Agent or version not found. Please refresh and try again.";
          } else if (res.status === 400 && detail.toLowerCase().includes("no locked")) {
            msg = "No locked test cases found in the selected baseline version. Go to Test Cases and lock some cases first.";
          } else if (res.status === 400 && detail.toLowerCase().includes("baseline") && detail.toLowerCase().includes("challenger")) {
            msg = "Baseline and challenger cannot be the same version.";
          } else if (detail) {
            msg = detail;
          }
        } catch {
          // couldn't parse JSON, use default msg
        }
        setError(msg);
      }
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setRunning(false);
    }
  };

  const versionShort = (id: string | null) => {
    if (!id) return "";
    const v = versions.find((ver) => ver.id === id);
    return v ? `v${v.version_number} (${v.label})` : id;
  };

  const canRun =
    selectedAgentId &&
    baselineVersionId &&
    challengerVersionId &&
    baselineVersionId !== challengerVersionId &&
    !running;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-6 py-6 animate-fade-in max-w-4xl mx-auto">
      {/* SECTION 1 — Run Configuration */}
      <h1 className="text-lg font-semibold text-foreground mb-1">Version Comparison</h1>
      <p className="text-sm text-muted-foreground mb-5">
        Test a new version against locked cases from a baseline version.
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {/* Agent */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Agent</label>
          <select
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground"
            value={selectedAgentId || ""}
            onChange={(e) => setSelectedAgentId(e.target.value || null)}
          >
            <option value="">Select agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Baseline */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Baseline version (your behavioral spec)
          </label>
          <select
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground disabled:opacity-50"
            value={baselineVersionId || ""}
            onChange={(e) => setBaselineVersionId(e.target.value || null)}
            disabled={!selectedAgentId}
          >
            <option value="">Select version…</option>
            {versions.map((v) => {
              const count = lockedCounts[v.id];
              const suffix = count != null ? ` · ${count} locked` : "";
              return (
                <option
                  key={v.id}
                  value={v.id}
                  className={count === 0 ? "text-muted-foreground" : ""}
                >
                  v{v.version_number} — {v.label}{suffix}
                </option>
              );
            })}
          </select>
          <p className="text-[10px] text-muted-foreground mt-0.5">Must have locked test cases</p>
        </div>

        {/* Challenger */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Challenger version (what you're testing)
          </label>
          <select
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground disabled:opacity-50"
            value={challengerVersionId || ""}
            onChange={(e) => setChallengerVersionId(e.target.value || null)}
            disabled={!selectedAgentId}
          >
            <option value="">Select version…</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>v{v.version_number} — {v.label}</option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground mt-0.5">The version being tested</p>
        </div>
      </div>

      {/* Helper text */}
      <div className="mb-4 px-3 py-2 rounded bg-muted/30 border border-border flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Baseline</strong> = the version whose locked test cases define expected behavior.{" "}
          <strong>Challenger</strong> = the new version you want to test against those cases.
          Typically: baseline is your last stable version, challenger is your latest change.
        </p>
      </div>

      <button
        onClick={handleRun}
        disabled={!canRun}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
      >
        {running && <Loader2 className="w-4 h-4 animate-spin" />}
        {running ? "Running…" : "Run Comparison"}
      </button>

      {/* SECTION 2 — Results */}
      {result && (
        <div className="mt-8 animate-fade-in">
          {/* Status banner */}
          {result.status === "PASSED" ? (
            <div className="mb-4 px-4 py-3 text-sm font-medium rounded border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              ✓ All cases held
            </div>
          ) : (
            <div className="mb-4 px-4 py-3 text-sm font-medium rounded border bg-destructive/10 border-destructive/30 text-destructive">
              ✗ Comparison blocked — {result.summary.regression_count} case(s) broke
            </div>
          )}

          {/* Verdict line */}
          <p className="text-sm font-medium mb-2">
            {result.summary.regression_count > result.summary.improvement_count
              ? "⚠️ Challenger is worse on net"
              : result.summary.improvement_count > result.summary.regression_count
              ? "✅ Challenger is better on net"
              : "→ No net change"}
          </p>

          {/* Summary counts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <SummaryCard label="HELD" count={result.summary.stable_count} color="emerald" />
            <SummaryCard label="BROKE" count={result.summary.regression_count} color="red" />
            <SummaryCard label="IMPROVED" count={result.summary.improvement_count} color="blue" />
            <SummaryCard label="NO CHANGE" count={result.summary.no_progress_count} color="muted" />
          </div>

          {/* Swim lanes */}
          <div className="space-y-3">
            {result.summary.stable_count > 0 && (
              <div className="bg-card border border-border rounded border-l-2 border-l-emerald-500 p-4">
                <h3 className="text-sm font-semibold text-emerald-400">
                  HELD — {result.summary.stable_count} cases protected
                </h3>
              </div>
            )}

            {result.summary.regression_count > 0 && (
              <div className="bg-card border border-border rounded border-l-2 border-l-destructive p-4">
                <h3 className="text-sm font-semibold text-destructive mb-3">
                  BROKE — {result.summary.regression_count} cases broke
                </h3>
                <div className="space-y-2">
                  {result.regressions.map((r) => {
                    const expanded = expandedScenarios.has(r.test_case_id);
                    return (
                      <div key={r.test_case_id}>
                        <button
                          onClick={() => toggleScenario(r.test_case_id)}
                          className="flex items-center gap-1.5 text-sm text-foreground font-medium hover:text-primary transition-colors w-full text-left"
                        >
                          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          <X className="w-3.5 h-3.5 text-destructive" />
                          {r.scenario}
                        </button>
                        {expanded && (
                          <div className="ml-6 mt-1.5 space-y-1.5">
                            {r.failed_assertions.map((a, i) => (
                              <div key={i} className="px-3 py-2 text-xs font-mono bg-destructive/5 border border-destructive/20 rounded">
                                <span className="text-muted-foreground">{a.assertion_id}</span>
                                <p className="text-destructive mt-0.5">
                                  {a.reason.length > 120 ? a.reason.slice(0, 120) + "…" : a.reason}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.summary.improvement_count > 0 && (
              <div className="bg-card border border-border rounded border-l-2 border-l-blue-500 p-4">
                <h3 className="text-sm font-semibold text-blue-400 mb-3">
                  IMPROVED — {result.summary.improvement_count} cases now passing
                </h3>
                <div className="space-y-1.5">
                  {result.improvements.map((imp) => (
                    <div key={imp.test_case_id} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-3.5 h-3.5 text-blue-400" />
                      {imp.scenario}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.summary.no_progress_count > 0 && (
              <div className="bg-card border border-border rounded border-l-2 border-l-muted-foreground/30 p-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  NO CHANGE — {result.summary.no_progress_count} cases still failing
                </h3>
                {result.no_progress && result.no_progress.length > 0 && (
                  <div className="space-y-1.5">
                    {result.no_progress.map((np) => (
                      <div key={np.test_case_id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <X className="w-3.5 h-3.5" />
                        {np.scenario}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Baseline: {versionShort(result.baseline_version_id)} → Challenger: {versionShort(result.challenger_version_id)}
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    red: "text-destructive bg-destructive/10 border-destructive/30",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    muted: "text-muted-foreground bg-muted/30 border-border",
  };
  return (
    <div className={`px-3 py-2.5 rounded border text-center ${colorMap[color] || colorMap.muted}`}>
      <div className="text-lg font-bold">{count}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider">{label}</div>
    </div>
  );
}