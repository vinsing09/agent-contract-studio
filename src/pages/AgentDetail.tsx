import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, type Agent, type Contract, type TestCase, type EvalRun, type EvalResult, type AgentVersion } from "@/lib/api";
import { CodeBlock, StatusBadge } from "@/components/ui-shared";
import {
  Loader2, AlertCircle, ArrowLeft, ChevronDown, ChevronRight, Trash2,
  FileText, ListChecks, PlayCircle, CheckCircle2, XCircle, X, Plus, Sparkles, Check
} from "lucide-react";

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
  const [generatingTests, setGeneratingTests] = useState(false);
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState<Set<string>>(new Set());
  const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState<Set<string>>(new Set());
  const [reviewedSuggestionIds, setReviewedSuggestionIds] = useState<Set<string>>(new Set());
  const [applyingFixes, setApplyingFixes] = useState(false);
  const [improvementError, setImprovementError] = useState("");

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

  const handleGenerateTests = async () => {
    if (!id || !activeVersion) return;
    setGeneratingTests(true);
    try {
      await api.generateTestCasesV2(id, activeVersion.id);
      const cases = await api.getTestCasesV2(id, activeVersion.id);
      setTestCases(Array.isArray(cases) ? cases : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingTests(false);
    }
  };

  const handleRunEval = async () => {
    if (!id || !activeVersion) return;
    setRunningEval(true);
    try {
      const response = await api.runEvalV2(id, activeVersion.id) as any;
      const runId = response?.eval_run?.id || response?.id;
      const results = await api.getEvalRunResults(runId);
      setLatestRun(response?.eval_run || response);
      setLatestResults(results);
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
    try {
      const [c, cases] = await Promise.all([
        api.getContractV2(id, version.id).catch(() => null),
        api.getTestCasesV2(id, version.id).catch(() => []),
      ]);
      setContract(c);
      setTestCases(Array.isArray(cases) ? cases : []);
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

  const handleSuggestImprovements = async () => {
    if (!id || !activeVersion || !latestRun) return;
    setLoadingSuggestions(true);
    setShowImprovements(true);
    setImprovementError("");
    setSuggestions([]);
    try {
      const result = await api.getSuggestions(id, activeVersion.id, latestRun.id);
      setSuggestions(result.suggestions);
      const allIds = new Set(result.suggestions.map((s: any) => s.id));
      setAcceptedSuggestionIds(allIds);
      setRejectedSuggestionIds(new Set());
      setReviewedSuggestionIds(new Set());
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
      const accepted = suggestions.filter(s => !rejectedSuggestionIds.has(s.id)).map(s => s.id);
      await api.applySuggestions(id, activeVersion.id, {
        accepted_fix_ids: accepted,
        eval_run_id: latestRun.id,
        label: "Improved from eval results",
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
                <div className="px-3 py-2 border-t border-border">
                  <button
                    onClick={openNewVersionDrawer}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    New Version
                  </button>
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
            {hasContract && contract && (
              <div className="space-y-3">
                {obligations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Obligations</p>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      {obligations.map((ob: any, i: number) => (
                        <li key={isV2Obligations ? ob.id : i} className="text-sm text-foreground">
                          {isV2Obligations ? (
                            <span className="inline-flex items-center gap-2">
                              <span>{ob.text}</span>
                              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-mono border rounded-sm ${sourceColors[ob.source] || sourceColors.behavioral}`}>
                                {ob.source}
                              </span>
                            </span>
                          ) : (
                            ob
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {contract.tool_stubs && Object.keys(contract.tool_stubs).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tool Stubs</p>
                    <div className="space-y-1">
                      {Object.entries(contract.tool_stubs).map(([toolName, stub]) => (
                        <div key={toolName} className="border border-border rounded">
                          <button
                            onClick={() => toggleStub(toolName)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                          >
                            {expandedStubs.has(toolName) ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                            <span className="font-mono text-foreground">{toolName}</span>
                          </button>
                          {expandedStubs.has(toolName) && (
                            <div className="border-t border-border">
                              <CodeBlock>{JSON.stringify(stub, null, 2)}</CodeBlock>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
                  <Link to={`/test-cases?agent=${id}`} className="text-primary hover:underline">
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
            <button
              onClick={handleGenerateContract}
              disabled={hasContract || generatingContract || !activeVersion}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted active:scale-[0.97]"
            >
              {generatingContract && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasContract ? (
                <><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Contract Generated</>
              ) : generatingContract ? (
                contractStatus
              ) : (
                "Generate Contract"
              )}
            </button>
            {hasTests ? (
              <Link
                to={`/test-cases?agent=${id}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors hover:bg-muted active:scale-[0.97]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> {testCases.length} Test Cases
              </Link>
            ) : (
              <button
                onClick={handleGenerateTests}
                disabled={!hasContract || generatingTests || !activeVersion}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted active:scale-[0.97]"
              >
                {generatingTests && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Generate Test Cases
              </button>
            )}
            <button
              onClick={handleRunEval}
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
            {latestRun && (latestRun as any).status === "completed" && (
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
            <div className="border border-border rounded bg-card p-4 mt-4 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Suggested Improvements</h3>
                  {!loadingSuggestions && suggestions.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {latestResults.filter(r => r.passed === false).length} failing cases from the last eval. Review and accept fixes to create a new version.
                    </p>
                  )}
                </div>
                <button onClick={() => setShowImprovements(false)} className="p-1 hover:bg-muted rounded transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
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
                    {suggestions.map((s: any) => {
                      const isAccepted = acceptedSuggestionIds.has(s.id);
                      const isRejected = rejectedSuggestionIds.has(s.id);
                      return (
                        <div key={s.id} className="border border-border rounded bg-background p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAcceptSuggestion(s.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border transition-colors ${
                                isAccepted
                                  ? "bg-success/15 text-success border-success/30"
                                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectSuggestion(s.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-sm border transition-colors ${
                                isRejected
                                  ? "bg-destructive/15 text-destructive border-destructive/30"
                                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                              }`}
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{s.failure_pattern}</p>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                          {s.prompt_patch && (
                            <pre className="p-2 text-xs font-mono bg-muted/50 border border-border rounded overflow-x-auto text-foreground leading-relaxed">
                              <code>{s.prompt_patch}</code>
                            </pre>
                          )}
                          {s.affected_cases && s.affected_cases.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="text-[10px] text-muted-foreground">Affects {s.affected_cases.length} cases:</span>
                              {s.affected_cases.map((c: any, i: number) => (
                                <span key={i} className="inline-flex px-1.5 py-0.5 text-[10px] font-mono bg-muted text-muted-foreground border border-border rounded-sm">
                                  {typeof c === "string" ? c : c.scenario || c.name || c.id}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
