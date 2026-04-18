import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { FileJson } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";

interface Props {
  agentId: string;
  versionId: string;
}

export default function SchemaPanel({ agentId, versionId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const versionsQ = useQuery({
    queryKey: ["agent", agentId, "versions"],
    queryFn: () => api.getAgentVersions(agentId),
  });

  const schemaQ = useQuery({
    queryKey: ["agent", agentId, "schema"],
    queryFn: () => api.getSchema(agentId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });

  const extractMut = useMutation({
    mutationFn: () => api.extractSchema(agentId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent", agentId, "schema"] });
      toast({ title: "Schema extracted" });
    },
    onError: (err: Error) => {
      toast({
        title: "Extraction failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (schemaQ.isLoading) {
    return <Skeleton className="h-[60vh] w-full" />;
  }

  if (schemaQ.error instanceof ApiError && schemaQ.error.status === 404) {
    return (
      <EmptyState
        icon={FileJson}
        title="No schema yet"
        description="Extract a schema from this version's prompt and tool definitions."
        action={
          <Button onClick={() => extractMut.mutate()} disabled={extractMut.isPending}>
            {extractMut.isPending ? "Extracting…" : "Extract schema"}
          </Button>
        }
      />
    );
  }

  if (schemaQ.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>{(schemaQ.error as Error).message}</span>
          <Button variant="ghost" size="sm" onClick={() => schemaQ.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const schema = schemaQ.data!;
  const extractedFromVersion = versionsQ.data?.find(
    (v) => v.id === schema.extracted_from_version_id,
  );
  const showExtractedBadge = schema.extracted_from_version_id !== versionId;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {schema.human_edited && <Badge variant="secondary">Edited by human</Badge>}
        {showExtractedBadge && (
          <Badge variant="outline">
            Extracted from{" "}
            {extractedFromVersion
              ? `v${extractedFromVersion.version_number}`
              : "another version"}
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[60vh] rounded-md border bg-muted/20 p-3">
        <pre className="text-[11px]">
          <code>{JSON.stringify(schema.schema_json, null, 2)}</code>
        </pre>
      </ScrollArea>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button variant="outline" size="sm" disabled>
              Edit schema
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Editing requires a backend PATCH endpoint — coming soon.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
