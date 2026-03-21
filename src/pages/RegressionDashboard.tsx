import { useState, useEffect } from "react";
import { api, type Agent, type TestCase } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Loader2, AlertCircle, Lock, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

interface LockedCase {
  id: string;
  agent_id: string;
  agent_name: string;
  scenario: string;
  tags: string[];
  assertion_count: number;
  last_run?: string;
  status?: "PASS" | "FAIL" | "NEVER_RUN";
}

export default function RegressionDashboard() {
  const [cases, setCases] = useState<LockedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<{ type: "success" | "failure"; message: string; failures: string[] } | null>(null);

  const fetchLockedCases = async () => {
    const agents = await api.getAgents();
    const allLocked: LockedCase[] = [];
    for (const agent of agents) {
      try {
        const testCases = await api.getTestCases(agent.id);
        const locked = testCases.filter((tc) => tc.locked);
        for (const tc of locked) {
          allLocked.push({
            id: tc.id,
            agent_id: agent.id,
            agent_name: agent.name,
            scenario: tc.scenario,
            tags: tc.tags,
            assertion_count: tc.assertions?.length ?? 0,
            status: tc.status === "PASS" || tc.status === "FAIL" ? tc.status : "NEVER_RUN",
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
    try {
      // Run regression for each agent that has locked cases
      const agentIds = [...new Set(cases.map((c) => c.agent_id))];
      for (const agentId of agentIds) {
        await api.runEval(agentId, "regression");
      }
      const updated = await fetchLockedCases();
      setCases(updated);

      const failed = updated.filter((c) => c.status === "FAIL");
      if (failed.length > 0) {
        setBanner({
          type: "failure",
          message: `Regression failed — ${failed.length} case(s) blocked deployment`,
          failures: failed.map((f) => f.scenario),
        });
      } else {
        setBanner({
          type: "success",
          message: "All regression cases passed",
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
        <div className={`mb-5 px-4 py-3 rounded border text-sm font-medium animate-fade-in ${
          banner.type === "success"
            ? "bg-success/10 border-success/30 text-success"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        }`}>
          <p>{banner.type === "failure" ? "⛔" : "✅"} {banner.message}</p>
          {banner.failures.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {banner.failures.map((f, i) => (
                <li key={i} className="font-mono">• {f}</li>
              ))}
            </ul>
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Assertions</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">Status</th>
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
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{c.assertion_count}</td>
                    <td className="px-3 py-2.5">
                      {c.status === "NEVER_RUN" ? (
                        <span className="text-[11px] font-mono text-muted-foreground">NEVER RUN</span>
                      ) : c.status ? (
                        <StatusBadge status={c.status} />
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
