import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Agent, type Contract } from "@/lib/api";
import { CodeBlock } from "@/components/ui-shared";
import { Loader2, AlertCircle, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";

export default function AgentContract() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedStubs, setExpandedStubs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    api.getAgent(agentId)
      .then(setAgent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  const toggleStub = (name: string) => {
    setExpandedStubs((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="px-6 py-8">
        <div className="px-3 py-2 text-sm bg-destructive/10 border border-destructive/30 rounded text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error || "Agent not found"}
        </div>
      </div>
    );
  }

  const contract = agent.contract;

  return (
    <div className="max-w-[800px] mx-auto px-6 py-6 animate-fade-in">
      <button
        onClick={() => navigate("/agents")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 active:scale-[0.97]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Agents
      </button>

      <h1 className="text-lg font-semibold text-foreground mb-1">{agent.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">Contract & behavioral specification</p>

      {!contract ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-border rounded bg-card">
          <p className="text-sm">No contract generated yet.</p>
          <p className="text-xs mt-1">Generate a contract from the agent upload page.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {contract.obligations && contract.obligations.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Obligations</h2>
              <ol className="space-y-2 list-decimal list-inside">
                {contract.obligations.map((ob, i) => (
                  <li key={i} className="text-sm text-foreground px-3 py-2 border border-border rounded bg-card">
                    {ob}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {contract.tool_stubs && Object.keys(contract.tool_stubs).length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tool Stubs</h2>
              <div className="space-y-2">
                {Object.entries(contract.tool_stubs).map(([toolName, stub]) => (
                  <div key={toolName} className="border border-border rounded bg-card">
                    <button
                      onClick={() => toggleStub(toolName)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                    >
                      {expandedStubs.has(toolName) ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono font-medium text-foreground">{toolName}</span>
                    </button>
                    {expandedStubs.has(toolName) && (
                      <div className="border-t border-border">
                        <CodeBlock>{JSON.stringify(stub, null, 2)}</CodeBlock>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
