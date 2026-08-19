import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { updateTask, deleteTask, TASK_TYPE_LABELS, type TaskRow } from "@/lib/tasks.functions";
import { useConfirmAction } from "@/components/ds/confirm-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Circle, Trash2, Clock, ShieldAlert } from "lucide-react";
import { relTime } from "./utils";
import { toastError } from "@/lib/toast-error";

export function ApprovalRowItem({
  task,
  onChange,
  selected,
  onToggleSelect,
}: {
  task: TaskRow;
  onChange: () => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const update = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const { confirm, confirmDialog } = useConfirmAction();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidence, setEvidence] = useState(task.completion_evidence ?? "");

  const complete = useMutation({
    mutationFn: () =>
      update({
        data: {
          id: task.id,
          status: "done",
          completion_evidence: evidence.trim() || null,
        },
      }),
    onSuccess: () => {
      setEvidenceOpen(false);
      onChange();
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't complete. Nothing was saved — please try again." }),
  });
  const reopen = useMutation({
    mutationFn: () => update({ data: { id: task.id, status: "open" } }),
    onSuccess: onChange,
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't reopen. Nothing was saved — please try again." }),
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: task.id } }),
    onSuccess: onChange,
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't remove. Nothing was saved — please try again." }),
  });

  const overdue =
    task.due_at && task.status !== "done" && new Date(task.due_at) < new Date();
  const done = task.status === "done";
  const requiresEvidence =
    task.task_type === "role_brief_approval" ||
    task.task_type === "rubric_approval" ||
    task.task_type === "offer_decision" ||
    task.task_type === "feedback_submission";

  // Icon-only controls name both the action and its subject, e.g.
  // "Approve Maria Santos for Front Desk Lead". Playwright selects on these.
  const subject = [task.candidate_name, task.position_title]
    .filter(Boolean)
    .join(" for ");
  const label = subject ? `${task.title} — ${subject}` : task.title;

  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm md:flex-row md:items-start">
      <div className="flex items-start gap-3 md:contents">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggleSelect}
        className="mt-1 shrink-0"
        aria-label={`Select ${label}`}
      />
      <button
        type="button"
        onClick={() => {
          if (done) reopen.mutate();
          else if (requiresEvidence) setEvidenceOpen(true);
          else complete.mutate();
        }}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={done ? `Reopen ${label}` : `Approve ${label}`}
      >
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`min-w-0 truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}
          >
            {task.title}
          </div>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {TASK_TYPE_LABELS[task.task_type]}
          </span>
          {task.blocking && (
            <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
              <ShieldAlert className="h-3 w-3" /> Blocking
            </span>
          )}
        </div>
        {task.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </div>
        )}
        {done && task.completion_evidence && (
          <div className="mt-1 rounded border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] text-foreground">
            <span className="font-medium">Evidence:</span> {task.completion_evidence}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {task.priority !== "normal" && (
            <span
              className={`rounded px-1.5 py-0.5 uppercase tracking-wide ${
                task.priority === "urgent"
                  ? "bg-destructive/10 text-destructive"
                  : task.priority === "high"
                    ? "bg-warning/10 text-warning-strong"
                    : "bg-muted"
              }`}
            >
              {task.priority}
            </span>
          )}
          {task.due_at && (
            <span
              className={`inline-flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}
            >
              <Clock className="h-3 w-3" />
              {overdue ? "Overdue · " : ""}
              {relTime(task.due_at)}
            </span>
          )}
          {task.position_title && task.position_id && (
            <Link
              to="/client/positions/$id"
              params={{ id: task.position_id }}
              className="hover:underline"
            >
              {task.position_title}
            </Link>
          )}
          {task.candidate_name && task.candidate_match_id && (
            <Link
              to="/client/candidates/$id"
              params={{ id: task.candidate_match_id }}
              className="hover:underline"
            >
              {task.candidate_name}
            </Link>
          )}
          {task.approved_version_hash && (
            <span className="rounded bg-muted px-1.5 py-0.5" title="Version approved">
              v · {task.approved_version_hash.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={async () => {
          const res = await confirm({
            title: "Delete approval",
            object: task.title,
            description: "This will remove the approval task permanently. It will not be visible on the role or candidate journey.",
            tone: "destructive",
            confirmLabel: "Delete",
          });
          if (res.confirmed) remove.mutate();
        }}
        className="self-start shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        aria-label={`Delete ${label}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete: {task.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ev">
              Evidence or comment {requiresEvidence && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="ev"
              rows={4}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="e.g. Approved the requirements — signed off by the hiring manager on the 2pm call."
            />
            <p className="text-xs text-muted-foreground">
              This is recorded on the task's activity history and stays traceable.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEvidenceOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={complete.isPending || (requiresEvidence && !evidence.trim())}
              onClick={() => complete.mutate()}
            >
              {complete.isPending ? "Saving…" : "Complete task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </li>
  );
}
