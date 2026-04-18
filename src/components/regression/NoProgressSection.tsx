import { X } from "lucide-react";
import type { RegressionCaseV2 } from "@/lib/api";

interface Props {
  count: number;
  cases?: RegressionCaseV2[];
}

export function NoProgressSection({ count, cases }: Props) {
  if (count <= 0) return null;
  const hasCases = Array.isArray(cases) && cases.length > 0;
  return (
    <div className="bg-card border border-border rounded border-l-2 border-l-muted-foreground/30 p-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">
        NO CHANGE — {count} cases still failing
      </h3>
      {hasCases ? (
        <div className="space-y-1.5">
          {cases!.map((np) => (
            <div key={np.test_case_id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <X className="w-3.5 h-3.5" />
              {np.scenario}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Case list not yet available from backend. Summary count only.
        </p>
      )}
    </div>
  );
}
