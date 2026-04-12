import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

const LAST_AGENT_KEY = "agentops:last-agent-id";

export function AppSidebar() {
  const location = useLocation();
  const path = location.pathname;
  const [fallbackAgentId, setFallbackAgentId] = useState<string | null>(null);

  // Extract agentId from URL if on an agent-scoped page
  const agentMatch = path.match(/^\/agents\/([^/]+)/);
  const agentId =
    agentMatch && agentMatch[1] !== "new" && agentMatch[1] !== "undefined" ? agentMatch[1] : null;
  
  // Also extract agentId from test-case detail routes like /agents/{id}/test-cases/{tcId}
  const testCaseDetailMatch = path.match(/^\/agents\/([^/]+)\/test-cases\/[^/]+/);
  const storedAgentId = typeof window !== "undefined" ? localStorage.getItem(LAST_AGENT_KEY) : null;
  const contextAgentId = testCaseDetailMatch ? testCaseDetailMatch[1] : agentId ?? storedAgentId ?? fallbackAgentId;

  useEffect(() => {
    if (!agentId) return;
    localStorage.setItem(LAST_AGENT_KEY, agentId);
  }, [agentId]);

  // Fetch first agent as fallback when no context exists
  useEffect(() => {
    if (contextAgentId) return;
    api.getAgents()
      .then((agents) => {
        if (agents.length > 0) {
          setFallbackAgentId(agents[0].id);
          localStorage.setItem(LAST_AGENT_KEY, agents[0].id);
        }
      })
      .catch(() => {});
  }, [contextAgentId]);

  const navItems = [
    {
      label: "Agents",
      path: "/agents",
      icon: Box,
      active: path === "/agents" || path === "/agents/new" || (!!agentMatch && !path.includes("/test-cases")),
    },
    {
      label: "Regression",
      path: "/regression",
      icon: ShieldCheck,
      active: path.startsWith("/regression"),
    },
  ];

  return (
    <aside className="w-[220px] shrink-0 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5">
        <Link to="/agents" className="flex items-center gap-0">
          <span className="text-foreground font-bold text-base tracking-tight">AgentOps</span>
          <span className="text-primary text-lg leading-none ml-[1px] -mt-1 font-bold">.</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className={`flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors relative ${
              item.active
                ? "bg-muted/60 text-foreground font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-primary before:rounded-r"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground">Phase 1 build</p>
      </div>
    </aside>
  );
}
