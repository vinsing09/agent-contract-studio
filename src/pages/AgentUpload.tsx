import { useState } from "react";
import { parseApiError } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { api, type AgentDraft, type AuditReport } from "@/lib/api";
import { CodeBlock } from "@/components/ui-shared";
import {
  Loader2,
  Check,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

const BEHAVIOR_PLACEHOLDERS = [
  "e.g. Must not ask user for info available via tools",
  "e.g. Must escalate after 2 failed tool attempts",
];

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Intent", "Implementation", "Audit Results"];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {labels.map((label, i) => {
        const num = i + 1;
        const isActive = num === step;
        const isCompleted = num < step;
        return (
          <div key={num} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-12 h-px ${
                  num <= step ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isActive
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : num}
              </div>
              <span
                className={`text-[11px] ${
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgentUpload() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [businessGoal, setBusinessGoal] = useState("");
  const [behaviors, setBehaviors] = useState(["", ""]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [toolSchemas, setToolSchemas] = useState("");
  const [jsonError, setJsonError] = useState("");

  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [rejectedFixIds, setRejectedFixIds] = useState<Set<string>>(new Set());
  const [expandedFixes, setExpandedFixes] = useState<Set<string>>(new Set());
  const [reviewedFixIds, setReviewedFixIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filledBehaviors = behaviors.filter((b) => b.trim().length > 0);
  const step1Valid =
    name.trim().length > 0 &&
    businessGoal.trim().length > 0 &&
    filledBehaviors.length > 0;

  const addBehavior = () => setBehaviors((prev) => [...prev, ""]);
  const removeBehavior = (i: number) =>
    setBehaviors((prev) => prev.filter((_, idx) => idx !== i));
  const updateBehavior = (i: number, val: string) =>
    setBehaviors((prev) => prev.map((b, idx) => (idx === i ? val : b)));

  const handleRunAudit = async () => {
    setError("");
    setJsonError("");

    let schemas: any[] = [];
    if (toolSchemas.trim()) {
      try {
        schemas = JSON.parse(toolSchemas);
      } catch {
        setJsonError("Invalid JSON format");
        return;
      }
    }

    setLoading(true);
    try {
      const d = await api.createDraft({
        name: name.trim(),
        business_goal: businessGoal.trim(),
        desired_behaviors: filledBehaviors,
        system_prompt: systemPrompt,
        tool_schemas: schemas,
      });
      setDraft(d);

      const report = await api.auditDraft(d.id);
      setAuditReport(report);

      setRejectedFixIds(new Set());
      setReviewedFixIds(new Set());

      setStep(3);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!draft || !auditReport) return;
    setLoading(true);
    setError("");
    try {
      const acceptedIds = (auditReport.suggested_fixes ?? [])
        .filter((f) => !rejectedFixIds.has(f.id))
        .map((f) => f.id);
      const result = await api.commitDraft(draft.id, acceptedIds);
      navigate(`/agents/${result.agent_id}`);
    } catch (err: any) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // markReviewed is now inlined in acceptFix/rejectFix

  const acceptFix = (fixId: string) => {
    console.log("[AcceptFix] fixId:", fixId);
    setRejectedFixIds((prev) => {
      const next = new Set(prev);
      next.delete(fixId);
      return next;
    });
    setReviewedFixIds((prev) => {
      const next = new Set(prev);
      next.add(fixId);
      console.log("[AcceptFix] reviewedFixIds size:", next.size);
      return next;
    });
  };

  const rejectFix = (fixId: string) => {
    console.log("[RejectFix] fixId:", fixId);
    setRejectedFixIds((prev) => {
      const next = new Set(prev);
      next.add(fixId);
      return next;
    });
    setReviewedFixIds((prev) => {
      const next = new Set(prev);
      next.add(fixId);
      console.log("[RejectFix] reviewedFixIds size:", next.size);
      return next;
    });
  };

  const toggleExpandFix = (issueId: string) => {
    setExpandedFixes((prev) => {
      const next = new Set(prev);
      next.has(issueId) ? next.delete(issueId) : next.add(issueId);
      return next;
    });
  };

  const severityColor = (s: string) => {
    if (s === "high")
      return "bg-destructive/10 text-destructive border-destructive/30";
    if (s === "medium")
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  const totalFixes = auditReport?.suggested_fixes?.length ?? 0;
  const acceptedCount = totalFixes - rejectedFixIds.size;
  const rejectedCount = rejectedFixIds.size;

  return (
    <div className="px-6 py-8 max-w-[680px] mx-auto animate-fade-in">
      <StepIndicator step={step} />

      {/* STEP 1 — Intent */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-1">
              Define Agent Intent
            </h1>
            <p className="text-sm text-muted-foreground">
              Start with the why before the how.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="my-support-agent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Business Goal
            </label>
            <textarea
              value={businessGoal}
              onChange={(e) => setBusinessGoal(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              placeholder="What should this agent accomplish for your users? e.g. Help customers resolve billing issues without escalating to a human agent."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Desired Behaviors
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Specific things this agent must or must not do.
            </p>
            <div className="space-y-2">
              {behaviors.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={b}
                    onChange={(e) => updateBehavior(i, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder={
                      BEHAVIOR_PLACEHOLDERS[i] ?? BEHAVIOR_PLACEHOLDERS[1]
                    }
                  />
                  {behaviors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBehavior(i)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addBehavior}
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline underline-offset-2"
            >
              <Plus className="w-3.5 h-3.5" /> Add Behavior
            </button>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!step1Valid}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
          >
            Next: Add Implementation <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STEP 2 — Implementation */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-1">
              Add Implementation
            </h1>
            <p className="text-sm text-muted-foreground">
              Paste your current agent definition. We'll audit it against your
              stated intent.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              System Prompt (v0)
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              required
              rows={8}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-y"
              placeholder="You are a helpful customer support agent..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Tool Schemas
            </label>
            <p className="text-xs text-muted-foreground mb-1.5">
              OpenAI-format JSON array. Leave empty if no tools.
            </p>
            <textarea
              value={toolSchemas}
              onChange={(e) => {
                setToolSchemas(e.target.value);
                setJsonError("");
              }}
              rows={6}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-y"
              placeholder='[{"type": "function", "function": {"name": "..."}}]'
            />
            {jsonError && (
              <p className="mt-1 text-xs text-destructive">{jsonError}</p>
            )}
          </div>

          {error && (
            <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep(1);
                setError("");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border bg-card text-foreground rounded hover:bg-muted transition-colors active:scale-[0.97]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={handleRunAudit}
              disabled={loading || !systemPrompt.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? "Auditing..." : "Run Audit →"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Audit Results */}
      {step === 3 && auditReport && (
        <div className="space-y-6">
          <div>
            <button
              onClick={() => {
                setStep(2);
                setError("");
              }}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Implementation
            </button>
            <h1 className="text-xl font-semibold text-foreground mb-1">
              Review Audit Findings
            </h1>
            <p className="text-sm text-muted-foreground">
              {auditReport.issues.length} issue
              {auditReport.issues.length !== 1 ? "s" : ""} found between your
              intent and implementation.
            </p>
          </div>

          {/* Issues & Fixes */}
          <div className="space-y-3">
            {auditReport.issues.map((issue) => {
              const fix = auditReport.suggested_fixes?.find(
                (f) => f.issue_id === issue.id
              );
              const isExpanded = expandedFixes.has(issue.id);
              const isRejected = fix ? rejectedFixIds.has(fix.id) : false;
              const isAccepted = !isRejected;
              return (
                <div
                  key={issue.id}
                  className={`border rounded bg-card overflow-hidden transition-colors ${
                    fix && isRejected
                      ? "border-red-500/30 opacity-50"
                      : fix
                      ? "border-emerald-500/30"
                      : "border-border"
                  }`}
                >
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded border uppercase ${severityColor(
                            issue.severity
                          )}`}
                        >
                          {issue.severity}
                        </span>
                        <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded border border-border bg-muted text-muted-foreground">
                          {issue.gap_type.replace("_", " ")}
                        </span>
                      </div>
                      {fix && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => acceptFix(fix.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                              isAccepted
                                ? "bg-emerald-600 text-white border border-emerald-600"
                                : "bg-card border border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <Check className="w-3 h-3" /> Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectFix(fix.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded cursor-pointer transition-colors ${
                              isRejected
                                ? "bg-red-500 text-white border border-red-500"
                                : "bg-card border border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                    <p className={`text-sm ${!isAccepted ? "text-muted-foreground/50 line-through" : "text-foreground"}`}>
                      {issue.description}
                    </p>
                  </div>

                  {fix && (
                    <>
                      <button
                        onClick={() => toggleExpandFix(issue.id)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 border-t border-border transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        Suggested Fix
                      </button>

                      {isExpanded && (
                        <div className={`px-4 pb-3 border-t pt-3 space-y-3 transition-colors ${
                          !isAccepted
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-border"
                        }`}>
                          <p className={`text-sm italic ${
                            !isAccepted
                              ? "text-muted-foreground/50 line-through"
                              : "text-muted-foreground"
                          }`}>
                            {fix.description}
                          </p>
                          <div className={!isAccepted ? "opacity-50 line-through decoration-destructive/50" : ""}>
                            <CodeBlock label="Prompt Patch">
                              {fix.prompt_patch}
                            </CodeBlock>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary & Action */}
          <div className="space-y-3 pt-2">
            {totalFixes > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {reviewedFixIds.size} of {totalFixes} fixes reviewed
                </p>
                <p className="text-sm text-muted-foreground">
                  {acceptedCount} fix{acceptedCount !== 1 ? "es" : ""} accepted,{" "}
                  {rejectedCount} rejected
                </p>
              </div>
            )}

            {error && (
              <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive">
                {error}
              </div>
            )}

            {(() => {
              const allReviewed = reviewedFixIds.size >= totalFixes;
              const remaining = totalFixes - reviewedFixIds.size;
              return (
                <>
                  <button
                    onClick={handleCommit}
                    disabled={loading || !allReviewed}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 active:scale-[0.97]"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {loading ? "Creating v1..." : "Generate v1 Agent →"}
                  </button>

                  <p className="text-xs text-muted-foreground text-center">
                    {!allReviewed
                      ? `Review all ${remaining} remaining fix${remaining !== 1 ? "es" : ""} to continue`
                      : `Ready — ${acceptedCount} fix${acceptedCount !== 1 ? "es" : ""} will be applied to v1`}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
