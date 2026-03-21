import { useState, useEffect } from "react";
import { api, type RegressionCase } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Loader2, AlertCircle, Lock, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

// For now, we'll use a default agent ID or allow selection
// In a real app this would come from route params or a selector
export default function RegressionDashboard() {
  const [cases, setCases] = useState<RegressionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState<{ type: "success" | "failure"; message: string; failures: string[] } | null>(null);

  // Placeholder agent ID — in production, this would be selected
  const agentId = "default";

  useEffect(() => {
    setLoading(true);
    api.getRegressionCases(agentId)
      .then(setCases)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleRunRegression = async () => {
    setRunning(true);
    setError("");
    setBanner(null);
    try {
      const run = await api.runEval(agentId, "regression");
      // Refresh cases
      const updated = await api.getRegressionCases(agentId);
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

  const statusIcon = (status?: string) => {
    switch (status) {
      case "PASS": return <ShieldCheck className="w-4 h-4 text-success" />;
      case "FAIL": return <ShieldX className="w-4 h-4 text-destructive" />;
      default: return <ShieldAlert className="w-4 h-4 text-muted-foreground" />;
    }
  };

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

      {/* Regression Suite */}
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tags</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Assertions</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Last Run</th>
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
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{c.assertion_count}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">
                      {c.last_run ? new Date(c.last_run).toLocaleDateString() : "—"}
                    </td>
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

      {/* Run button */}
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
