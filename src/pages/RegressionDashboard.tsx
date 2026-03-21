import { useState, useEffect } from "react";
import { api, type Agent, type TestCase } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Loader2, AlertCircle, Lock, ShieldCheck } from "lucide-react";

interface LockedCase {
  id: string;
  agent_id: string;
  agent_name: string;
  scenario: string;
  tags: string[];
  assertion_count: number;
  status?: "PASS" | "FAIL" | "BLOCKED" | "NEVER_RUN";
}

interface RegressionFailure {
  scenario: string;
  assertion_id?: string;
  reason: string;
}

export default function RegressionDashboard() {
  const [cases, setCases] = useState<LockedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<{
    type: "success" | "failure";
    message: string;
    failures: RegressionFailure[];
  } | null>(null);

  const fetchLockedCases = async (): Promise<LockedCase[]> => {
    const agents = await api.getAgents();
    const allLocked: LockedCase[] = [];
    for (const agent of agents) {
      try {
        const testCases = await api.getTestCases(agent.id);
        const locked = testCases.filter((tc) => tc.locked);

        // Try to get latest regression run status
        let latestStatuses: Record<string, string> = {};
        try {
          const latest = await api.getLatestRegressionRun(agent.id);
          if (latest && latest.results) {
            const caseResults: Record<string, boolean> = {};
            for (const r of latest.results) {
              if (!(r.test_case_id in caseResults)) caseResults[r.test_case_id] = true;
              if (!r.passed) caseResults[r.test_case_id] = false;
            }
            for (const [tcId, allPassed] of Object.entries(caseResults)) {
              latestStatuses[tcId] = allPassed ? "PASS" : "BLOCKED";
            }
          }
        } catch {
          // no regression run yet
        }

        for (const tc of locked) {
          const rStatus = latestStatuses[tc.id];
          allLocked.push({
            id: tc.id,
            agent_id: agent.id,
            agent_name: agent.name,
            scenario: tc.scenario,
            tags: tc.tags,
            assertion_count: tc.assertions?.length ?? 0,
            status: rStatus === "PASS" ? "PASS" : rStatus === "BLOCKED" || rStatus === "FAIL" ? "BLOCKED" : "NEVER_RUN",
          });
        }
      } catch {
        // skip agents with no test cases
      }
    }
    return allLocked;
  };

  useEffect(() => {
    setLoading(true);
    fetchLockedCases()
      .then(setCases)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRunRegression = async () => {
    setRunning(true);
    setError("");
    setBanner(null);

    const agentIds = [...new Set(cases.map((c) => c.agent_id))];
    const allFailures: RegressionFailure[] = [];
    let anyBlocked = false;

    try {
      for (const agentId of agentIds) {
        const res = await api.runRegressionRun(agentId);
        if (res.status === 422) {
          anyBlocked = true;
          try {
            const body = await res.json();
            if (body.failures) {
              for (const f of body.failures) {
                allFailures.push({
                  scenario: f.scenario || f.test_case_id || "Unknown",
                  assertion_id: f.assertion_id,
                  reason: f.reason || "Assertion failed",
                });
              }
            }
          } catch {
            allFailures.push({ scenario: "Unknown", reason: "Regression blocked (HTTP 422)" });
          }
        } else if (!res.ok) {
          throw new Error(`Regression run failed for agent ${agentId}: HTTP ${res.status}`);
        }
      }

      const updated = await fetchLockedCases();
      setCases(updated);

      if (anyBlocked) {
        setBanner({
          type: "failure",
          message: "Regression blocked — deployment gate failed",
          failures: allFailures,
        });
      } else {
        setBanner({
          type: "success",
          message: "All regression cases passed — safe to deploy",
          failures: [],
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-6 py-6 animate-fade-in">
      <h1 className="text-lg font-semibold text-foreground mb-1">Regression Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-5">Locked cases that guard against regressions.</p>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {banner && (
        <div className={`mb-5 rounded border animate-fade-in ${
          banner.type === "success"
            ? "bg-success/10 border-success/30 text-success"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          <div className="px-4 py-3 text-sm font-medium">
            {banner.type === "failure" ? "⛔" : "✅"} {banner.message}
          </div>
          {banner.failures.length > 0 && (
            <div className="px-4 pb-3 space-y-2">
              {banner.failures.map((f, i) => (
                <div key={i} className="px-3 py-2 text-xs font-mono bg-destructive/5 border border-destructive/20 rounded">
                  <span className="text-foreground font-medium">{f.scenario}</span>
                  {f.assertion_id && <span className="text-muted-foreground ml-2">assertion: {f.assertion_id}</span>}
                  <p className="text-destructive mt-0.5">{f.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Regression Suite</h2>
          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-primary/15 text-primary border border-primary/30 rounded-sm">
            {cases.length}
          </span>
        </div>

        {cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-border rounded bg-card">
            <Lock className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No locked cases in the regression suite.</p>
          </div>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-10"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scenario</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Agent</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tags</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 text-center">
                      <Lock className="w-3.5 h-3.5 text-primary mx-auto" />
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{c.scenario}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{c.agent_name}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {c.status === "NEVER_RUN" ? (
                        <span className="text-[11px] font-mono text-muted-foreground">NEVER RUN</span>
                      ) : c.status === "BLOCKED" ? (
                        <span className="inline-flex px-1.5 py-0.5 text-[11px] font-mono bg-destructive/15 text-destructive border border-destructive/30 rounded-sm">BLOCKED</span>
                      ) : c.status === "PASS" ? (
                        <StatusBadge status="PASS" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button
        onClick={handleRunRegression}
        disabled={running || cases.length === 0}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.98]"
      >
        {running && <Loader2 className="w-4 h-4 animate-spin" />}
        Run Regression Suite
      </button>
    </div>
  );
}
