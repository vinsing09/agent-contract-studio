import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, ChevronDown, ChevronRight } from "lucide-react";
import type { ContractV2 } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";

interface Props {
  agentId: string;
  versionId: string;
  contract: ContractV2 | null;
}

export default function ContractPanel({ contract }: Props) {
  const c = contract;
  const location = useLocation();
  const [obligationsOpen, setObligationsOpen] = useState(true);
  const scrolled = useRef(false);

  useEffect(() => {
    if (scrolled.current) return;
    const hash = location.hash;
    if (!hash || !hash.startsWith("#obligation-") || !c) return;
    const id = hash.slice(1);
    setObligationsOpen(true);
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "rounded-md");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-md"), 1600);
        scrolled.current = true;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [location.hash, c]);

  return (
    <div className="space-y-4">
      {/* Obligations */}
      <Card>
        <Collapsible open={obligationsOpen} onOpenChange={setObligationsOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 text-left">
                {obligationsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <CardTitle className="text-[13px] flex items-center gap-2 flex-1">
                  Obligations
                  <Badge variant="outline" className="text-[10px]">
                    {c?.obligations.length ?? 0}
                  </Badge>
                </CardTitle>
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {!c || c.obligations.length === 0 ? (
                <EmptyState icon={FileText} title="No obligations" />
              ) : (
                <ul className="space-y-3">
                  {c.obligations.map((o) => (
                    <li
                      key={o.id}
                      id={`obligation-${o.id}`}
                      className="border-b last:border-0 pb-2 transition-shadow"
                    >
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className="font-medium text-[13px] flex-1">{o.text}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {o.failure_category}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          source: {o.source}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Tool Sequences */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] flex items-center gap-2">
            Tool Sequences
            <Badge variant="outline" className="text-[10px]">
              {c?.tool_sequences.length ?? 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!c || c.tool_sequences.length === 0 ? (
            <EmptyState icon={FileText} title="No tool sequences defined for this contract" />
          ) : (
            <ul className="space-y-3">
              {c.tool_sequences.map((s, i) => (
                <li key={i} className="border-b last:border-0 pb-2">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <span className="font-medium text-[13px] flex-1">{s.scenario}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.failure_category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {s.sequence.map((name, j) => (
                      <span key={j} className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          {name}
                        </Badge>
                        {j < s.sequence.length - 1 && (
                          <span className="text-muted-foreground text-[11px]">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Forbidden Behaviors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] flex items-center gap-2">
            Forbidden Behaviors
            <Badge variant="outline" className="text-[10px]">
              {c?.forbidden_behaviors.length ?? 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!c || c.forbidden_behaviors.length === 0 ? (
            <EmptyState icon={FileText} title="No forbidden behaviors defined" />
          ) : (
            <ul className="space-y-2">
              {c.forbidden_behaviors.map((b, i) => (
                <li key={i} className="flex items-start gap-2 flex-wrap">
                  <Badge variant="destructive" className="text-[10px] whitespace-normal text-left">
                    {b.text}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {b.failure_category}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Latency Budgets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] flex items-center gap-2">
            Latency Budgets
            <Badge variant="outline" className="text-[10px]">
              {c?.latency_budgets.length ?? 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!c || c.latency_budgets.length === 0 ? (
            <EmptyState icon={FileText} title="No latency budgets defined" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Max latency (ms)</TableHead>
                  <TableHead>Failure category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.latency_budgets.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>{l.scenario}</TableCell>
                    <TableCell className="font-mono">{l.max_latency_ms}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {l.failure_category}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
