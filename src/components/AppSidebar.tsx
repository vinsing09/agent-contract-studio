import { Link, useLocation } from "react-router-dom";
import { Upload, List, FlaskConical, BarChart3, Settings } from "lucide-react";

const navItems = [
  { label: "Upload Agent", path: "/agents/new", icon: Upload },
  { label: "Agents", path: "/agents", icon: List },
  { label: "Test Cases", path: "/test-cases", icon: FlaskConical },
  { label: "Eval Runs", path: "/eval-runs", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xs font-mono">AO</span>
          </div>
          <span className="text-foreground font-semibold text-sm tracking-tight">AgentOps</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-muted-foreground font-mono">v0.1.0-alpha</p>
      </div>
    </aside>
  );
}
