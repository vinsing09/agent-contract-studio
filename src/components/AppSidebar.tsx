import { Link, useLocation } from "react-router-dom";
import { Box, ListChecks, PlayCircle, ShieldCheck } from "lucide-react";

const navItems = [
  { label: "Agents", path: "/agents/new", icon: Box, matchPaths: ["/agents/new"] },
  { label: "Test Cases", path: "/agents", icon: ListChecks, matchPaths: ["/agents"] },
  { label: "Eval Runs", path: "/eval-runs", icon: PlayCircle, matchPaths: ["/eval-runs"] },
  { label: "Regression", path: "/regression", icon: ShieldCheck, matchPaths: ["/regression"] },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="w-[220px] shrink-0 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5">
        <Link to="/agents/new" className="flex items-center gap-0">
          <span className="text-foreground font-bold text-base tracking-tight">
            AgentOps
          </span>
          <span className="text-primary text-lg leading-none ml-[1px] -mt-1 font-bold">.</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.label === "Test Cases"
              ? location.pathname === "/agents" || location.pathname.match(/^\/agents\/[^/]+\/test-cases/)
              : item.label === "Agents"
                ? location.pathname === "/agents/new"
                : location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors relative ${
                active
                  ? "bg-muted/60 text-foreground font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-primary before:rounded-r"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground">Phase 1 build</p>
      </div>
    </aside>
  );
}
