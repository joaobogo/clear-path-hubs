import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useConfirmAction } from "@/components/ds";
import { deletePool, type TalentPoolDTO } from "@/lib/talent-pool.functions";

export function DeletePoolButton({
  orgId,
  pool,
  onDeleted,
}: {
  orgId: string;
  pool: TalentPoolDTO;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const delFn = useServerFn(deletePool);
  const del = useMutation({
    mutationFn: () => delFn({ data: { orgId, id: pool.id } }),
    onSuccess: () => {
      toast.success(`Pool "${pool.name}" deleted`);
      qc.invalidateQueries({ queryKey: ["talent-pool", "pools", orgId] });
      onDeleted();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { confirm, confirmDialog } = useConfirmAction();
  return (
    <>
      <button
        type="button"
        disabled={del.isPending}
        aria-busy={del.isPending || undefined}
        onClick={async () => {
          const r = await confirm({
            title: "Delete pool",
            object: pool.name,
            description: "The pool disappears from your workspace.",
            impact: [
              "Candidates are not removed — they stay in other pools",
              "Anyone in your workspace loses this saved grouping",
            ],
            confirmLabel: "Delete pool",
            tone: "destructive",
          });
          if (r.confirmed) del.mutate();
        }}
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-60"
      >
        <Trash2 className="h-3 w-3" /> {del.isPending ? "Deleting…" : "Delete pool"}
      </button>
      {confirmDialog}
    </>
  );
}
