import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, Agent } from "@/lib/api";
import { Box, ArrowRight, Loader2 } from "lucide-react";

export default function AgentList() {
  const { data: agents, isLoading, error } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.getAgents(),
  });

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-foreground">Agents & Test Cases</h1>
        <Link
          to="/agents/new"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + New Agent
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-8">Select an agent to view and run its test cases.</p>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
          {(error as Error).message}
        </div>
      )}

      {agents && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Box className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">No agents yet. Create one to get started.</p>
        </div>
      )}

      {agents && agents.length > 0 && (
        <div className="border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{agent.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{agent.id}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/agents/${agent.id}/test-cases`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      View Test Cases
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
