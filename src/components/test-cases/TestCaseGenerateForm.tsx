import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";

interface Props {
  agentId: string;
  versionId: string;
}

export function TestCaseGenerateForm({ agentId, versionId }: Props) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [count, setCount] = useState(15);
  const [elapsedSec, setElapsedSec] = useState(0);

  const contractQ = useQuery({
    queryKey: ["agent", agentId, "version", versionId, "contract"],
    queryFn: () => api.getContractV2(agentId, versionId),
    retry: (n, err) =>
      !(err instanceof ApiError && err.status === 404) && n < 2,
  });

  const existingQ = useQuery({
    queryKey: ["agent", agentId, "version", versionId, "test-cases"],
    queryFn: () => api.getTestCasesV2(agentId, versionId),
  });

  const mutation = useMutation({
    mutationFn: () => api.generateTestCasesV2(agentId, versionId, count),
    onSuccess: (resp) => {
      qc.invalidateQueries({
        queryKey: ["agent", agentId, "version", versionId, "test-cases"],
      });
      toast({ title: `Generated ${resp.count} test cases` });
      nav(-1);
    },
    onError: (err: Error) => {
      toast({
        title: "Generation failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!mutation.isPending) {
      setElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [mutation.isPending]);

  const noContract =
    contractQ.error instanceof ApiError && contractQ.error.status === 404;
  const existingCount = existingQ.data?.length ?? 0;
  const showLongWaitCopy = mutation.isPending && elapsedSec >= 45;

  return (
    <div className="space-y-5 max-w-xl">
      {noContract && (
        <Alert variant="destructive">
          <AlertDescription>
            No contract found for this version.{" "}
            <Link to={`/agents/${agentId}`} className="underline">
              Generate a contract first
            </Link>
            , then come back here.
          </AlertDescription>
        </Alert>
      )}

      {existingCount > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            This will{" "}
            <strong>
              delete the {existingCount} existing test case
              {existingCount === 1 ? "" : "s"}
            </strong>{" "}
            for this version and replace them with newly generated ones. Locked
            status is lost. This cannot be undone.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="count">How many test cases?</Label>
        <div className="flex items-center gap-3">
          <Slider
            id="count"
            min={1}
            max={20}
            step={1}
            value={[count]}
            onValueChange={(v) => setCount(v[0])}
            disabled={mutation.isPending}
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!isNaN(n)) setCount(Math.min(20, Math.max(1, n)));
            }}
            disabled={mutation.isPending}
            className="w-20"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Backend cap is 20. Generation typically takes 30-60 seconds. Cannot be
          cancelled once started.
        </p>
      </div>

      {mutation.isPending && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Generating test cases… don't close this tab.</span>
            <span className="font-mono">{elapsedSec}s</span>
          </div>
          <Progress value={undefined} className="h-1.5" />
          {showLongWaitCopy && (
            <p className="text-[11px] text-muted-foreground">
              Still working… large runs can take up to 90 seconds.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || noContract}
        >
          {mutation.isPending
            ? "Generating…"
            : `Generate ${count} test case${count === 1 ? "" : "s"}`}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => nav(-1)}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
