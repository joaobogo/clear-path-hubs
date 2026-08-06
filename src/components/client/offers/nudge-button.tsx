import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nudgeOffer, type HireRecordDTO } from "@/lib/hires.functions";

export function NudgeButton({ orgId, hire }: { orgId: string; hire: HireRecordDTO }) {
  const qc = useQueryClient();
  const nudgeFn = useServerFn(nudgeOffer);
  const nudge = useMutation({
    mutationFn: () => nudgeFn({ data: { orgId, id: hire.id } }),
    onSuccess: () => {
      toast.success(`Nudge sent to ${hire.owner_name ?? "the offer owner"}`, {
        description: "We'll chase the candidate and update this record.",
      });
      qc.invalidateQueries({ queryKey: ["hires", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1 text-[11px]"
      disabled={nudge.isPending}
      onClick={() => nudge.mutate()}
    >
      <BellRing className="h-3 w-3" />
      {nudge.isPending ? "Nudging…" : "Nudge"}
    </Button>
  );
}
