import { useState, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";

interface Props {
  agentId: string;
  versionId: string;
  trigger: ReactNode;
  onSuccess?: () => void;
}

export function RegenerateContractDialog({ agentId, versionId, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => api.regenerateContract(agentId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["agent", agentId, "version", versionId, "contract"],
      });
      qc.invalidateQueries({ queryKey: ["agent", agentId] });
      toast({ title: "Contract regenerated" });
      setOpen(false);
      onSuccess?.();
    },
    onError: (err: Error) => {
      const isNoSchema =
        err instanceof ApiError && err.status === 404 && /schema/i.test(err.message);
      toast({
        title: "Regeneration failed",
        description: isNoSchema
          ? "Extract a schema from this version first (Schema button)."
          : err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate this contract?</AlertDialogTitle>
          <AlertDialogDescription>
            Existing test cases may need to be re-evaluated against the new contract.
            Locked test cases stay locked, but their pass/fail outcomes can change. This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Regenerating…" : "Regenerate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
