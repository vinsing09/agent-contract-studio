import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type TestCase } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Loader2, Lock, Unlock, Eye, AlertCircle, ListChecks, CheckCircle2, X, ArrowLeft, Trash2 } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";

export default function TestCaseList() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [successBanner, setSuccessBanner] = useState<{ passed: number; total: number } | null>(null);
  const [deleteModal, setDeleteModal] = useState<TestCase | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    api.getAgent(agentId)
      .then((agent) => setAgentName(agent.name))
      .catch(() => {});
    api.getTestCases(agentId)
      .then((cases) => {
        setTestCases(cases);
        loadEvalStatuses(agentId, cases);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  const loadEvalStatuses = async (agId: string, cases: TestCase[]) => {
    try {
      const runs = await api.getEvalRuns();
      const agentRuns = runs.filter((r) => r.agent_id === agId);
      if (agentRuns.length === 0) return;
      const latestRun = agentRuns[0];
      const results = await api.getEvalRunResults(latestRun.id);
      const statusByCase: Record<string, "PASS" | "FAIL"> = {};
      for (const r of results) {
        const tcId = (r as any).test_case_id;
        if (!tcId) continue;
        if ((r as any).passed === false) {
          statusByCase[tcId] = "FAIL";
        } else if (statusByCase[tcId] !== "FAIL" && (r as any).passed === true) {
          statusByCase[tcId] = "PASS";
        }
      }
      setTestCases((prev) =>
        prev.map((tc) => {
          const s = statusByCase[tc.id];
          return s ? { ...tc, status: s } : tc;
        })
      );
    } catch {}
  };

  const handleRunEval = async () => {
    if (!agentId) return;
    setRunning(true);
    setError("");
    setSuccessBanner(null);
    try {
      const response = await api.runEval(agentId) as any;
      const runId = response?.eval_run?.id || response?.id;
      const results = await api.getEvalRunResults(runId);
      const statusByCase: Record<string, "PASS" | "FAIL"> = {};
      for (const r of results) {
        const tcId = (r as any).test_case_id;
        if (!tcId) continue;
        if ((r as any).passed === false) {
          statusByCase[tcId] = "FAIL";
        } else if (statusByCase[tcId] !== "FAIL" && (r as any).passed === true) {
          statusByCase[tcId] = "PASS";
        }
      }
      setTestCases((prev) =>
        prev.map((tc) => {
          const s = statusByCase[tc.id];
          return s ? { ...tc, status: s } : tc;
        })
      );
      const passedCount = Object.values(statusByCase).filter((s) => s === "PASS").length;
      const totalCount = Object.keys(statusByCase).length;
      setSuccessBanner({ passed: passedCount, total: totalCount });
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

  const handleDeleteTestCase = async () => {
    if (!deleteModal) return;
    setDeletingId(deleteModal.id);
    try {
      await api.deleteTestCase(deleteModal.id);
      setTestCases((prev) => prev.filter((tc) => tc.id !== deleteModal.id));
      setDeleteModal(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
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
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/test-cases">Test Cases</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{agentName || "Agent"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {successBanner && (
        <div className="mb-4 px-3 py-2 text-sm bg-success/10 border border-success/30 rounded text-success flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            Eval complete — {successBanner.passed}/{successBanner.total} passed. Go to{" "}
            <span onClick={() => navigate("/eval-runs")} className="underline cursor-pointer hover:text-success/80 font-medium">Eval Runs</span>{" "}
            to see full results, or click View on any row to inspect individual traces.
          </span>
          <button onClick={() => setSuccessBanner(null)} className="p-0.5 hover:bg-success/20 rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link
            to="/test-cases"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{agentName || "Agent"}</h1>
            <p className="text-sm text-muted-foreground">
              {testCases.length} test case{testCases.length !== 1 ? "s" : ""}
            </p>
          </div>
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
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-44">Actions</th>
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
                      <button
                        onClick={() => setDeleteModal(tc)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-destructive/70 border border-destructive/20 rounded hover:bg-destructive/10 hover:text-destructive transition-colors active:scale-[0.97]"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Test Case Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteModal(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-5 h-5 text-destructive" />
              <h3 className="text-base font-semibold text-foreground">Delete Test Case</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {deleteModal.locked
                ? "This is a regression case. Deleting it will remove it from your regression suite."
                : "Are you sure you want to delete this test case? This cannot be undone."}
            </p>
            {deleteModal.locked && (
              <div className="mb-3 px-2 py-1.5 text-xs bg-warning/10 border border-warning/30 rounded text-warning flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                This test case is locked as a regression case
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTestCase}
                disabled={deletingId === deleteModal.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deletingId === deleteModal.id && <Loader2 className="w-3 h-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
