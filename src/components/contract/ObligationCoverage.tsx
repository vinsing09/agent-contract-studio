import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ObligationV2, TestCaseV2 } from "@/lib/types";

interface Props {
  agentId: string;
  obligations: ObligationV2[];
  testCases: TestCaseV2[];
}

export function ObligationCoverage({ agentId, obligations, testCases }: Props) {
  if (!obligations || obligations.length === 0) return null;

  const casesByObligation: Record<string, TestCaseV2[]> = {};
  for (const o of obligations) casesByObligation[o.id] = [];
  for (const tc of testCases) {
    for (const oid of tc.obligation_ids ?? []) {
      if (casesByObligation[oid]) casesByObligation[oid].push(tc);
    }
  }

  const uncoveredCount = obligations.filter((o) => casesByObligation[o.id].length === 0).length;
  const coveredCount = obligations.length - uncoveredCount;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] flex items-center gap-2">
          Obligation Coverage
          <Badge variant="outline" className="text-[10px]">
            {coveredCount}/{obligations.length} covered
          </Badge>
          {uncoveredCount > 0 && (
            <Badge variant="destructive" className="text-[10px] ml-auto">
              {uncoveredCount} uncovered
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {obligations.map((o) => {
            const cases = casesByObligation[o.id];
            const covered = cases.length > 0;
            return (
              <li key={o.id} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                {covered ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-foreground break-words">{o.text}</p>
                  {covered ? (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{cases.length} test case{cases.length === 1 ? "" : "s"}:</span>
                      {cases.slice(0, 5).map((tc) => (
                        <Link
                          key={tc.id}
                          to={`/agents/${agentId}/test-cases/${tc.id}`}
                          className="inline-flex px-1.5 py-0.5 font-mono border border-border rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          {tc.scenario.length > 28 ? tc.scenario.slice(0, 28) + "…" : tc.scenario}
                        </Link>
                      ))}
                      {cases.length > 5 && (
                        <span className="text-muted-foreground">+{cases.length - 5} more</span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-destructive">No test cases cover this obligation.</p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {o.failure_category}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
