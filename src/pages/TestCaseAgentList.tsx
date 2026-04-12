import { useState, useEffect } from "react";
import { parseApiError } from "@/lib/utils";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type Agent, type AgentVersion } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Box, Loader2, Shield, Target, Lock, Unlock, Filter, AlertCircle, Eye, Trash2, CheckSquare, Square, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AgentWithVersion {
  agent: Agent;
  latestVersion: AgentVersion | null;
}

export default function TestCaseAgentList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState<AgentWithVersion[]>([]);
  const [allTestCases, setAllTestCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>(searchParams.get("agent") || "all");

  // Lock intent modal state
  const [lockModal, setLockModal] = useState<any | null>(null);
  const [lockIntent, setLockIntent] = useState<"protect" | "track">("protect");
  const [lockError, setLockError] = useState("");
  const [lockingCase, setLockingCase] = useState(false);
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk lock progress
  const [bulkLocking, setBulkLocking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, label: "" });

  useEffect(() => {
    loadAll();
  }, []);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedAgentId]);

  const loadAll = async () => {
    try {
      const agentList = await api.getAgents();
      const agentsWithVersions: AgentWithVersion[] = [];
      const cases: any[] = [];

      await Promise.all(
        agentList.map(async (agent) => {
          let latestVersion: AgentVersion | null = null;
          let agentCases: any[] = [];
          try {
            const versions = await api.getAgentVersions(agent.id);
            if (versions.length > 0) {
              latestVersion = versions.reduce((a, b) => a.version_number > b.version_number ? a : b);
              agentCases = await api.getTestCasesV2(agent.id, latestVersion.id);
            } else {
              agentCases = await api.getTestCases(agent.id);
            }
          } catch {
            try {
              agentCases = await api.getTestCases(agent.id);
            } catch {}
          }
          agentsWithVersions.push({ agent, latestVersion });
          cases.push(...agentCases.map((tc: any) => ({ ...tc, _agent_name: agent.name, _agent_id: agent.id })));
        })
      );

      setAgents(agentsWithVersions);
      setAllTestCases(cases);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = selectedAgentId === "all"
    ? allTestCases
    : allTestCases.filter((tc) => tc._agent_id === selectedAgentId || tc.agent_id === selectedAgentId);

  const handleLockClick = (tc: any) => {
    if (tc.locked) {
      handleUnlock(tc);
    } else {
      setLockModal(tc);
      setLockIntent("protect");
      setLockError("");
    }
  };

  const handleUnlock = async (tc: any) => {
    setLockingIds((prev) => new Set(prev).add(tc.id));
    try {
      await api.unlockTestCase(tc.id);
      setAllTestCases((prev) =>
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
      setAllTestCases((prev) =>
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
      setAllTestCases((prev) => prev.filter((tc) => tc.id !== deleteModal.id));
      setDeleteModal(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Multi-select helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCases.map((tc) => tc.id)));
    }
  };

  // Bulk lock/unlock
  const bulkLock = async (ids: string[], intent: "protect" | "track") => {
    setBulkLocking(true);
    setError("");
    const label = intent === "protect" ? "Protecting" : "Tracking";
    setBulkProgress({ current: 0, total: ids.length, label });
    let succeeded = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length, label });
      try {
        await api.lockTestCaseWithIntent(ids[i], intent);
        setAllTestCases((prev) =>
          prev.map((t) => (t.id === ids[i] ? { ...t, locked: true, locked_at_pass: intent === "protect" } : t))
        );
        succeeded++;
      } catch {
        failed++;
      }
    }
    setBulkLocking(false);
    setSelectedIds(new Set());
    if (failed > 0) {
      setError(`Locked ${succeeded} case${succeeded !== 1 ? "s" : ""}. ${failed} case${failed !== 1 ? "s" : ""} failed — they may need an eval run first.`);
    }
  };

  const bulkUnlock = async (ids: string[]) => {
    setBulkLocking(true);
    setError("");
    setBulkProgress({ current: 0, total: ids.length, label: "Unlocking" });
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      setBulkProgress({ current: i + 1, total: ids.length, label: "Unlocking" });
      try {
        await api.unlockTestCase(ids[i]);
        setAllTestCases((prev) =>
          prev.map((t) => (t.id === ids[i] ? { ...t, locked: false, locked_at_pass: undefined } : t))
        );
      } catch {
        failed++;
      }
    }
    setBulkLocking(false);
    setSelectedIds(new Set());
    if (failed > 0) {
      setError(`${failed} case${failed !== 1 ? "s" : ""} failed to unlock.`);
    }
  };

  const unlocked = filteredCases.filter((tc) => !tc.locked);
  const hasUnlockedCases = unlocked.length > 0;
  const isAgentFiltered = selectedAgentId !== "all";

  const selectedCases = filteredCases.filter((tc) => selectedIds.has(tc.id));
  const selectionCount = selectedCases.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">Test Cases</h1>
          <p className="text-sm text-muted-foreground">
            {filteredCases.length} test case{filteredCases.length !== 1 ? "s" : ""}{selectedAgentId !== "all" ? " (filtered)" : " across all agents"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map(({ agent }) => (
                <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm rounded mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Bulk Lock Bar — shown when agent is filtered and there are unlocked cases */}
      {isAgentFiltered && hasUnlockedCases && !bulkLocking && selectionCount === 0 && (
        <div className="mb-3 px-3 py-2.5 bg-muted/30 border border-border rounded flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground font-medium">
            Bulk Lock — {unlocked.length} unlocked case{unlocked.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkLock(unlocked.map((tc) => tc.id), "protect")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
            >
              <Shield className="w-3 h-3 text-emerald-400" />
              Lock all as Protect
            </button>
            <button
              onClick={() => bulkLock(unlocked.map((tc) => tc.id), "track")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
            >
              <Target className="w-3 h-3 text-blue-400" />
              Lock all as Track
            </button>
          </div>
        </div>
      )}

      {/* Bulk progress bar */}
      {bulkLocking && (
        <div className="mb-3 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="text-xs text-foreground font-medium">
            {bulkProgress.label} {bulkProgress.current}/{bulkProgress.total}…
          </span>
        </div>
      )}

      {/* Multi-select action bar */}
      {selectionCount > 0 && !bulkLocking && (
        <div className="mb-3 px-3 py-2.5 bg-primary/10 border border-primary/20 rounded flex items-center justify-between gap-3">
          <span className="text-xs text-foreground font-medium">
            {selectionCount} case{selectionCount !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkLock(Array.from(selectedIds), "protect")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
            >
              <Shield className="w-3 h-3 text-emerald-400" />
              Lock as Protect
            </button>
            <button
              onClick={() => bulkLock(Array.from(selectedIds), "track")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
            >
              <Target className="w-3 h-3 text-blue-400" />
              Lock as Track
            </button>
            <button
              onClick={() => bulkUnlock(Array.from(selectedIds))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
            >
              <Unlock className="w-3 h-3" />
              Unlock
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {filteredCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Box className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">No test cases found.</p>
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-center px-2 py-2 w-10">
                  <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                    {selectedIds.size === filteredCases.length && filteredCases.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                </th>
                <th className="text-center px-2 py-2 text-xs font-medium text-muted-foreground w-10">#</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Agent</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Scenario</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tags</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground w-24">Lock</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((tc, index) => {
                const obligationCount = tc.obligation_ids?.length || 0;
                const isSelected = selectedIds.has(tc.id);
                return (
                  <tr key={tc.id} className={`border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                    <td className="px-2 py-2.5 text-center">
                      <button onClick={() => toggleSelect(tc.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-xs text-center text-muted-foreground font-mono">{index + 1}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{tc._agent_name}</td>
                    <td className="px-3 py-2.5 text-foreground max-w-[280px]">
                      <Link to={`/test-cases/${tc.id}`} className="hover:text-primary transition-colors">
                        <span className="block truncate" title={tc.scenario}>
                          {tc.scenario?.length > 50 ? tc.scenario.slice(0, 50) + "…" : tc.scenario}
                        </span>
                      </Link>
                      {obligationCount > 0 && (
                        <span className="text-xs text-muted-foreground/60">{obligationCount} obligations</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {(tc.tags || []).map((tag: string) => (
                          <TagBadge key={tag} tag={tag} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {tc.locked ? (
                        tc.locked_at_pass ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
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
                        <Link
                          to={`/test-cases/${tc.id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground border border-border rounded hover:bg-muted hover:text-foreground transition-colors active:scale-[0.97]"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Link>
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
              <button
                onClick={() => setLockIntent("protect")}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                  lockIntent === "protect"
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Shield className={`w-5 h-5 mt-0.5 shrink-0 ${lockIntent === "protect" ? "text-emerald-400" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-medium ${lockIntent === "protect" ? "text-emerald-400" : "text-foreground"}`}>
                      Protect this behavior
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This case is currently passing. Lock it to prevent regression — any future failure will block deployment.
                    </p>
                  </div>
                </div>
              </button>

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
              <div className="mb-3 px-2 py-1.5 text-xs bg-amber-500/10 border border-amber-500/30 rounded text-amber-500 flex items-center gap-1.5">
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