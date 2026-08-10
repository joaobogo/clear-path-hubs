/**
 * Candidate next-action bar.
 *
 * States the single next step for this candidate, who owes it, how long it has
 * been waiting, and the one action that moves it forward. When the records
 * contradict the stage, the ambiguity is stated instead of guessed away.
 *
 * No AI recommendation, no confidence score.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { AlertTriangle, ArrowRight, Clock, UserCog, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCandidateNextAction,
  reassignCandidateNextStep,
  addCandidateBlockingNote,
} from "@/lib/candidate-next-action.functions";
import { listOwnershipStaff } from "@/lib/position-ownership.functions";
import { ownerLabel, waitingFor, type OwnerSide } from "@/lib/candidate-next-action";
import { applyReviewDecision } from "@/lib/processing.functions";
import { setMatchClientVisibility } from "@/lib/admin.functions";

const OWNER_TONE: Record<OwnerSide, string> = {
  us: "bg-primary/10 text-primary",
  client: "bg-info/15 text-info",
  candidate: "bg-info/15 text-info",
  system: "bg-muted text-muted-foreground",
  none: "bg-muted text-muted-foreground",
  unclear: "bg-warning/15 text-warning-foreground",
};

export function CandidateNextActionBar({
  matchId,
  onNavigateTab,
}: {
  matchId: string;
  onNavigateTab: (tab: string) => void;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getCandidateNextAction);
  const reassignFn = useServerFn(reassignCandidateNextStep);
  const blockFn = useServerFn(addCandidateBlockingNote);
  const approveFn = useServerFn(applyReviewDecision);
  const publishFn = useServerFn(setMatchClientVisibility);

  const [panel, setPanel] = React.useState<"none" | "reassign" | "block">("none");
  const [assignee, setAssignee] = React.useState<string>("");
  const [noteBody, setNoteBody] = React.useState("");

  const query = useQuery({
    queryKey: ["candidate-next-action", matchId],
    queryFn: () => load({ data: { match_id: matchId } }),
  });

  const staff = useQuery({
    queryKey: ["ownership-staff"],
    queryFn: () => listOwnershipStaff(),
    enabled: panel === "reassign",
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["candidate-next-action", matchId] });
    await qc.invalidateQueries({ queryKey: ["admin-candidate", matchId] });
  };

  const perform = useMutation({
    mutationFn: async () => {
      const action = query.data?.action;
      if (!action) return;
      if (action.action.kind === "navigate") {
        onNavigateTab(action.action.tab);
        return;
      }
      if (action.action.kind === "approve_score") {
        await approveFn({ data: { match_id: matchId, action: "approve_for_client" } });
        return;
      }
      if (action.action.kind === "publish_to_client") {
        await publishFn({ data: { match_id: matchId, visibility: "visible" } });
        return;
      }
      if (action.action.kind === "follow_up") {
        setPanel("reassign");
      }
    },
    onSuccess: async () => {
      await refresh();
    },
    onError: (e: Error) => toastError(e),
  });

  const reassign = useMutation({
    mutationFn: async () => {
      const action = query.data?.action;
      if (!action) return;
      const followUp = action.action.kind === "follow_up" ? action.action : null;
      return reassignFn({
        data: {
          match_id: matchId,
          assignee_user_id: assignee || null,
          step: action.step,
          task_type: followUp?.taskType ?? "general_follow_up",
          title: followUp?.title ?? action.step_label,
          note: null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Next step assigned");
      setPanel("none");
      await refresh();
    },
    onError: (e: Error) => toastError(e),
  });

  const block = useMutation({
    mutationFn: () => blockFn({ data: { match_id: matchId, body: noteBody } }),
    onSuccess: async () => {
      toast.success("Blocking note added");
      setPanel("none");
      setNoteBody("");
      await refresh();
    },
    onError: (e: Error) => toastError(e),
  });

  const payload = query.data;

  const a = payload!.action;
  const wait = waitingFor(a.waiting_since);
  const task = payload!.step_task;
  const isBlocked = Boolean(task?.blocking);
  const noAction = a.action.kind === "none";

  return (
    <PanelState query={query} isEmpty={!payload} empty={<PanelEmpty title="No action required" />}>
    <section
      data-qa="next-action-bar"
      data-qa-step={a.step}
      aria-label="Next action"
      className={
        "rounded-lg border p-4 space-y-3 " +
        (a.owner === "unclear"
          ? "border-warning/50 bg-warning/5"
          : isBlocked
            ? "border-destructive/40 bg-destructive/5"
            : "bg-card")
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="capitalize">
          {String(a.stage).replace(/_/g, " ")}
        </Badge>
        <span
          className={"rounded-full px-2 py-0.5 text-xs font-medium " + OWNER_TONE[a.owner]}
          data-qa="next-action-owner"
        >
          {a.owner === "none" ? "Nobody waiting" : `Owner: ${ownerLabel(a.owner)}`}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" data-qa="next-action-step">
            {noAction ? "No action required" : a.step_label}
          </p>
          <p className="text-xs text-muted-foreground">{a.because}</p>
        </div>

        {wait && !noAction ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            waiting {wait}
          </span>
        ) : null}

        {!noAction && a.action_label ? (
          <Button
            size="sm"
            data-qa-action="next-action-primary"
            disabled={perform.isPending}
            onClick={() => perform.mutate()}
          >
            {a.action_label}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        ) : null}

        {!noAction ? (
          <>
            <Button
              size="sm"
              variant="outline"
              data-qa-action="next-action-reassign"
              onClick={() => setPanel(panel === "reassign" ? "none" : "reassign")}
            >
              <UserCog className="mr-1.5 h-3.5 w-3.5" />
              Reassign step
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-qa-action="next-action-block"
              onClick={() => setPanel(panel === "block" ? "none" : "block")}
            >
              <Ban className="mr-1.5 h-3.5 w-3.5" />
              Blocking note
            </Button>
          </>
        ) : null}
      </div>

      {a.ambiguity ? (
        <p
          data-qa="next-action-ambiguity"
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{a.ambiguity}</span>
        </p>
      ) : null}

      {task ? (
        <p className="text-xs text-muted-foreground">
          {isBlocked ? "Blocked · " : ""}Step owned by {task.assignee_name ?? "unassigned"} ·{" "}
          {task.title}
        </p>
      ) : null}

      {panel === "reassign" ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-64" data-qa-action="next-action-assignee">
              <SelectValue placeholder="Assign this step to…" />
            </SelectTrigger>
            <SelectContent>
              {(staff.data ?? []).map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.name}
                  {s.is_active ? "" : " (inactive)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!assignee || reassign.isPending}
            onClick={() => reassign.mutate()}
            data-qa-action="next-action-reassign-save"
          >
            Save assignment
          </Button>
          {staff.isError ? (
            <span className="text-xs text-destructive">Could not load staff list.</span>
          ) : null}
        </div>
      ) : null}

      {panel === "block" ? (
        <div className="space-y-2 border-t pt-3">
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="What is blocking this step?"
            rows={3}
            data-qa-action="next-action-block-body"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={noteBody.trim().length < 4 || block.isPending}
            onClick={() => block.mutate()}
            data-qa-action="next-action-block-save"
          >
            Add blocking note
          </Button>
        </div>
      ) : null}
    </section>
    </PanelState>
  );
}