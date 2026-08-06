import { createFileRoute, Link } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  bulkUpdateTasks,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskRow,
  type TaskView,
  type TaskType,
} from "@/lib/tasks.functions";
import { SkeletonRows, NoWorkspaceState } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoApprovalsState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";


const RoutePending = makeWorkspacePending({ shape: "rows", kpis: false, width: "6xl" });
export const Route = createFileRoute("/_authenticated/client/approvals")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.approvals.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  validateSearch: (search: Record<string, unknown>) => ({
    view: typeof search.view === "string" ? search.view : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Approvals · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApprovalsPage,
});

const VIEWS: { key: TaskView; label: string }[] = [
  { key: "my", label: "Assigned to me" },
  { key: "team", label: "Team" },
  { key: "overdue", label: "Overdue" },
  { key: "blocking", label: "Blocking delivery" },
  { key: "completed", label: "Completed" },
];

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

function ApprovalsPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listTasks);
  const bulkFn = useServerFn(bulkUpdateTasks);
  const qc = useQueryClient();
  const initialView = Route.useSearch().view;
  const [view, setView] = useState<TaskView>(
    VIEWS.some((v) => v.key === initialView) ? (initialView as TaskView) : "my",
  );
  const [taskType, setTaskType] = useState<TaskType | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctxQuery.data?.active?.organization_id ?? null;

  // Tasks are driven by candidate and role state, so a remote move changes
  // this inbox. Refresh in place and mark it rather than reshuffling rows.
  const live = useRouteRealtime({
    scope: "client-approvals",
    orgId,
    invalidateKeys: [
      ["client", "approvals", orgId],
      ["client-kpis", orgId],
    ],
  });
  const signals = useEmptyStateSignals(orgId ?? undefined);

  const tasks = useQuery({
    queryKey: ["client", "approvals", orgId, view, taskType],
    queryFn: () =>
      listFn({
        data: {
          organization_id: orgId!,
          view,
          task_type: taskType === "all" ? undefined : taskType,
        },
      }),
    enabled: !!orgId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["client", "approvals", orgId] });
    setSelected(new Set());
  };

  const bulkReassign = useMutation({
    mutationFn: (assignee: string | null) =>
      bulkFn({ data: { ids: Array.from(selected), assignee_user_id: assignee } }),
    onSuccess: invalidate,
  });
  const bulkDueDate = useMutation({
    mutationFn: (due: string | null) =>
      bulkFn({ data: { ids: Array.from(selected), due_at: due } }),
    onSuccess: invalidate,
  });
  const bulkComplete = useMutation({
    mutationFn: () => bulkFn({ data: { ids: Array.from(selected), status: "done" } }),
    onSuccess: invalidate,
  });

  const rows = useMemo(() => tasks.data ?? [], [tasks.data]);
  const overdueCount = useMemo(
    () =>
      rows.filter(
        (t) => t.due_at && new Date(t.due_at) < new Date() && t.status !== "done",
      ).length,
    [rows],
  );

  const toggleSel = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const exportCsv = () => {
    const header = [
      "id",
      "title",
      "type",
      "status",
      "priority",
      "blocking",
      "due_at",
      "assignee",
      "position",
      "candidate",
      "completed_at",
      "evidence",
    ].join(",");
    const escape = (v: unknown) =>
      `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const body = rows
      .map((t) =>
        [
          t.id,
          t.title,
          t.task_type,
          t.status,
          t.priority,
          t.blocking,
          t.due_at ?? "",
          t.assignee_user_id ?? "",
          t.position_title ?? "",
          t.candidate_name ?? "",
          t.completed_at ?? "",
          t.completion_evidence ?? "",
        ]
          .map(escape)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (ctxQuery.isError) {
    return (
      <QueryErrorCard
        title="We couldn't load your workspace"
        error={ctxQuery.error}
        onRetry={() => ctxQuery.refetch()}
        retrying={ctxQuery.isFetching}
      />
    );
  }

  if (!orgId) {
    return <NoWorkspaceState />;
  }

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Every next action for this workspace in one inbox.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveUpdatedChip updatedAt={live.updatedAt} />
          <Button variant="outline" size="sm" onClick={exportCsv}>
            Export CSV
          </Button>
          <NewApprovalDialog orgId={orgId} onCreated={invalidate} />
        </div>
      </header>

      {overdueCount > 0 && view !== "overdue" && view !== "completed" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-medium">
              {overdueCount} task{overdueCount === 1 ? "" : "s"} overdue in this view
            </div>
            <button
              type="button"
              onClick={() => setView("overdue")}
              className="text-muted-foreground underline underline-offset-2"
            >
              Focus on overdue →
            </button>
          </div>
        </div>
      )}

      <Tabs value={view} onValueChange={(v) => setView(v as TaskView)}>
        <TabsList className="flex flex-wrap">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.key} value={v.key}>
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType | "all")}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TASK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
            <span className="font-medium">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulkComplete.mutate()}>
              Mark complete
            </Button>
            <BulkDueDate onApply={(v) => bulkDueDate.mutate(v)} />
            <BulkReassign onApply={(v) => bulkReassign.mutate(v)} />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {tasks.isError ? (
        <QueryErrorCard
          title="We couldn't load your tasks"
          error={tasks.error}
          onRetry={() => tasks.refetch()}
          retrying={tasks.isFetching}
        />
      ) : tasks.isLoading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <SurfaceState
          content={resolveNoApprovalsState({
            awaitingDecision: signals?.awaitingDecision ?? 0,
            activeRoles: signals?.activeRoles ?? 0,
          })}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <ApprovalRowItem
              key={t.id}
              task={t}
              onChange={invalidate}
              selected={selected.has(t.id)}
              onToggleSelect={() => toggleSel(t.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BulkDueDate({ onApply }: { onApply: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Change due date
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change due date</DialogTitle>
        </DialogHeader>
        <Input type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)} />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onApply(null);
              setOpen(false);
            }}
          >
            Clear due date
          </Button>
          <Button
            disabled={!val}
            onClick={() => {
              onApply(new Date(val).toISOString());
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkReassign({ onApply }: { onApply: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign selected tasks</DialogTitle>
        </DialogHeader>
        <Label className="text-xs">Assignee user ID (UUID)</Label>
        <Input
          placeholder="00000000-0000-0000-0000-000000000000"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Paste the team member's user ID. Team-picker UI coming next; this works today for admins
          moving urgent items.
        </p>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onApply(null);
              setOpen(false);
            }}
          >
            Unassign
          </Button>
          <Button
            disabled={val.length !== 36}
            onClick={() => {
              onApply(val);
              setOpen(false);
            }}
          >
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalRowItem({
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
  });
  const reopen = useMutation({
    mutationFn: () => update({ data: { id: task.id, status: "open" } }),
    onSuccess: onChange,
  });
  const remove = useMutation({
    mutationFn: () => del({ data: { id: task.id } }),
    onSuccess: onChange,
  });

  const overdue =
    task.due_at && task.status !== "done" && new Date(task.due_at) < new Date();
  const done = task.status === "done";
  const requiresEvidence =
    task.task_type === "role_brief_approval" ||
    task.task_type === "rubric_approval" ||
    task.task_type === "offer_decision" ||
    task.task_type === "feedback_submission";

  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm">
      <Checkbox
        checked={selected}
        onCheckedChange={onToggleSelect}
        className="mt-1"
        aria-label="Select task"
      />
      <button
        type="button"
        onClick={() => {
          if (done) reopen.mutate();
          else if (requiresEvidence) setEvidenceOpen(true);
          else complete.mutate();
        }}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={done ? "Reopen" : "Mark done"}
      >
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
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
        onClick={() => remove.mutate()}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        aria-label="Delete task"
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
              placeholder="e.g. Approved rubric v3 — signed off by hiring manager on the 2pm call."
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
    </li>
  );
}

function NewApprovalDialog({
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
  const [taskType, setTaskType] = useState<TaskType>("general_follow_up");
  const [blocking, setBlocking] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [reminder, setReminder] = useState<"none" | "daily" | "weekly" | "before_due">("none");
  const createFn = useServerFn(createTask);
  const submit = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          organization_id: orgId,
          title: title.trim(),
          description: description.trim() || undefined,
          task_type: taskType,
          priority,
          blocking,
          reminder_policy: reminder,
          due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("normal");
      setTaskType("general_follow_up");
      setBlocking(false);
      setDueAt("");
      setReminder("none");
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
            <Label htmlFor="task-title">Action title</Label>
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
            <Label htmlFor="task-desc">Context (optional)</Label>
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
              <Label>Type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TASK_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) =>
                  setPriority(v as "low" | "normal" | "high" | "urgent")
                }
              >
                <SelectTrigger>
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
            <div className="space-y-1.5">
              <Label>Reminder</Label>
              <Select
                value={reminder}
                onValueChange={(v) =>
                  setReminder(v as "none" | "daily" | "weekly" | "before_due")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="before_due">Before due</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={blocking}
              onCheckedChange={(v) => setBlocking(v === true)}
            />
            <span>Blocks delivery — surface this on the overview</span>
          </label>
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
