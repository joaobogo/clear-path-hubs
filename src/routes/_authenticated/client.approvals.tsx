import { createFileRoute } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  listTasks,
  bulkUpdateTasks,
  TASK_TYPES,
  TASK_TYPE_LABELS,
  type TaskView,
  type TaskType,
} from "@/lib/tasks.functions";
import { SkeletonRows, NoWorkspaceState } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoApprovalsState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";
import { ApprovalRowItem } from "@/components/client/approvals/approval-row";
import { NewApprovalDialog } from "@/components/client/approvals/new-approval-dialog";
import { BulkDueDate, BulkReassign } from "@/components/client/approvals/bulk-actions";
import { DerivedApprovalRow } from "@/components/client/approvals/derived-approval-row";
import { getClientOverview } from "@/lib/client-overview.functions";
import type { QueueRow } from "@/lib/client-decision-queue";
import { toDerivedApproval, filterDerived } from "@/lib/client/derived-approvals";
import { toastError } from "@/lib/toast-error";



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
      ["client-overview", orgId],
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

  // The inbox also carries actions that are not stored tasks — feedback due,
  // an interview waiting on times, an offer awaiting a response. They come from
  // the same decision queue Overview reads, so the two screens agree.
  const overviewFn = useServerFn(getClientOverview);
  const overview = useQuery({
    queryKey: ["client-overview", orgId],
    queryFn: () => overviewFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const derived = useMemo(() => {
    const queue = ((overview.data as { decision_queue?: QueueRow[] } | undefined)
      ?.decision_queue ?? []) as QueueRow[];
    return filterDerived(queue.map(toDerivedApproval), view, taskType);
  }, [overview.data, view, taskType]);


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["client", "approvals", orgId] });
    setSelected(new Set());
  };

  const bulkReassign = useMutation({
    mutationFn: (assignee: string | null) =>
      bulkFn({ data: { ids: Array.from(selected), assignee_user_id: assignee } }),
    onSuccess: invalidate,
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't bulk reassign. Nothing was saved — please try again." }),
  });
  const bulkDueDate = useMutation({
    mutationFn: (due: string | null) =>
      bulkFn({ data: { ids: Array.from(selected), due_at: due } }),
    onSuccess: invalidate,
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't bulk due date. Nothing was saved — please try again." }),
  });
  const bulkComplete = useMutation({
    mutationFn: () => bulkFn({ data: { ids: Array.from(selected), status: "done" } }),
    onSuccess: invalidate,
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't bulk complete. Nothing was saved — please try again." }),
  });

  // Any bulk write in flight locks the whole bar: two overlapping bulk writes
  // on the same selection would race, and the second would report success
  // against a selection the first already changed.
  const bulkBusy =
    bulkComplete.isPending || bulkDueDate.isPending || bulkReassign.isPending;

  const rows = useMemo(() => tasks.data ?? [], [tasks.data]);
  const overdueCount = useMemo(
    () =>
      rows.filter(
        (t) => t.due_at && new Date(t.due_at) < new Date() && t.status !== "done",
      ).length + derived.filter((d) => d.overdue).length,
    [rows, derived],
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
    a.download = `approvals-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
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
              {overdueCount} approval{overdueCount === 1 ? "" : "s"} overdue in this view
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
          <SelectTrigger className="w-full sm:w-52">
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkComplete.mutate()}
              disabled={bulkBusy}
            >
              {bulkComplete.isPending ? "Marking complete…" : "Mark complete"}
            </Button>
            <BulkDueDate onApply={(v) => bulkDueDate.mutate(v)} disabled={bulkBusy} />
            <BulkReassign onApply={(v) => bulkReassign.mutate(v)} disabled={bulkBusy} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              disabled={bulkBusy}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {tasks.isError ? (
        <QueryErrorCard
          title="We couldn't load your approvals"
          error={tasks.error}
          onRetry={() => tasks.refetch()}
          retrying={tasks.isFetching}
        />
      ) : tasks.isLoading || overview.isLoading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 && derived.length === 0 ? (
        view === "completed" ? (
          // The generic "nothing needs approval" copy is wrong here: this filter
          // is about history, not the open queue.
          <SurfaceState
            content={{
              id: "approvals.completed-empty",
              icon: "approvals",
              tone: "expected",
              title: "No completed approval items yet",
              why: "Only approval items that were created here and then closed appear in this view. Decisions you made directly on a candidate, interview or offer are recorded on those records, not as approval items.",
              expected: "This fills up as approval items in this workspace are closed.",
              populates: "Closed approval items are listed here with who closed them and when.",
              activity: "Nothing has been closed in this inbox so far.",
              action: { label: "See open items", onClick: () => setView("open") },
            }}
          />
        ) : (
          <SurfaceState
            content={resolveNoApprovalsState({
              awaitingDecision: signals?.awaitingDecision ?? 0,
              activeRoles: signals?.activeRoles ?? 0,
            })}
          />
        )

      ) : (
        <ul className="space-y-2">
          {derived.map((d) => (
            <DerivedApprovalRow key={d.key} item={d} />
          ))}
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
