import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  planBulkAssign,
  planBulkStageMove,
  runBulkAssign,
  runBulkStageMove,
  runBulkUpdateMessage,
} from "@/lib/admin-workbench.functions";
import { BULK_STAGES } from "@/lib/admin-bulk-constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Mode = null | "stage" | "assign" | "update";

const STAGE_LABEL: Record<string, string> = {
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview_process: "Interviewing",
  offer: "Offer",
  not_moving_forward: "Not moving forward",
};

export function BulkOpsBar({
  matchIds,
  candidateProfileIds,
  positions,
  onDone,
}: {
  matchIds: string[];
  candidateProfileIds: string[];
  positions: Array<{ id: string; title: string }>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [stage, setStage] = useState<(typeof BULK_STAGES)[number]>("shortlisted");
  const [positionId, setPositionId] = useState<string>(positions[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [plan, setPlan] = useState<{ eligible: number; skipped: number; rows: Array<{ reason?: string }> } | null>(null);

  const planStage = useServerFn(planBulkStageMove);
  const runStage = useServerFn(runBulkStageMove);
  const planAssignFn = useServerFn(planBulkAssign);
  const runAssignFn = useServerFn(runBulkAssign);
  const runUpdate = useServerFn(runBulkUpdateMessage);

  const skipReasons = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of plan?.rows ?? []) if (r.reason) counts[r.reason] = (counts[r.reason] ?? 0) + 1;
    return Object.entries(counts);
  }, [plan]);

  async function openStage() {
    const p = await planStage({ data: { matchIds, toStage: stage } });
    setPlan(p);
    setMode("stage");
  }
  async function openAssign() {
    if (!positionId) return toast.error("Pick a role first");
    const p = await planAssignFn({ data: { candidateProfileIds, positionId } });
    setPlan(p);
    setMode("assign");
  }

  const commit = useMutation({
    mutationFn: async () => {
      if (mode === "stage") return runStage({ data: { matchIds, toStage: stage } });
      if (mode === "assign") return runAssignFn({ data: { candidateProfileIds, positionId } });
      return runUpdate({ data: { matchIds, message } });
    },
    onSuccess: async (r: any) => {
      toast.success(`${r.changed} record(s) changed${r.skipped ? `, ${r.skipped} skipped` : ""}`);
      setMode(null);
      setPlan(null);
      setMessage("");
      await qc.invalidateQueries();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="text-sm font-medium">Bulk actions</span>
        <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
          <SelectTrigger className="h-8 w-44" aria-label="Target stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BULK_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={openStage}>
          Move stage
        </Button>

        <Select value={positionId} onValueChange={setPositionId}>
          <SelectTrigger className="h-8 w-56" aria-label="Assign to role">
            <SelectValue placeholder="Assign to role…" />
          </SelectTrigger>
          <SelectContent>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={openAssign}
          disabled={candidateProfileIds.length === 0}
        >
          Assign
        </Button>

        <Button size="sm" variant="outline" onClick={() => setMode("update")}>
          Send update
        </Button>
      </div>

      <AlertDialog open={mode !== null} onOpenChange={(o) => (!o ? setMode(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mode === "stage"
                ? `Move ${plan?.eligible ?? 0} candidate(s) to ${STAGE_LABEL[stage]}`
                : mode === "assign"
                  ? `Assign ${plan?.eligible ?? 0} candidate(s) to this role`
                  : `Send an update about ${matchIds.length} candidate(s)`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {mode === "update" ? (
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="What should the client team know?"
                    aria-label="Update message"
                  />
                ) : (
                  <>
                    <p>
                      <strong>{plan?.eligible ?? 0}</strong> record(s) will change.{" "}
                      <strong>{plan?.skipped ?? 0}</strong> will be skipped.
                    </p>
                    {skipReasons.length > 0 ? (
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {skipReasons.map(([reason, count]) => (
                          <li key={reason}>
                            {count} × {reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                commit.isPending ||
                (mode === "update" ? message.trim().length < 5 : (plan?.eligible ?? 0) === 0)
              }
              onClick={(e) => {
                e.preventDefault();
                commit.mutate();
              }}
            >
              {commit.isPending ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
