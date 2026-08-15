/**
 * Agent Operations Console — internal, platform staff only.
 *
 * Reads and controls are server-authorized: this screen renders whatever the
 * console query returns and offers only the actions the server attached to
 * each run. Nothing here decides permissions client-side.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getAgentOpsConsole,
  getAgentRunDetail,
  getAssignableOperators,
  retryAgentRunFn,
  cancelAgentRunFn,
  setAgentPausedFn,
  escalateAgentRunFn,
  reassignAgentRunFn,
} from "@/lib/agent-ops/agent-ops.functions";
import {
  BUCKET_LABELS,
  RUN_BUCKETS,
  type RunActionKey,
  type RunBucket,
} from "@/lib/agent-ops/agent-ops";
import { AGENT_KEYS, agentName } from "@/lib/agents/registry";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  AlertTriangle,
  Clock,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  UserCog,
  X,
} from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const Route = createFileRoute("/_authenticated/admin/agent-ops")({
  head: () => ({
    meta: [
      { title: "Agent operations · TaaSFlow admin" },
      {
        name: "description",
        content:
          "Internal console for agent runs, queues, failures and operator controls.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.agent-ops.tsx",
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: AgentOpsPage,
});

type ActionState = {
  action: RunActionKey;
  job_id: string;
  label: string;
  detail: string;
  organization_id?: string | null;
  agent_key?: string | null;
  paused?: boolean;
};

const ACTION_COPY: Record<
  RunActionKey,
  { title: string; explains: string; confirm: string }
> = {
  retry: {
    title: "Re-run this work",
    explains:
      "The pipeline runs again for this record. Work already in flight is never duplicated.",
    confirm: "Re-run",
  },
  cancel: {
    title: "Cancel queued work",
    explains:
      "Only work that has not started can be cancelled. It is recorded as stopped by an operator.",
    confirm: "Cancel run",
  },
  pause_agent: {
    title: "Pause this agent for this workspace",
    explains:
      "The agent stops taking new work in this workspace, and its queued work is stopped.",
    confirm: "Pause agent",
  },
  resume_agent: {
    title: "Resume this agent for this workspace",
    explains: "The agent starts taking work in this workspace again.",
    confirm: "Resume agent",
  },
  escalate: {
    title: "Escalate to a person",
    explains:
      "Raises a blocking, urgent task in the workspace and notifies platform staff.",
    confirm: "Escalate",
  },
  reassign: {
    title: "Reassign this escalation",
    explains: "Moves ownership to another platform operator.",
    confirm: "Reassign",
  },
  inspect_role: { title: "", explains: "", confirm: "" },
  inspect_audit: { title: "", explains: "", confirm: "" },
};

function bucketTone(bucket: RunBucket) {
  switch (bucket) {
    case "failed":
      return "border-destructive/40 bg-destructive/5";
    case "waiting_approval":
      return "border-warning/40 bg-warning/5";
    case "active":
      return "border-primary/30 bg-primary/5";
    default:
      return "border-border bg-card";
  }
}

function AgentOpsPage() {
  const [bucket, setBucket] = useState<RunBucket | "all">("failed");
  const [agent, setAgent] = useState<string>("all");
  const [openRun, setOpenRun] = useState<string | null>(null);
  const [pending, setPending] = useState<ActionState | null>(null);

  const loadConsole = useServerFn(getAgentOpsConsole);
  const consoleQuery = useQuery({
    queryKey: ["agent-ops", bucket, agent],
    queryFn: () =>
      loadConsole({
        data: {
          bucket,
          agent: agent as never,
          window_hours: 72,
          limit: 80,
        },
      }),
    refetchInterval: 30_000,
  });

  const data = consoleQuery.data;
  const runs = data?.runs ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Internal · platform staff
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Agent operations</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Agent runs, queues and failures across every workspace, with the
          controls that actually change them. Every control is recorded against
          the record it touched.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {RUN_BUCKETS.map((b) => {
          const active = bucket === b;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <span className="block text-xs text-muted-foreground">
                {BUCKET_LABELS[b]}
              </span>
              <span className="block text-xl font-semibold tabular-nums">
                {data ? (data.counts[b] ?? 0) : "—"}
              </span>
            </button>
          );
        })}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={agent} onValueChange={setAgent}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {AGENT_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {agentName(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {bucket !== "all" ? (
          <Button variant="ghost" size="sm" onClick={() => setBucket("all")}>
            Show all runs
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => consoleQuery.refetch()}
          disabled={consoleQuery.isFetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${consoleQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {data ? (
          <span className="text-xs text-muted-foreground">
            Last {data.window_hours}h · read {new Date(data.generated_at).toLocaleTimeString(APP_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
          </span>
        ) : null}
      </div>

      {consoleQuery.isError ? (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            This console could not be loaded. It is limited to platform staff.
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.agents.length ? (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Agents in this window</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {data.agents.map((a) => (
              <div key={a.key} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">{a.name}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                  <span>{a.active} running</span>
                  <span>{a.failed_24h} failed 24h</span>
                  {a.workspaces_paused ? (
                    <Badge variant="outline">{a.workspaces_paused} paused</Badge>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {consoleQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-muted/30" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm font-medium">No runs in this view</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing matched {BUCKET_LABELS[bucket as RunBucket] ?? "these filters"} in the
              last {data?.window_hours ?? 72} hours.
            </p>
          </div>
        ) : (
          runs.map((run) => (
            <article key={run.id} className={`rounded-lg border p-4 ${bucketTone(run.bucket)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{run.agent_name}</span>
                    <Badge variant="outline">{run.job_type}</Badge>
                    <Badge variant="secondary">{BUCKET_LABELS[run.bucket]}</Badge>
                    {run.stalled ? (
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" /> Stalled
                      </Badge>
                    ) : null}
                    {run.escalation === "escalated" ? (
                      <Badge variant="outline">Escalated</Badge>
                    ) : run.escalation === "needs_human" ? (
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Needs a person
                      </Badge>
                    ) : null}
                    {run.agent_paused ? <Badge variant="outline">Agent paused</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {run.organization_name ?? "Workspace unresolved"}
                    {run.position_title ? ` · ${run.position_title}` : ""}
                    {` · attempt ${run.attempts}`}
                    {run.duration_label ? ` · ${run.duration_label}` : ""}
                  </p>
                  {run.error_category ? (
                    <p className="text-sm">
                      <span className="font-medium">{run.error_category.label}:</span>{" "}
                      <span className="text-muted-foreground">
                        {run.error_category.operator_hint}
                      </span>
                    </p>
                  ) : null}
                  {run.error_message ? (
                    <p className="truncate text-xs text-muted-foreground">{run.error_message}</p>
                  ) : null}
                  {run.usage ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {run.usage.calls} model call(s) · {run.usage.tokens_in}/{run.usage.tokens_out}{" "}
                      tokens
                      {run.usage.cost_label ? ` · ${run.usage.cost_label}` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {run.actions.includes("retry") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPending({
                          action: "retry",
                          job_id: run.id,
                          label: run.agent_name,
                          detail: `${run.job_type} · ${run.organization_name ?? "workspace unresolved"}`,
                        })
                      }
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                    </Button>
                  ) : null}
                  {run.actions.includes("cancel") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPending({
                          action: "cancel",
                          job_id: run.id,
                          label: run.agent_name,
                          detail: run.job_type,
                        })
                      }
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                    </Button>
                  ) : null}
                  {run.actions.includes("pause_agent") || run.actions.includes("resume_agent") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPending({
                          action: run.agent_paused ? "resume_agent" : "pause_agent",
                          job_id: run.id,
                          label: run.agent_name,
                          detail: run.organization_name ?? "this workspace",
                          organization_id: run.organization_id,
                          agent_key: run.agent_key,
                          paused: !run.agent_paused,
                        })
                      }
                    >
                      {run.agent_paused ? (
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {run.agent_paused ? "Resume agent" : "Pause agent"}
                    </Button>
                  ) : null}
                  {run.actions.includes("escalate") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPending({
                          action: "escalate",
                          job_id: run.id,
                          label: run.agent_name,
                          detail: run.organization_name ?? "workspace unresolved",
                        })
                      }
                    >
                      <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Escalate
                    </Button>
                  ) : null}
                  {run.actions.includes("reassign") ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setPending({
                          action: "reassign",
                          job_id: run.id,
                          label: run.agent_name,
                          detail: run.organization_name ?? "workspace unresolved",
                        })
                      }
                    >
                      <UserCog className="mr-1.5 h-3.5 w-3.5" /> Reassign
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpenRun(openRun === run.id ? null : run.id)}
                  >
                    {openRun === run.id ? "Hide detail" : "Inspect"}
                  </Button>
                  {run.position_id ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/admin/positions/$id" params={{ id: run.position_id }}>
                        Role
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              {openRun === run.id ? <RunDetail jobId={run.id} /> : null}
            </article>
          ))
        )}
      </section>

      <ActionDialog
        pending={pending}
        onClose={() => setPending(null)}
        onDone={() => {
          setPending(null);
          void consoleQuery.refetch();
        }}
      />
    </div>
  );
}

function RunDetail({ jobId }: { jobId: string }) {
  const load = useServerFn(getAgentRunDetail);
  const detail = useQuery({
    queryKey: ["agent-ops-run", jobId],
    queryFn: () => load({ data: { job_id: jobId } }),
  });

  if (detail.isLoading) {
    return <div className="mt-4 h-24 animate-pulse rounded-md bg-muted/40" />;
  }
  if (detail.isError || !detail.data) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        This run's detail could not be loaded.
      </p>
    );
  }

  const d = detail.data;
  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What it ran on
          </h3>
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
            {JSON.stringify(d.inputs, null, 2)}
          </pre>
        </div>
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What it left behind
          </h3>
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs">
            {JSON.stringify(d.outputs, null, 2)}
          </pre>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Prompts, model reasoning, credentials and candidate personal data are
        withheld from this console by design.
      </p>

      {d.activity?.length ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent agent activity in this workspace
          </h3>
          <ul className="space-y-1">
            {d.activity.map((a: { sentence: string; occurred_at: string; outcome: string }, i: number) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                <span>{a.sentence}</span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {new Date(a.occurred_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Audit trail
        </h3>
        {d.audit?.length ? (
          <ul className="space-y-1">
            {d.audit.map(
              (a: { action: string; created_at: string; trace_id: string | null }, i: number) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                  <span className="font-mono">{a.action}</span>
                  <span className="text-muted-foreground">
                    {new Date(a.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                  </span>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No recorded events for this run yet.
          </p>
        )}
      </div>
    </div>
  );
}

function ActionDialog({
  pending,
  onClose,
  onDone,
}: {
  pending: ActionState | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState<string>("");

  const retry = useServerFn(retryAgentRunFn);
  const cancel = useServerFn(cancelAgentRunFn);
  const pause = useServerFn(setAgentPausedFn);
  const escalate = useServerFn(escalateAgentRunFn);
  const reassign = useServerFn(reassignAgentRunFn);
  const loadOperators = useServerFn(getAssignableOperators);

  const needsAssignee = pending?.action === "reassign";
  const operators = useQuery({
    queryKey: ["agent-ops-operators"],
    queryFn: () => loadOperators(),
    enabled: Boolean(needsAssignee),
  });

  const copy = pending ? ACTION_COPY[pending.action] : null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!pending) return null;
      switch (pending.action) {
        case "retry":
          return retry({ data: { job_id: pending.job_id, reason } });
        case "cancel":
          return cancel({ data: { job_id: pending.job_id, reason } });
        case "pause_agent":
        case "resume_agent":
          return pause({
            data: {
              organization_id: pending.organization_id!,
              agent_key: pending.agent_key as never,
              paused: Boolean(pending.paused),
              reason,
            },
          });
        case "escalate":
          return escalate({ data: { job_id: pending.job_id, reason } });
        case "reassign":
          return reassign({
            data: { job_id: pending.job_id, assignee_user_id: assignee, reason },
          });
        default:
          return null;
      }
    },
    onSuccess: (result) => {
      if (!result) return;
      if (result.ok) toast.success(result.message);
      else toast.warning(result.message);
      setReason("");
      setAssignee("");
      onDone();
    },
    onError: () => {
      toast.error("That control could not be applied. Nothing was changed.");
    },
  });

  const canSubmit =
    reason.trim().length >= 8 && (!needsAssignee || Boolean(assignee)) && !mutation.isPending;

  const valid = useMemo(() => reason.trim().length >= 8, [reason]);

  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          setAssignee("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>
            {pending?.label} · {pending?.detail}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{copy?.explains}</p>

        {needsAssignee ? (
          <div className="space-y-2">
            <Label htmlFor="assignee">New owner</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger id="assignee">
                <SelectValue
                  placeholder={
                    operators.isLoading ? "Loading operators…" : "Choose a platform operator"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(operators.data ?? []).map((o) => (
                  <SelectItem key={o.user_id} value={o.user_id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="reason">Why (recorded in the audit trail)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provider timed out twice; safe to re-run."
            rows={3}
          />
          {reason.length > 0 && !valid ? (
            <p className="text-xs text-destructive">
              Say why, in a few words — it goes in the audit trail.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Keep as is
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? "Applying…" : copy?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
