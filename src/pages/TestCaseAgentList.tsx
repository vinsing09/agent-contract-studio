import { useState, useEffect } from "react";
import { parseApiError } from "@/lib/utils";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Agent, type AgentVersion, type EvalRun, type EvalResult } from "@/lib/api";
import { TagBadge } from "@/components/ui-shared";
import {
  Box,
  Loader2,
  Shield,
  Target,
  Lock,
  Unlock,
  Filter,
  AlertCircle,
  Eye,
  Trash2,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AgentWithVersion {
  agent: Agent;
  latestVersion: AgentVersion | null;
}

type EvalStatus = "PASS" | "FAIL";

function buildStatusByCase(results: EvalResult[]): Record<string, EvalStatus> {
  const statusByCase: Record<string, EvalStatus> = {};

  // Only consider deterministic (user-defined) assertions for pass/fail status.
  // Semantic judge assertions (hallucination, goal_achieved, etc.) are informational
  // and should not block bulk lock actions.
  const deterministicResults = results.filter(
    (r) => r.result_type === "deterministic" || !r.result_type
  );

  for (const result of deterministicResults) {
    const testCaseId = result.test_case_id;
    if (!testCaseId) continue;

    if (result.passed === false) {
      statusByCase[testCaseId] = "FAIL";
    } else if (statusByCase[testCaseId] !== "FAIL" && result.passed === true) {
      statusByCase[testCaseId] = "PASS";
    }
  }

  return statusByCase;
}

function getLatestRunForAgent(runs: EvalRun[], agentId: string): EvalRun | null {
  const agentRuns = runs
    .filter((run) => run.agent_id === agentId)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  return agentRuns[0] ?? null;
}

export default function TestCaseAgentList() {
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState<AgentWithVersion[]>([]);
  const [allTestCases, setAllTestCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>(searchParams.get("agent") || "all");
  const [evalStatusByCase, setEvalStatusByCase] = useState<Record<string, EvalStatus>>({});
  const [latestEvalRunByAgent, setLatestEvalRunByAgent] = useState<Record<string, EvalRun | null>>({});

  const [lockModal, setLockModal] = useState<any | null>(null);
  const [lockIntent, setLockIntent] = useState<"protect" | "track">("protect");
  const [lockError, setLockError] = useState("");
  const [lockingCase, setLockingCase] = useState(false);
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());

  const [deleteModal, setDeleteModal] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLocking, setBulkLocking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, label: "" });
  const [smartLockSummary, setSmartLockSummary] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedAgentId]);

  const loadAll = async () => {
    try {
      const [agentList, runs] = await Promise.all([
        api.getAgents(),
        api.getEvalRuns().catch(() => [] as EvalRun[]),
      ]);

      const agentsWithVersions: AgentWithVersion[] = [];
      const cases: any[] = [];
      const statusMap: Record<string, EvalStatus> = {};
      const latestRunsMap: Record<string, EvalRun | null> = {};

      await Promise.all(
        agentList.map(async (agent) => {
          let latestVersion: AgentVersion | null = null;
          let agentCases: any[] = [];

          try {
            const versions = await api.getAgentVersions(agent.id);
            if (versions.length > 0) {
              latestVersion = versions.reduce((a, b) => (a.version_number > b.version_number ? a : b));
              agentCases = await api.getTestCasesV2(agent.id, latestVersion.id);
            } else {
              agentCases = await api.getTestCases(agent.id);
            }
          } catch {
            try {
              agentCases = await api.getTestCases(agent.id);
            } catch {
              agentCases = [];
            }
          }

          const latestRun = getLatestRunForAgent(runs, agent.id);
          latestRunsMap[agent.id] = latestRun;

          if (latestRun) {
            try {
              const results = await api.getEvalRunResults(latestRun.id);
              Object.assign(statusMap, buildStatusByCase(results));
            } catch {
              // Keep page usable even if eval results fail to load
            }
          }

          agentsWithVersions.push({ agent, latestVersion });
          cases.push(...agentCases.map((tc: any) => ({ ...tc, _agent_name: agent.name, _agent_id: agent.id })));
        })
      );

      setAgents(agentsWithVersions);
      setAllTestCases(cases);
      setEvalStatusByCase(statusMap);
      setLatestEvalRunByAgent(latestRunsMap);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const filteredCases =
    selectedAgentId === "all"
      ? allTestCases
      : allTestCases.filter((tc) => tc._agent_id === selectedAgentId || tc.agent_id === selectedAgentId);

  const latestEvalRun = selectedAgentId !== "all" ? latestEvalRunByAgent[selectedAgentId] ?? null : null;
  const isAgentFiltered = selectedAgentId !== "all";
  const selectedCases = filteredCases.filter((tc) => selectedIds.has(tc.id));
  const selectionCount = selectedCases.length;

  const evaluatedFilteredCases = filteredCases.filter((tc) => !!evalStatusByCase[tc.id]);
  const unevaluatedFilteredCount = filteredCases.length - evaluatedFilteredCases.length;
  const lockedCount = filteredCases.filter((tc) => tc.locked).length;
  const passingUnlockedCases = filteredCases.filter((tc) => !tc.locked && evalStatusByCase[tc.id] === "PASS");
  const failingUnlockedCases = filteredCases.filter((tc) => !tc.locked && evalStatusByCase[tc.id] === "FAIL");
  const passingAllCases = filteredCases.filter((tc) => evalStatusByCase[tc.id] === "PASS");
  const failingAllCases = filteredCases.filter((tc) => evalStatusByCase[tc.id] === "FAIL");
  const allLocked = lockedCount === filteredCases.length && filteredCases.length > 0;
  const showBulkBar = isAgentFiltered && !!latestEvalRun;

  const selectedLockableCases = selectedCases.filter((tc) => !tc.locked && !!evalStatusByCase[tc.id]);
  const selectedLockedCases = selectedCases.filter((tc) => tc.locked);
  const selectedSkippedCount = selectionCount - selectedLockableCases.length;

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
      return;
    }

    setSelectedIds(new Set(filteredCases.map((tc) => tc.id)));
  };

  const handleLockClick = (tc: any) => {
    if (tc.locked) {
      handleUnlock(tc);
      return;
    }

    setLockModal(tc);
    setLockIntent("protect");
    setLockError("");
  };

  const handleUnlock = async (tc: any) => {
    setLockingIds((prev) => new Set(prev).add(tc.id));
    try {
      await api.unlockTestCase(tc.id);
      setAllTestCases((prev) =>
        prev.map((item) => (item.id === tc.id ? { ...item, locked: false, locked_at_pass: undefined } : item))
      );
    } catch (err: any) {
      setError(parseApiError(err));
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
        prev.map((item) =>
          item.id === lockModal.id ? { ...item, locked: true, locked_at_pass: lockIntent === "protect" } : item
        )
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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteModal.id);
        return next;
      });
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setDeletingId(null);
    }
  };

  const bulkLock = async (ids: string[], intent: "protect" | "track", skippedCount = 0) => {
    if (ids.length === 0) {
      setError(
        skippedCount > 0
          ? `${skippedCount} case${skippedCount !== 1 ? "s" : ""} skipped — no latest eval result found yet.`
          : "No eligible cases to lock."
      );
      return;
    }

    setBulkLocking(true);
    setError("");

    const label = intent === "protect" ? "Locking" : "Locking";
    setBulkProgress({ current: 0, total: ids.length, label });

    let succeeded = 0;
    let failed = 0;

    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      setBulkProgress({ current: index + 1, total: ids.length, label });

      try {
        await api.lockTestCaseWithIntent(id, intent);
        setAllTestCases((prev) =>
          prev.map((item) => (item.id === id ? { ...item, locked: true, locked_at_pass: intent === "protect" ? 1 : 0 } : item))
        );
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }

    setBulkLocking(false);
    setSelectedIds(new Set());

    if (failed > 0 || skippedCount > 0) {
      const parts = [`Locked ${succeeded} case${succeeded !== 1 ? "s" : ""}`];
      if (failed > 0) parts.push(`${failed} failed during locking`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped — no latest eval result yet`);
      setError(`${parts.join(". ")}.`);
    }
  };

  const bulkUnlock = async (ids: string[]) => {
    if (ids.length === 0) {
      setError("No locked cases selected.");
      return;
    }

    setBulkLocking(true);
    setError("");
    setBulkProgress({ current: 0, total: ids.length, label: "Unlocking" });

    let failed = 0;

    for (let index = 0; index < ids.length; index++) {
      const id = ids[index];
      setBulkProgress({ current: index + 1, total: ids.length, label: "Unlocking" });

      try {
        await api.unlockTestCase(id);
        setAllTestCases((prev) =>
          prev.map((item) => (item.id === id ? { ...item, locked: false, locked_at_pass: undefined } : item))
        );
      } catch {
        failed += 1;
      }
    }

    setBulkLocking(false);
    setSelectedIds(new Set());

    if (failed > 0) {
      setError(`${failed} case${failed !== 1 ? "s" : ""} failed to unlock.`);
    }
  };

  const smartLockFromEval = async () => {
    if (selectedAgentId === "all" || !selectedAgentId) return;
    setBulkLocking(true);
    setError("");
    setSmartLockSummary(null);

    try {
      const runs = await api.getEvalRuns();
      const agentRuns = runs
        .filter((r) => r.agent_id === selectedAgentId)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      if (agentRuns.length === 0) {
        setError("No eval runs found for this agent. Run an eval first.");
        setBulkLocking(false);
        return;
      }

      const results = await api.getEvalRunResults(agentRuns[0].id);
      const unlockedCases = filteredCases.filter((tc) => !tc.locked);
      const total = unlockedCases.length;
      let mustHold = 0;
      let watching = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < unlockedCases.length; i++) {
        const tc = unlockedCases[i];
        setBulkProgress({ current: i + 1, total, label: "Locking cases" });

        const caseResults = results.filter(
          (r) => r.test_case_id === tc.id && ((r as any).result_type === "deterministic" || !(r as any).result_type)
        );

        if (caseResults.length === 0) {
          skipped++;
          continue;
        }

        const allPassed = caseResults.every((r) => r.passed === true);
        const intent: "protect" | "track" = allPassed ? "protect" : "track";

        try {
          await api.lockTestCaseWithIntent(tc.id, intent);
          setAllTestCases((prev) =>
            prev.map((item) =>
              item.id === tc.id ? { ...item, locked: true, locked_at_pass: allPassed ? 1 : 0 } : item
            )
          );
          if (allPassed) mustHold++;
          else watching++;
        } catch {
          failed++;
        }
      }

      const locked = mustHold + watching;
      const parts = [`Locked ${locked} case${locked !== 1 ? "s" : ""}`];
      if (mustHold > 0) parts.push(`${mustHold} Must Hold`);
      if (watching > 0) parts.push(`${watching} Watching`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (failed > 0) parts.push(`${failed} failed`);
      setSmartLockSummary(parts.join(" — "));
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setBulkLocking(false);
      setSelectedIds(new Set());
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-foreground">Test Cases</h1>
          <p className="text-sm text-muted-foreground">
            {filteredCases.length} test case{filteredCases.length !== 1 ? "s" : ""}
            {selectedAgentId !== "all" ? " (filtered)" : " across all agents"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="h-9 w-[220px] text-sm">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map(({ agent }) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {showBulkBar && selectionCount === 0 && (
        <div className="mb-3 rounded border border-border bg-muted/30 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Bulk Lock</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {evaluatedFilteredCases.length > 0 ? (
                  <>
                    Eval results: {passingAllCases.length} passing, {failingAllCases.length} failing
                    {lockedCount > 0 && ` · ${lockedCount} already locked`}
                    {unevaluatedFilteredCount > 0 && ` · ${unevaluatedFilteredCount} not evaluated`}
                  </>
                ) : (
                  <>No eval results found for this agent's test cases. Run an eval first.</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {lockedCount > 0 && (
                <button
                  onClick={() => bulkUnlock(filteredCases.filter((tc) => tc.locked).map((tc) => tc.id))}
                  disabled={bulkLocking}
                  className="inline-flex items-center gap-1.5 rounded border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Unlock className="h-3 w-3" />
                  Unlock All ({lockedCount})
                </button>
              )}
              <button
                onClick={() => bulkLock(passingUnlockedCases.map((tc) => tc.id), "protect")}
                disabled={bulkLocking || passingUnlockedCases.length === 0}
                className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Shield className="h-3 w-3 text-success" />
                Must Hold Passing ({passingUnlockedCases.length})
              </button>
              <button
                onClick={() => bulkLock(failingUnlockedCases.map((tc) => tc.id), "track")}
                disabled={bulkLocking || failingUnlockedCases.length === 0}
                className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Target className="h-3 w-3 text-primary" />
                Watch Failing ({failingUnlockedCases.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkLocking && (
        <div className="mb-3 flex items-center gap-2 rounded border border-primary/20 bg-primary/10 px-3 py-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs font-medium text-foreground">
            {bulkProgress.label} {bulkProgress.current}/{bulkProgress.total}...
          </span>
        </div>
      )}

      {selectionCount > 0 && !bulkLocking && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded border border-primary/20 bg-primary/10 px-3 py-2.5">
          <div>
            <span className="text-xs font-medium text-foreground">
              {selectionCount} case{selectionCount !== 1 ? "s" : ""} selected
            </span>
            {selectedSkippedCount > 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {selectedSkippedCount} selected case{selectedSkippedCount !== 1 ? "s" : ""} cannot be bulk locked until they appear in the latest eval.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkLock(selectedLockableCases.map((tc) => tc.id), "protect", selectedSkippedCount)}
              disabled={selectedLockableCases.length === 0}
              className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Shield className="h-3 w-3 text-success" />
              Lock as Must Hold
            </button>
            <button
              onClick={() => bulkLock(selectedLockableCases.map((tc) => tc.id), "track", selectedSkippedCount)}
              disabled={selectedLockableCases.length === 0}
              className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Target className="h-3 w-3 text-primary" />
              Lock as Watch
            </button>
            <button
              onClick={() => bulkUnlock(selectedLockedCases.map((tc) => tc.id))}
              disabled={selectedLockedCases.length === 0}
              className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Unlock className="h-3 w-3" />
              Unlock
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {filteredCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Box className="mb-3 h-8 w-8 opacity-40" />
          <p className="text-sm">No test cases found.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 px-2 py-2 text-center">
                  <button onClick={toggleSelectAll} className="text-muted-foreground transition-colors hover:text-foreground">
                    {selectedIds.size === filteredCases.length && filteredCases.length > 0 ? (
                      <CheckSquare className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </button>
                </th>
                <th className="w-10 px-2 py-2 text-center text-xs font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Agent</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scenario</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tags</th>
                <th className="w-24 px-3 py-2 text-center text-xs font-medium text-muted-foreground">Lock</th>
                <th className="w-36 px-3 py-2 text-right text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((tc, index) => {
                const obligationCount = tc.obligation_ids?.length || 0;
                const isSelected = selectedIds.has(tc.id);

                return (
                  <tr
                    key={tc.id}
                    className={`border-b border-border last:border-b-0 transition-colors hover:bg-muted/20 ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-2 py-2.5 text-center">
                      <button onClick={() => toggleSelect(tc.id)} className="text-muted-foreground transition-colors hover:text-foreground">
                        {isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Square className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono text-xs text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{tc._agent_name}</td>
                    <td className="max-w-[280px] px-3 py-2.5 text-foreground">
                      <Link to={`/test-cases/${tc.id}`} className="transition-colors hover:text-primary">
                        <span className="block truncate" title={tc.scenario}>
                          {tc.scenario?.length > 50 ? `${tc.scenario.slice(0, 50)}…` : tc.scenario}
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
                      {(() => {
                        if (!tc.locked) return <span className="text-muted-foreground/50">—</span>;
                        const lap = tc.locked_at_pass;
                        if (lap === 1) {
                           return (
                             <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-500/15 text-green-400 border border-green-500/30 rounded">
                               <Shield className="w-3 h-3" /> Must Hold
                             </span>
                           );
                         }
                         if (lap === 0) {
                           return (
                             <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded">
                               <Target className="w-3 h-3" /> Watching
                             </span>
                           );
                         }
                         return (
                           <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted text-muted-foreground border border-border rounded">
                             <Lock className="w-3 h-3" /> Spec Case
                           </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => handleLockClick(tc)}
                          disabled={lockingIds.has(tc.id)}
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors active:scale-[0.97] disabled:opacity-50 ${
                            tc.locked
                              ? "border-primary/30 bg-primary/15 text-primary hover:bg-primary/25"
                              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {lockingIds.has(tc.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : tc.locked ? (
                            <Unlock className="h-3 w-3" />
                          ) : (
                            <Lock className="h-3 w-3" />
                          )}
                          {tc.locked ? "Unlock" : "Lock"}
                        </button>
                        <Link
                          to={`/test-cases/${tc.id}`}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors active:scale-[0.97] hover:bg-muted hover:text-foreground"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Link>
                        <button
                          onClick={() => setDeleteModal(tc)}
                          className="inline-flex items-center gap-1 rounded border border-destructive/20 px-2 py-1 text-xs font-medium text-destructive/70 transition-colors active:scale-[0.97] hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
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

      {lockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLockModal(null)}>
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-base font-semibold text-foreground">Lock Test Case</h3>
            <p className="mb-5 truncate text-sm text-muted-foreground" title={lockModal.scenario}>
              {lockModal.scenario}
            </p>

            <div className="mb-5 space-y-3">
              <button
                onClick={() => setLockIntent("protect")}
                className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                  lockIntent === "protect"
                    ? "border-success/40 bg-success/10"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Shield className={`mt-0.5 h-5 w-5 shrink-0 ${lockIntent === "protect" ? "text-success" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-medium ${lockIntent === "protect" ? "text-success" : "text-foreground"}`}>
                       Must Hold
                     </p>
                     <p className="mt-1 text-xs text-muted-foreground">
                       This case is currently passing. Lock it to prevent regressions — any future failure will block deployment.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setLockIntent("track")}
                className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                  lockIntent === "track"
                    ? "border-primary/40 bg-primary/10"
                    : "border-border hover:border-border/80 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Target className={`mt-0.5 h-5 w-5 shrink-0 ${lockIntent === "track" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`text-sm font-medium ${lockIntent === "track" ? "text-primary" : "text-foreground"}`}>
                       Watch
                     </p>
                     <p className="mt-1 text-xs text-muted-foreground">
                       This case is currently failing. Lock it to monitor progress — improvement will be celebrated, not blocking.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {lockError && (
              <div className="mb-4 flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {lockError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setLockModal(null)}
                className="rounded border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleLockConfirm}
                disabled={lockingCase}
                className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {lockingCase && <Loader2 className="h-3 w-3 animate-spin" />}
                Lock Case
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteModal(null)}>
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <h3 className="text-base font-semibold text-foreground">Delete Test Case</h3>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              {deleteModal.locked
                 ? "This is a spec case. Deleting it will remove it from your behavioral spec."
                 : "Are you sure you want to delete this test case? This cannot be undone."}
             </p>
             {deleteModal.locked && (
               <div className="mb-3 flex items-center gap-1.5 rounded border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                 <Lock className="h-3 w-3" />
                 This test case is locked as a spec case
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className="rounded border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTestCase}
                disabled={deletingId === deleteModal.id}
                className="inline-flex items-center gap-1.5 rounded bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {deletingId === deleteModal.id && <Loader2 className="h-3 w-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
