import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type TestCase, type Agent, type AgentVersion } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Loader2, Lock, Unlock, Eye, AlertCircle, ListChecks, CheckCircle2, X, ArrowLeft, Trash2, Shield, Target } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";

export default function TestCaseList() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [testCases, setTestCases] = useState<any[]>([]);
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [successBanner, setSuccessBanner] = useState<{ passed: number; total: number } | null>(null);
  const [deleteModal, setDeleteModal] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  // Lock intent modal state
  const [lockModal, setLockModal] = useState<any | null>(null);
  const [lockIntent, setLockIntent] = useState<"protect" | "track">("protect");
  const [lockError, setLockError] = useState("");
  const [lockingCase, setLockingCase] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    loadData(agentId);
  }, [agentId]);

  const loadData = async (agId: string) => {
    try {
      const agent = await api.getAgent(agId).catch(() => null);
      if (agent) setAgentName(agent.name);

      // Try V2: get versions, use latest
      let cases: any[] = [];
      try {
        const versions = await api.getAgentVersions(agId);
        if (versions.length > 0) {
          const latest = versions.reduce((a, b) => a.version_number > b.version_number ? a : b);
          setActiveVersionId(latest.id);
          cases = await api.getTestCasesV2(agId, latest.id);
        } else {
          cases = await api.getTestCases(agId);
        }
      } catch {
        cases = await api.getTestCases(agId);
      }

      setTestCases(cases);
      loadEvalStatuses(agId, cases);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadEvalStatuses = async (agId: string, cases: any[]) => {
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
      let response: any;
      if (activeVersionId) {
        response = await api.runEvalV2(agentId, activeVersionId);
      } else {
        response = await api.runEval(agentId);
      }
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

  const handleLockClick = (tc: any) => {
    if (tc.locked) {
      // Unlock directly
      handleUnlock(tc);
    } else {
      // Open lock intent modal
      setLockModal(tc);
      setLockIntent("protect");
      setLockError("");
    }
  };

  const handleUnlock = async (tc: any) => {
    setLockingIds((prev) => new Set(prev).add(tc.id));
    try {
      await api.unlockTestCase(tc.id);
      setTestCases((prev) =>
        prev.map((t) => (t.id === tc.id ? { ...t, locked: false, locked_at_pass: undefined } : t))
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

  const handleLockConfirm = async () => {
    if (!lockModal) return;
    setLockingCase(true);
    setLockError("");
    try {
      await api.lockTestCaseWithIntent(lockModal.id, lockIntent);
      setTestCases((prev) =>
        prev.map((t) => (t.id === lockModal.id ? { ...t, locked: true, locked_at_pass: lockIntent === "protect" } : t))
      );
      setLockModal(null);
    } catch (err: any) {
      setLockError(parseApiError(err));
    } finally {
      setLockingCase(false);
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
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Info</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-24">Lock Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-44">Actions</th>
              </tr>
            </thead>
            <tbody>
              {testCases.map((tc, i) => {
                const obligationCount = tc.obligation_ids?.length || 0;
                return (
                  <tr key={tc.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="px-3 py-2.5 text-foreground max-w-[300px]">
                      <span className="block truncate" title={tc.scenario}>
                        {tc.scenario.length > 60 ? tc.scenario.slice(0, 60) + "…" : tc.scenario}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(tc.tags || []).map((tag: string) => (
                          <TagBadge key={tag} tag={tag} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          {(tc.assertions || []).length} assertion{(tc.assertions || []).length !== 1 ? "s" : ""}
                        </span>
                        {obligationCount > 0 && (
                          <span className="text-xs text-muted-foreground/70">
                            {obligationCount} obligation{obligationCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {tc.locked ? (
                        tc.locked_at_pass ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                            <Shield className="w-3.5 h-3.5" />
                            Protected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400">
                            <Target className="w-3.5 h-3.5" />
                            Tracking
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {tc.status ? <StatusBadge status={tc.status} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleLockClick(tc)}
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
                            <Unlock className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                          {tc.locked ? "Unlock" : "Lock"}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Lock Intent Modal */}
      {lockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLockModal(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground mb-1">Lock Test Case</h3>
            <p className="text-sm text-muted-foreground mb-5 truncate" title={lockModal.scenario}>
              {lockModal.scenario}
            </p>

            <div className="space-y-3 mb-5">
              {/* Protect option */}
              <button
                onClick={() => setLockIntent("protect")}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  lockIntent === "protect"
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Shield className={`w-5 h-5 mt-0.5 shrink-0 ${lockIntent === "protect" ? "text-green-400" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-medium ${lockIntent === "protect" ? "text-green-400" : "text-foreground"}`}>
                      Protect this behavior
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This case is currently passing. Lock it to prevent regression — any future failure will block deployment.
                    </p>
                  </div>
                </div>
              </button>

              {/* Track option */}
              <button
                onClick={() => setLockIntent("track")}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  lockIntent === "track"
                    ? "border-blue-500/50 bg-blue-500/10"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Target className={`w-5 h-5 mt-0.5 shrink-0 ${lockIntent === "track" ? "text-blue-400" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-medium ${lockIntent === "track" ? "text-blue-400" : "text-foreground"}`}>
                      Track improvement
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This case is currently failing. Lock it to monitor progress — improvement will be celebrated, not blocking.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {lockError && (
              <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {lockError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setLockModal(null)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLockConfirm}
                disabled={lockingCase}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {lockingCase && <Loader2 className="w-3 h-3 animate-spin" />}
                Lock Case
              </button>
            </div>
          </div>
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
