import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPositionStageAging,
  moveCandidateStage,
} from "@/lib/admin-stage-aging.functions";
import {
  PIPELINE_STAGES,
  TERMINAL_STAGES,
  stageLabel,
  type PipelineStage,
} from "@/lib/stage-aging";
import type { AgingCandidate } from "@/lib/admin-stage-aging.server";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";

export function StageAgingPanel({ positionId }: { positionId: string }) {
  const qc = useQueryClient();
  const fetchAging = useServerFn(getPositionStageAging);
  const moveStage = useServerFn(moveCandidateStage);
  const [stageFilter, setStageFilter] = useState<PipelineStage | null>(null);
  const [moving, setMoving] = useState<AgingCandidate | null>(null);
  const [toStage, setToStage] = useState<PipelineStage | "">("");
  const [reason, setReason] = useState("");

  const queryKey = ["admin-position-stage-aging", positionId];
  const q = useQuery({
    queryKey,
    queryFn: () => fetchAging({ data: { position_id: positionId } }),
  });

  const move = useMutation({
    mutationFn: (input: { match_id: string; to_stage: PipelineStage; reason: string }) =>
      moveStage({ data: input }),
    onSuccess: (_r, input) => {
      toast.success(`Moved to ${stageLabel(input.to_stage)} — days in stage reset.`);
      setMoving(null);
      setReason("");
      setToStage("");
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["admin-position", positionId] });
    },
    onError: (e: unknown) =>
      toastError(e, { fallback: "Could not move the candidate." }),
  });

  const rows = useMemo(() => {
    const all = q.data?.candidates ?? [];
    return stageFilter ? all.filter((c) => c.stage === stageFilter) : all;
  }, [q.data, stageFilter]);

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Stage aging</h3>
          <p className="text-xs text-muted-foreground">
            Days in stage measured from the latest stage-history entry for each candidate.
          </p>
        </div>
        {stageFilter && (
          <Button variant="outline" size="sm" onClick={() => setStageFilter(null)}>
            Clear stage filter
          </Button>
        )}
      </header>

      <PanelState
        query={q}
        isEmpty={(q.data?.total_in_pipeline ?? 0) === 0}
        empty={<PanelEmpty className="m-4" title="No candidates in pipeline yet." />}
        skeletonRows={4}
      >
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {(q.data?.buckets ?? [])
              .filter((b) => b.count > 0)
              .map((b) => {
                const selected = stageFilter === b.stage;
                return (
                  <button
                    key={b.stage}
                    type="button"
                    onClick={() => setStageFilter(selected ? null : b.stage)}
                    aria-pressed={selected}
                    className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                      selected ? "border-primary bg-muted/40" : ""
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {stageLabel(b.stage)}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-semibold tabular-nums">{b.count}</span>
                      <span className="text-[11px] text-muted-foreground">
                        of {q.data?.total_in_pipeline} in pipeline
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {b.threshold_days != null
                        ? `Threshold ${b.threshold_days}d · ${b.aging_count} over`
                        : "No threshold"}
                    </div>
                    {b.oldest && (
                      <div className="mt-1 truncate text-[11px] text-muted-foreground">
                        Oldest: {b.oldest.candidate_name} · {b.oldest.days_in_stage}d
                      </div>
                    )}
                  </button>
                );
              })}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Candidate</th>
                  <th className="px-3 py-2 font-medium">Current stage</th>
                  <th className="px-3 py-2 font-medium tabular-nums">Days in stage</th>
                  <th className="px-3 py-2 font-medium">Previous stage</th>
                  <th className="px-3 py-2 font-medium">Moved by</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.match_id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{c.candidate_name}</td>
                    <td className="px-3 py-2 text-xs">{stageLabel(c.stage)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {c.days_in_stage}d
                        {c.aging && (
                          <Badge variant="outline" className="border-warning/50 text-warning">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            over {c.threshold_days}d
                          </Badge>
                        )}
                      </span>
                      {c.basis === "match_created" && (
                        <div className="text-[10px] text-muted-foreground">
                          no stage history · counted from application
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.previous_stage ? stageLabel(c.previous_stage) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.moved_by ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMoving(c);
                            setToStage("");
                            setReason("");
                          }}
                        >
                          <Clock className="mr-1.5 h-3.5 w-3.5" /> Move stage
                        </Button>
                        <Link
                          to="/admin/candidates/$id"
                          params={{ id: c.match_id }}
                          className="text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No candidates in {stageLabel(stageFilter)}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PanelState>

      <Dialog open={moving != null} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move stage</DialogTitle>
            <DialogDescription>
              {moving
                ? `${moving.candidate_name} · currently ${stageLabel(moving.stage)} for ${moving.days_in_stage}d.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="aging-to-stage">New stage</Label>
              <Select value={toStage} onValueChange={(v) => setToStage(v as PipelineStage)}>
                <SelectTrigger id="aging-to-stage">
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.filter((s) => s !== moving?.stage).map((s) => (
                    <SelectItem key={s} value={s}>
                      {stageLabel(s)}
                      {TERMINAL_STAGES.includes(s) ? " (closes pipeline)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aging-reason">
                Reason <span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="aging-reason"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this candidate moving? Recorded in stage history."
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters. Stored on the stage-history row.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button
              disabled={!toStage || reason.trim().length < 10 || move.isPending}
              onClick={() => {
                if (!moving || !toStage) return;
                move.mutate({
                  match_id: moving.match_id,
                  to_stage: toStage,
                  reason: reason.trim(),
                });
              }}
            >
              {move.isPending ? "Moving…" : "Move and record reason"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
