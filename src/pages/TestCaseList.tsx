import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type TestCase } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Loader2, Lock, Unlock, Eye, AlertCircle, ListChecks } from "lucide-react";

export default function TestCaseList() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);

    // Fetch agent name independently — don't block test cases
    api.getAgent(agentId)
      .then((agent) => setAgentName(agent.name))
      .catch(() => {});

    api.getTestCases(agentId)
      .then((cases) => setTestCases(cases))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleRunEval = async () => {
    if (!agentId) return;
    setRunning(true);
    setError("");
    try {
      const response = await api.runEval(agentId) as any;
      const runId = response?.eval_run?.id || response?.id;
      const results = await api.getEvalRunResults(runId);
      // Group assertion-level results by test_case_id
      const statusByCase: Record<string, "PASS" | "FAIL"> = {};
      for (const r of results) {
        const tcId = (r as any).test_case_id;
        if (!tcId) continue;
        if (statusByCase[tcId] === "FAIL") continue;
        statusByCase[tcId] = (r as any).passed === false ? "FAIL" : "PASS";
      }
      setTestCases((prev) =>
        prev.map((tc) => {
          const s = statusByCase[tc.id];
          return s ? { ...tc, status: s } : tc;
        })
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleToggleLock = async (tc: TestCase) => {
    setLockingIds((prev) => new Set(prev).add(tc.id));
    try {
      if (tc.locked) {
        await api.unlockTestCase(tc.id);
      } else {
        await api.lockTestCase(tc.id);
      }
      setTestCases((prev) =>
        prev.map((t) => (t.id === tc.id ? { ...t, locked: !t.locked } : t))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLockingIds((prev) => {
        const next = new Set(prev);
        next.delete(tc.id);
        return next;
      });
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
      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{agentName || "Agent"}</h1>
          <p className="text-sm text-muted-foreground">
            {testCases.length} test case{testCases.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleRunEval}
          disabled={running || testCases.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
        >
          {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {running ? `Running ${testCases.length} cases...` : "Run Eval"}
        </button>
      </div>

      {testCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ListChecks className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No test cases yet.</p>
          <p className="text-xs mt-1">Generate test cases from the agent upload screen.</p>
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scenario</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tags</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Assertions</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-16">Locked</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {testCases.map((tc, i) => (
                <tr key={tc.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                  <td className="px-3 py-2.5 text-foreground max-w-[300px]">
                    <span className="block truncate" title={tc.scenario}>
                      {tc.scenario.length > 60 ? tc.scenario.slice(0, 60) + "…" : tc.scenario}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {tc.tags.map((tag) => (
                        <TagBadge key={tag} tag={tag} />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {tc.assertions.length} assertion{tc.assertions.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {tc.locked ? (
                      <Lock className="w-3.5 h-3.5 text-primary mx-auto" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-muted-foreground mx-auto" />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {tc.status ? <StatusBadge status={tc.status} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleLock(tc)}
                        disabled={lockingIds.has(tc.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border rounded transition-colors active:scale-[0.97] disabled:opacity-50 ${
                          tc.locked
                            ? "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                            : "text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        {lockingIds.has(tc.id) ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : tc.locked ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          <Unlock className="w-3 h-3" />
                        )}
                        {tc.locked ? "Locked" : "Lock"}
                      </button>
                      <button
                        onClick={() => navigate(`/agents/${agentId}/test-cases/${tc.id}`)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground border border-border rounded hover:bg-muted hover:text-foreground transition-colors active:scale-[0.97]"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
