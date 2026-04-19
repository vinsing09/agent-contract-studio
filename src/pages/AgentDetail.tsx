import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ApiError, type Agent, type Contract, type TestCase, type EvalRun, type EvalResult, type AgentVersion } from "@/lib/api";
import type { ContractV2, Suggestion } from "@/lib/types";
import ContractPanel from "@/components/contract/ContractPanel";
import { RegenerateContractDialog } from "@/components/contract/RegenerateContractDialog";
import { SuggestionCard } from "@/components/improvements/SuggestionCard";
import { NewEvalRunDialog } from "@/components/eval/NewEvalRunDialog";
import { CodeBlock, StatusBadge } from "@/components/ui-shared";
import {
  Loader2, AlertCircle, ArrowLeft, ChevronDown, ChevronRight, Trash2,
  FileText, ListChecks, PlayCircle, CheckCircle2, X, Plus, Sparkles, FileJson
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [contract, setContract] = useState<any>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [latestRun, setLatestRun] = useState<EvalRun | null>(null);
  const [latestResults, setLatestResults] = useState<EvalResult[]>([]);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<AgentVersion | null>(null);
  const [schema, setSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showPrompt, setShowPrompt] = useState(false);
  const [showSchemas, setShowSchemas] = useState(false);
  const [expandedStubs, setExpandedStubs] = useState<Set<string>>(new Set());

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractStatus, setContractStatus] = useState("");
  const [runningEval, setRunningEval] = useState(false);

  const [showVersionPanel, setShowVersionPanel] = useState(true);
  const [showNewVersionDrawer, setShowNewVersionDrawer] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [newVersionPrompt, setNewVersionPrompt] = useState("");
  const [newVersionSchemas, setNewVersionSchemas] = useState("");
  const [newVersionError, setNewVersionError] = useState("");
  const [switchingVersion, setSwitchingVersion] = useState(false);

  const [showImprovements, setShowImprovements] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState<Set<string>>(new Set());
  const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState<Set<string>>(new Set());
  const [reviewedSuggestionIds, setReviewedSuggestionIds] = useState<Set<string>>(new Set());
  const [applyingFixes, setApplyingFixes] = useState(false);
  const [improvementError, setImprovementError] = useState("");
  const [suggestionMode, setSuggestionMode] = useState<"standard" | "deep">("standard");
  const [showEvalRunDialog, setShowEvalRunDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.getAgent(id),
      api.getAgentVersions(id).catch(() => []),
      api.getSchema(id).catch(() => null),
      api.getEvalRuns().catch(() => []),
    ])
      .then(async ([agentData, versionsData, schemaData, runs]) => {
        setAgent(agentData);
        const vList = Array.isArray(versionsData) ? versionsData : [];
        setVersions(vList);
        setSchema(schemaData);

        // Find latest version
        const latest = vList.length > 0
          ? vList.reduce((a, b) => a.version_number > b.version_number ? a : b)
          : null;
        setActiveVersion(latest);

        // Fetch contract and test cases using V2 if we have a version, else fallback
        const [contractData, cases] = await Promise.all([
          latest
            ? api.getContractV2(id, latest.id).catch(() => null)
            : api.getAgentContract(id).catch(() => null),
          latest
            ? api.getTestCasesV2(id, latest.id).catch(() => [])
            : api.getTestCases(id).catch(() => []),
        ]);

        setContract(contractData || agentData.contract || null);
        setTestCases(Array.isArray(cases) ? cases : []);

        const agentRuns = (runs as EvalRun[]).filter((r) => r.agent_id === id);
        if (agentRuns.length > 0) {
          const latestR = agentRuns[0];
          setLatestRun(latestR);
          api.getEvalRunResults(latestR.id)
            .then((res) => setLatestResults(res))
            .catch(() => {});
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteAgent(id);
      navigate("/agents");
    } catch (err: any) {
      const msg = err.message || "Failed to delete agent";
      if (msg.includes("400")) {
        setDeleteModal(false);
        setDeleteError(msg);
      } else {
        setDeleteError(msg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateContract = async () => {
    if (!id || !activeVersion) return;
    setGeneratingContract(true);
    setContractStatus("Extracting schema...");
    try {
      await api.extractSchema(id);
      setContractStatus("Generating contract...");
      await api.generateContractV2(id, activeVersion.id);
      const c = await api.getContractV2(id, activeVersion.id);
      setContract(c);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingContract(false);
      setContractStatus("");
    }
  };

  const handleRunEval = async (sourceVersionId?: string) => {
    if (!id || !activeVersion) return;
    setRunningEval(true);
    try {
      const body =
        sourceVersionId && sourceVersionId !== activeVersion.id
          ? { test_case_source_version_id: sourceVersionId }
          : {};
      const response = await api.createEvalRun(id, activeVersion.id, body);
      const run = (response.eval_run as EvalRun | undefined) ?? (response as unknown as EvalRun);
      const runId = run?.id;
      if (runId) {
        const results = await api.getEvalRunResults(runId);
        setLatestRun(run);
        setLatestResults(results);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunningEval(false);
    }
  };

  const toggleStub = (name: string) => {
    setExpandedStubs((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleSwitchVersion = async (version: AgentVersion) => {
    if (!id || version.id === activeVersion?.id) return;
    setSwitchingVersion(true);
    setActiveVersion(version);
    setLatestRun(null);
    setLatestResults([]);
    setSuggestions([]);
    setShowImprovements(false);
    setReviewedSuggestionIds(new Set());
    setRejectedSuggestionIds(new Set());
    try {
      const [c, cases, runs] = await Promise.all([
        api.getContractV2(id, version.id).catch(() => null),
        api.getTestCasesV2(id, version.id).catch(() => []),
        api.getEvalRuns().catch(() => []),
      ]);
      setContract(c);
      setTestCases(Array.isArray(cases) ? cases : []);
      const versionRuns = (runs as EvalRun[]).filter(
        (r) => r.agent_id === id && (r as any).agent_version_id === version.id
      );
      if (versionRuns.length > 0) {
        const latestR = versionRuns[0];
        setLatestRun(latestR);
        api.getEvalRunResults(latestR.id)
          .then((res) => setLatestResults(res))
          .catch(() => {});
      }
    } catch {} finally {
      setSwitchingVersion(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!id || !newVersionLabel.trim()) return;
    setCreatingVersion(true);
    setNewVersionError("");
    try {
      let parsedSchemas = activeVersion?.tool_schemas || [];
      if (newVersionSchemas.trim()) {
        try { parsedSchemas = JSON.parse(newVersionSchemas); } catch {}
      }
      await api.createVersion(id, {
        system_prompt: newVersionPrompt,
        tool_schemas: parsedSchemas,
        label: newVersionLabel,
      });
      const vList = await api.getAgentVersions(id);
      const sorted = Array.isArray(vList) ? vList : [];
      setVersions(sorted);
      const latest = sorted.reduce((a, b) => a.version_number > b.version_number ? a : b);
      setActiveVersion(latest);
      const [c, cases] = await Promise.all([
        api.getContractV2(id, latest.id).catch(() => null),
        api.getTestCasesV2(id, latest.id).catch(() => []),
      ]);
      setContract(c);
      setTestCases(Array.isArray(cases) ? cases : []);
      setShowNewVersionDrawer(false);
      setNewVersionLabel("");
      setNewVersionPrompt("");
      setNewVersionSchemas("");
    } catch (err: any) {
      setNewVersionError(err.message || "Failed to create version");
    } finally {
      setCreatingVersion(false);
    }
  };

  const openNewVersionDrawer = () => {
    setNewVersionPrompt(activeVersion?.system_prompt || agent?.system_prompt || "");
    setNewVersionSchemas(JSON.stringify(activeVersion?.tool_schemas || agent?.tool_schemas || [], null, 2));
    setNewVersionLabel("");
    setNewVersionError("");
    setShowNewVersionDrawer(true);
  };

  const handleSuggestImprovements = async (mode: "standard" | "deep" = suggestionMode) => {
    if (!id || !activeVersion || !latestRun) return;
    setSuggestionMode(mode);
    setLoadingSuggestions(true);
    setShowImprovements(true);
    setImprovementError("");
    setSuggestions([]);
    try {
      const result = await api.getSuggestions(id, activeVersion.id, latestRun.id, mode);
      setSuggestions(result.suggestions);
      const allIds = new Set(result.suggestions.map((s) => s.id));
      setAcceptedSuggestionIds(allIds);
      setRejectedSuggestionIds(new Set());
      setReviewedSuggestionIds(new Set(allIds));
    } catch (err: any) {
      setImprovementError(err.message || "Failed to get suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAcceptSuggestion = (sId: string) => {
    setRejectedSuggestionIds(prev => { const n = new Set(prev); n.delete(sId); return n; });
    setAcceptedSuggestionIds(prev => new Set(prev).add(sId));
    setReviewedSuggestionIds(prev => new Set(prev).add(sId));
  };

  const handleRejectSuggestion = (sId: string) => {
    setAcceptedSuggestionIds(prev => { const n = new Set(prev); n.delete(sId); return n; });
    setRejectedSuggestionIds(prev => new Set(prev).add(sId));
    setReviewedSuggestionIds(prev => new Set(prev).add(sId));
  };

  const handleApplyFixes = async () => {
    if (!id || !activeVersion || !latestRun) return;
    setApplyingFixes(true);
    setImprovementError("");
    try {
      const acceptedIds = suggestions
        .filter((s) => !rejectedSuggestionIds.has(s.id))
        .map((s) => s.id);

      const acceptedPatches: Record<string, string> = {};
      for (const s of suggestions) {
        if (!rejectedSuggestionIds.has(s.id) && s.prompt_patch) {
          acceptedPatches[s.id] = s.prompt_patch;
        }
      }

      await api.applySuggestions(id, activeVersion.id, {
        accepted_fix_ids: acceptedIds,
        eval_run_id: latestRun.id,
        label: "Improved from eval results",
        accepted_patches:
          Object.keys(acceptedPatches).length > 0 ? acceptedPatches : undefined,
      });
      const vList = await api.getAgentVersions(id);
      const sorted = Array.isArray(vList) ? vList : [];
      setVersions(sorted);
      const latest = sorted.reduce((a, b) => a.version_number > b.version_number ? a : b);
      setActiveVersion(latest);
      const [c, cases] = await Promise.all([
        api.getContractV2(id, latest.id).catch(() => null),
        api.getTestCasesV2(id, latest.id).catch(() => []),
      ]);
      setContract(c);
      setTestCases(Array.isArray(cases) ? cases : []);
      setShowImprovements(false);
    } catch (err: any) {
      setImprovementError(err.message || "Failed to apply fixes");
    } finally {
      setApplyingFixes(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="px-6 py-8">
        <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error || "Agent not found"}
        </div>
      </div>
    );
  }

  const hasContract = !!contract;
  const hasTests = testCases.length > 0;
  const testCaseIds = [
    ...new Set(latestResults.map(r => (r as any).test_case_id))
  ];
  const passedCaseCount = testCaseIds.filter(tcId => {
    const caseResults = latestResults.filter(r =>
      (r as any).test_case_id === tcId &&
      (r as any).result_type === 'deterministic'
    );
    return caseResults.length > 0 &&
      caseResults.every(r => r.passed === true);
  }).length;
  const totalCaseCount = testCaseIds.length;
  const passRate = totalCaseCount > 0 ?
    Math.round((passedCaseCount / totalCaseCount) * 100) : 0;

  // Tag breakdown
  const tagCounts: Record<string, number> = {};
  for (const tc of testCases) {
    for (const tag of tc.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  // Check if obligations are V2 format (objects with id/text/source)
  const obligations = contract?.obligations || [];
  const isV2Obligations = obligations.length > 0 && typeof obligations[0] === "object" && obligations[0]?.text;

  const sourceColors: Record<string, string> = {
    goal: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    desired_behavior: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    behavioral: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="px-6 py-6 animate-fade-in">
      <Link
        to="/agents"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 active:scale-[0.97]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Agents
      </Link>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {deleteError && (
        <div className="mb-4 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {deleteError}
        </div>
      )}

      <div className="flex gap-6">
        {/* Left Column - 30% */}
        <div className="w-[30%] shrink-0 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{agent.name}</h1>
              {activeVersion && (
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-full">
                  v{activeVersion.version_number}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-1">{agent.id}</p>
            {activeVersion && (
              <p className="text-xs text-muted-foreground mt-1">
                Version {activeVersion.version_number} · {activeVersion.source} · {new Date(activeVersion.created_at).toLocaleDateString()}
              </p>
            )}
            {activeVersion && (
              <div className="mt-2">
                <Button asChild variant="outline" size="sm">
                  <Link
                    to={`/agents/${id}/versions/${activeVersion.id}/schema`}
                    aria-label="Open schema viewer"
                    className="text-[13px]"
                  >
                    <FileJson className="w-3.5 h-3.5 mr-1.5" />
                    Schema
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Version Timeline */}
          <div className="border border-border rounded bg-card">
            <button
              onClick={() => setShowVersionPanel(!showVersionPanel)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              {showVersionPanel ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Versions</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{versions.length}</span>
            </button>
            {showVersionPanel && (
              <div className="border-t border-border">
                {switchingVersion && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="divide-y divide-border">
                  {[...versions].sort((a, b) => a.version_number - b.version_number).map((v) => {
                    const isActive = v.id === activeVersion?.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => handleSwitchVersion(v)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/30 transition-colors ${isActive ? "bg-muted/20" : ""}`}
                      >
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono rounded-full border ${isActive ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}>
                          v{v.version_number}
                        </span>
                        <span className="text-sm text-foreground truncate flex-1">{v.label}</span>
                        <span className="inline-flex px-1 py-0.5 text-[9px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">{v.source}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(v.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        {isActive && <span className="text-[10px] text-muted-foreground">(active)</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="px-3 py-2 border-t border-border flex items-center gap-3">
                  <button
                    onClick={openNewVersionDrawer}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    New Version
                  </button>
                  {versions.length >= 2 && (
                    <Link
                      to={`/agents/${id}/diff${activeVersion && versions.length >= 2 ? (() => {
                        const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
                        const right = activeVersion.id;
                        const left = sorted.find((v) => v.id !== right)?.id ?? sorted[1].id;
                        return `?left=${left}&right=${right}`;
                      })() : ""}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Compare versions
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Business Goal */}
          <div className="border border-border rounded bg-card">
            <div className="px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Goal</span>
              <p className="text-sm text-foreground mt-1">
                {(agent as any).business_goal || <span className="text-muted-foreground italic">No business goal set</span>}
              </p>
            </div>
          </div>

          {/* System Prompt */}
          <div className="border border-border rounded bg-card">
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              {showPrompt ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System Prompt</span>
            </button>
            {showPrompt && (
              <div className="border-t border-border px-3 py-2">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{agent.system_prompt}</p>
              </div>
            )}
          </div>

          {/* Tool Schemas */}
          <div className="border border-border rounded bg-card">
            <button
              onClick={() => setShowSchemas(!showSchemas)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
            >
              {showSchemas ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tool Schemas</span>
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">{agent.tool_schemas?.length || 0}</span>
            </button>
            {showSchemas && (
              <div className="border-t border-border">
                <CodeBlock>{JSON.stringify(agent.tool_schemas, null, 2)}</CodeBlock>
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={() => setDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-destructive border border-destructive/30 rounded hover:bg-destructive/10 transition-colors active:scale-[0.97]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Agent
          </button>
        </div>

        {/* Right Column - 70% */}
        <div className="flex-1 space-y-6">
          {/* Contract Status */}
          <section className="border border-border rounded bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Contract</h2>
              {hasContract ? (
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-success/15 text-success border border-success/30 rounded-sm">GENERATED</span>
              ) : (
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">NONE</span>
              )}
            </div>
            {activeVersion && id && (
              <ContractPanel
                agentId={id}
                versionId={activeVersion.id}
                contract={
                  contract && Array.isArray(contract.tool_sequences)
                    ? (contract as ContractV2)
                    : null
                }
                testCases={testCases as any}
              />
            )}
          </section>

          {/* Test Cases Summary */}
          <section className="border border-border rounded bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Test Cases</h2>
              <span className="text-xs font-mono text-muted-foreground">{testCases.length}</span>
            </div>
            {Object.keys(tagCounts).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {Object.entries(tagCounts).map(([tag, count]) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                    {tag} <span className="text-foreground font-medium">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Latest Eval */}
          {latestRun && (
            <section className="border border-border rounded bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <PlayCircle className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Last Eval</h2>
                <StatusBadge status={latestRun.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="font-mono">{passedCaseCount}/{totalCaseCount} cases passed ({passRate}%)</span>
                <span>{new Date(latestRun.started_at).toLocaleDateString()}</span>
              </div>
              {contract?.created_at && latestRun.started_at &&
                new Date(latestRun.started_at) < new Date(contract.created_at) && (
                <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 text-[11px] bg-warning/10 border border-warning/30 rounded text-foreground">
                  <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                  Contract has changed since this run. Re-run eval to re-baseline.
                </div>
              )}
            </section>
          )}

          {/* Next Step Guidance */}
          {(() => {
            const hasLockedCases = testCases.some((tc) => (tc as any).locked === true);

            if (hasTests && !latestRun) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 text-xs bg-primary/10 border border-primary/20 rounded text-muted-foreground">
                  <span className="text-primary font-bold">→</span>
                  Run an eval to see how your agent performs
                </div>
              );
            }
            if (hasTests && latestRun && !hasLockedCases) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 text-xs bg-primary/10 border border-primary/20 rounded text-muted-foreground">
                  <span className="text-primary font-bold">→</span>
                  Lock cases to build your behavioral spec —{" "}
                  <Link to={`/test-cases?agent_id=${id}${activeVersion ? `&version_id=${activeVersion.id}` : ''}`} className="text-primary hover:underline">
                    Go to Test Cases →
                  </Link>
                </div>
              );
            }
            if (hasLockedCases) {
              return (
                <div className="flex items-center gap-2 px-3 py-2 text-xs bg-primary/10 border border-primary/20 rounded text-muted-foreground">
                  <span className="text-primary font-bold">→</span>
                  Ready for behavioral check — test a new version —{" "}
                  <Link to="/regression" className="text-primary hover:underline">
                    Run Version Comparison →
                  </Link>
                </div>
              );
            }
            return null;
          })()}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {hasContract && id && activeVersion ? (
              <RegenerateContractDialog
                agentId={id}
                versionId={activeVersion.id}
                onSuccess={async () => {
                  if (!id || !activeVersion) return;
                  const c = await api.getContractV2(id, activeVersion.id).catch(() => null);
                  setContract(c);
                }}
                trigger={
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors hover:bg-muted active:scale-[0.97]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    Regenerate contract
                  </button>
                }
              />
            ) : (
              <button
                onClick={handleGenerateContract}
                disabled={generatingContract || !activeVersion}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted active:scale-[0.97]"
              >
                {generatingContract && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {generatingContract ? contractStatus : "Generate contract"}
              </button>
            )}
            {hasTests ? (
              <Link
                to={`/test-cases?agent_id=${id}${activeVersion ? `&version_id=${activeVersion.id}` : ''}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors hover:bg-muted active:scale-[0.97]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> {testCases.length} Test Cases
              </Link>
            ) : hasContract && activeVersion ? (
              <Link
                to={`/agents/${id}/versions/${activeVersion.id}/test-cases/generate`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors hover:bg-muted active:scale-[0.97]"
              >
                Generate test cases
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors opacity-40 cursor-not-allowed"
              >
                Generate test cases
              </button>
            )}
            <button
              onClick={() => setShowEvalRunDialog(true)}
              disabled={!hasTests || runningEval || !activeVersion}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${
                latestRun
                  ? "border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {runningEval && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {latestRun ? "Re-run Eval" : "Run Full Eval"}
            </button>
            {latestRun && ((latestRun as any).status === "completed" || (latestRun as any).status === "blocked") && (
              <button
                onClick={handleSuggestImprovements}
                disabled={loadingSuggestions}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors hover:bg-muted active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingSuggestions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Suggest Improvements
              </button>
            )}
          </div>

          {/* Improvement Panel */}
          {showImprovements && (
            <div className="border border-border rounded bg-card p-4 mt-4 space-y-4 min-w-0 overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">Suggested Improvements</h3>
                  {!loadingSuggestions && suggestions.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {latestResults.filter(r => r.passed === false).length} failing cases from the last eval. Review and accept fixes to create a new version.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="inline-flex border border-border rounded-sm overflow-hidden text-[11px] font-medium">
                    <button
                      onClick={() => handleSuggestImprovements("standard")}
                      disabled={loadingSuggestions}
                      className={`px-2 py-1 transition-colors ${
                        suggestionMode === "standard"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Fast suggestions from the last run"
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => handleSuggestImprovements("deep")}
                      disabled={loadingSuggestions}
                      className={`px-2 py-1 border-l border-border transition-colors ${
                        suggestionMode === "deep"
                          ? "bg-primary text-primary-foreground"
                          : "bg-transparent text-muted-foreground hover:bg-muted"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title="Deeper analysis, slower"
                    >
                      Deep
                    </button>
                  </div>
                  <button onClick={() => setShowImprovements(false)} className="p-1 hover:bg-muted rounded transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {loadingSuggestions && (
                <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing failures...
                </div>
              )}

              {improvementError && (
                <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {improvementError}
                </div>
              )}

              {!loadingSuggestions && suggestions.length > 0 && (
                <>
                  <div className="space-y-3">
                    {suggestions.map((s) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        accepted={acceptedSuggestionIds.has(s.id)}
                        rejected={rejectedSuggestionIds.has(s.id)}
                        onAccept={() => handleAcceptSuggestion(s.id)}
                        onReject={() => handleRejectSuggestion(s.id)}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {acceptedSuggestionIds.size} improvements accepted, {rejectedSuggestionIds.size} rejected
                  </p>

                  {reviewedSuggestionIds.size < suggestions.length && (
                    <p className="text-xs text-muted-foreground">
                      Review all {suggestions.length - reviewedSuggestionIds.size} suggestions to continue
                    </p>
                  )}

                  <button
                    onClick={handleApplyFixes}
                    disabled={reviewedSuggestionIds.size < suggestions.length || applyingFixes}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
                  >
                    {applyingFixes && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Create New Version with Accepted Fixes
                  </button>
                </>
              )}
            </div>
          )}

          {latestRun && (
            <p className="text-xs text-muted-foreground mt-1">
              Last eval: {passedCaseCount}/{totalCaseCount} cases passed · {new Date(latestRun.started_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <NewEvalRunDialog
        open={showEvalRunDialog}
        onClose={() => setShowEvalRunDialog(false)}
        activeVersion={activeVersion}
        versions={versions}
        onConfirm={async ({ sourceVersionId }) => {
          await handleRunEval(sourceVersionId);
        }}
      />

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteModal(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 className="w-5 h-5 text-destructive" />
              <h3 className="text-base font-semibold text-foreground">Delete Agent</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              This will delete all test cases, eval runs, and spec case locks for this agent. This cannot be undone.
            </p>
            {deleteError && (
              <div className="mb-3 px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteModal(false)}
                className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Version Drawer */}
      {showNewVersionDrawer && (
        <div className="fixed inset-0 z-50" onClick={() => setShowNewVersionDrawer(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute right-0 top-0 h-full w-[420px] max-w-full bg-card border-l border-border p-6 overflow-y-auto transform transition-transform duration-200 translate-x-0 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-foreground">New Version</h3>
              <button onClick={() => setShowNewVersionDrawer(false)} className="p-1 hover:bg-muted rounded transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Changes will create a new version. The current version stays unchanged.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">What are you changing?</label>
                <input
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  placeholder="e.g. Fixed escalation path"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">System Prompt</label>
                <textarea
                  value={newVersionPrompt}
                  onChange={(e) => setNewVersionPrompt(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Tool Schemas</label>
                <p className="text-[10px] text-muted-foreground mb-1">Leave unchanged to keep current tool schemas</p>
                <textarea
                  value={newVersionSchemas}
                  onChange={(e) => setNewVersionSchemas(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-sm font-mono bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              {newVersionError && (
                <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {newVersionError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowNewVersionDrawer(false)}
                  className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVersion}
                  disabled={!newVersionLabel.trim() || creatingVersion}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingVersion && <Loader2 className="w-3 h-3 animate-spin" />}
                  Create Version
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
