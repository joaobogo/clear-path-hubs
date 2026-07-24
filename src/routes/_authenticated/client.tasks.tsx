import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  type TaskRow,
} from "@/lib/tasks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, CheckCircle2, Circle, Trash2, Clock, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks & Approvals · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TasksPage,
});

type StatusFilter = "open" | "in_progress" | "done" | "all";
type AssigneeFilter = "me" | "any";

function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const min = 60_000,
    hr = 60 * min,
    day = 24 * hr;
  if (abs < hr) return rt.format(Math.round(diff / min), "minute");
  if (abs < day) return rt.format(Math.round(diff / hr), "hour");
  if (abs < 30 * day) return rt.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TasksPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listTasks);
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [assignee, setAssignee] = useState<AssigneeFilter>("any");

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctxQuery.data?.active?.organization_id ?? null;

  const tasks = useQuery({
    queryKey: ["client", "tasks", orgId, status, assignee],
    queryFn: () =>
      listFn({ data: { organization_id: orgId!, status, assignee } }),
    enabled: !!orgId,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["client", "tasks", orgId] });

  if (!orgId) {
    return <div className="text-sm text-muted-foreground">No workspace selected.</div>;
  }

  const rows = tasks.data ?? [];
  const overdue = rows.filter(
    (t) => t.due_at && new Date(t.due_at) < new Date() && t.status !== "done",
  );

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">Tasks & Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Every next action for this workspace in one inbox.
          </p>
        </div>
        <NewTaskDialog orgId={orgId} onCreated={invalidate} />
      </header>

      {overdue.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-medium">
              {overdue.length} task{overdue.length === 1 ? "" : "s"} overdue
            </div>
            <div className="text-muted-foreground">
              These need attention before new work.
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={(v) => setAssignee(v as AssigneeFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Anyone</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tasks.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          <div className="mb-1 font-medium text-foreground">No tasks in this view.</div>
          Add a task to keep track of the next action for a role or candidate.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <TaskRowItem key={t.id} task={t} onChange={invalidate} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRowItem({ task, onChange }: { task: TaskRow; onChange: () => void }) {
  const update = useServerFn(updateTask);
  const del = useServerFn(deleteTask);
  const toggle = useMutation({
    mutationFn: () =>
      update({
        data: { id: task.id, status: task.status === "done" ? "open" : "done" },
      }),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: task.id } }),
    onSuccess: onChange,
  });

  const overdue =
    task.due_at && task.status !== "done" && new Date(task.due_at) < new Date();
  const done = task.status === "done";

  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm">
      <button
        type="button"
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={done ? "Mark as open" : "Mark as done"}
      >
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}
        >
          {task.title}
        </div>
        {task.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {task.priority !== "normal" && (
            <span
              className={`rounded px-1.5 py-0.5 uppercase tracking-wide ${
                task.priority === "urgent"
                  ? "bg-destructive/10 text-destructive"
                  : task.priority === "high"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
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
          {task.position_title && (
            <Link
              to="/client/positions/$id"
              params={{ id: task.position_id! }}
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
        </div>
      </div>
      <button
        type="button"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        aria-label="Delete task"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function NewTaskDialog({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">(
    "normal",
  );
  const [dueAt, setDueAt] = useState("");
  const createFn = useServerFn(createTask);
  const submit = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("normal");
      setDueAt("");
      onCreated();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) submit.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={240}
              placeholder="e.g. Review shortlist for Head of Sales"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description (optional)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setPriority(v as "low" | "normal" | "high" | "urgent")
                }
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Due</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>
          {submit.error && (
            <div className="text-sm text-destructive">
              {(submit.error as Error).message}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submit.isPending || !title.trim()}>
              {submit.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
