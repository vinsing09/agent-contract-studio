import { useState } from "react";
import { Loader2, PlayCircle, X } from "lucide-react";
import type { AgentVersion } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  activeVersion: AgentVersion | null;
  versions: AgentVersion[];
  onConfirm: (opts: { sourceVersionId?: string }) => Promise<void> | void;
}

export function NewEvalRunDialog({
  open,
  onClose,
  activeVersion,
  versions,
  onConfirm,
}: Props) {
  const [sourceVersionId, setSourceVersionId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open || !activeVersion) return null;

  const otherVersions = versions.filter((v) => v.id !== activeVersion.id);
  const crossVersion = sourceVersionId && sourceVersionId !== activeVersion.id;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm({
        sourceVersionId: crossVersion ? sourceVersionId : undefined,
      });
      onClose();
      setSourceVersionId("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to start eval");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => (!submitting ? onClose() : null)}
    >
      <div
        className="bg-card border border-border rounded-lg p-5 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <PlayCircle className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold text-foreground">New eval run</h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="ml-auto p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Target version
            </label>
            <div className="px-3 py-2 border border-border rounded bg-muted/30 text-foreground font-mono text-xs">
              v{activeVersion.version_number}
              {activeVersion.label ? ` · ${activeVersion.label}` : ""}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Agent this run evaluates. Switch versions on the detail page to change it.
            </p>
          </div>

          {otherVersions.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Test case source (optional)
              </label>
              <select
                value={sourceVersionId}
                onChange={(e) => setSourceVersionId(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground text-xs font-mono"
              >
                <option value="">
                  Use this version's test cases (v{activeVersion.version_number})
                </option>
                {otherVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number}
                    {v.label ? ` · ${v.label}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {crossVersion
                  ? "Cross-version run: test cases from another version will be run against this agent."
                  : "Default: run this version's own test cases."}
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            Start run
          </button>
        </div>
      </div>
    </div>
  );
}
