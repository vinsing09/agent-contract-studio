import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import SchemaPanel from "@/components/schema/SchemaPanel";

export default function AgentSchema() {
  const { agentId, versionId } = useParams();
  const versionsQ = useQuery({
    queryKey: ["agent", agentId, "versions"],
    queryFn: () => api.getAgentVersions(agentId!),
    enabled: !!agentId,
  });

  if (!agentId || !versionId) return null;

  const version = versionsQ.data?.find((v) => v.id === versionId);
  const heading = version ? `Schema — v${version.version_number}` : "Schema";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="mb-3">
        <Link to={`/agents/${agentId}`}>
          <ChevronLeft className="w-4 h-4" />
          Back to agent
        </Link>
      </Button>
      <h1 className="text-lg font-semibold mb-4">{heading}</h1>
      <SchemaPanel agentId={agentId} versionId={versionId} />
    </div>
  );
}
