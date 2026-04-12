import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, type Agent, type AgentVersion } from "@/lib/api";
import { StatusBadge, TagBadge } from "@/components/ui-shared";
import { Box, Loader2, Shield, Target, Lock, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AgentWithVersion {
  agent: Agent;
  latestVersion: AgentVersion | null;
}

export default function TestCaseAgentList() {
  const [agents, setAgents] = useState<AgentWithVersion[]>([]);
  const [allTestCases, setAllTestCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const agentList = await api.getAgents();
      const agentsWithVersions: AgentWithVersion[] = [];
      const cases: any[] = [];

      await Promise.all(
        agentList.map(async (agent) => {
          let latestVersion: AgentVersion | null = null;
          let agentCases: any[] = [];
          try {
            const versions = await api.getAgentVersions(agent.id);
            if (versions.length > 0) {
              latestVersion = versions.reduce((a, b) => a.version_number > b.version_number ? a : b);
              agentCases = await api.getTestCasesV2(agent.id, latestVersion.id);
            } else {
              agentCases = await api.getTestCases(agent.id);
            }
          } catch {
            try {
              agentCases = await api.getTestCases(agent.id);
            } catch {}
          }
          agentsWithVersions.push({ agent, latestVersion });
          cases.push(...agentCases.map((tc: any) => ({ ...tc, _agent_name: agent.name, _agent_id: agent.id })));
        })
      );

      setAgents(agentsWithVersions);
      setAllTestCases(cases);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = selectedAgentId === "all"
    ? allTestCases
    : allTestCases.filter((tc) => tc._agent_id === selectedAgentId || tc.agent_id === selectedAgentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">Test Cases</h1>
          <p className="text-sm text-muted-foreground">
            {filteredCases.length} test case{filteredCases.length !== 1 ? "s" : ""}{selectedAgentId !== "all" ? " (filtered)" : " across all agents"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map(({ agent }) => (
                <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm rounded mb-4">
          {error}
        </div>
      )}

      {filteredCases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Box className="w-8 h-8 mb-3 opacity-40" />
          <p className="text-sm">No test cases found.</p>
        </div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Agent</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Scenario</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tags</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground w-24">Lock</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((tc) => (
                <tr key={tc.id} className="border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{tc._agent_name}</td>
                  <td className="px-3 py-2.5 text-foreground max-w-[280px]">
                    <span className="block truncate" title={tc.scenario}>
                      {tc.scenario?.length > 50 ? tc.scenario.slice(0, 50) + "…" : tc.scenario}
                    </span>
                    {tc.obligation_ids?.length > 0 && (
                      <span className="text-xs text-muted-foreground/60">{tc.obligation_ids.length} obligations</span>
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
                    {tc.locked ? (
                      tc.locked_at_pass ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                          <Shield className="w-3.5 h-3.5" />
                          Protected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400">
                          <Target className="w-3.5 h-3.5" />
                          Tracking
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      to={`/agents/${tc._agent_id || tc.agent_id}/test-cases`}
                      className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      View →
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
