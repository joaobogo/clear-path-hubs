import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  CircleSlash,
  Clock,
  ExternalLink,
  FileSearch,
  Lock,
  Pause,
  RefreshCw,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { getAgentActivityRail } from "@/lib/agent-rail/agent-rail.functions";
import {
  absTime,
  EMPTY_FILTERS,
  filterGroups,
  KIND_LABEL,
  needsAttention,
  relTime,
  RAIL_STATUSES,
  STATUS_LABEL,
  type RailActionKey,
  type RailFilters,
  type RailItem,
  type RailStatus,
} from "@/lib/agent-rail/agent-rail";
import { clientAction } from "@/lib/client-decisions.functions";
import { retryBlueprintAnalysis } from "@/lib/blueprint.functions";
import { setAgentPaused } from "@/lib/agents.functions";
import { DECLINE_REASONS } from "@/lib/client-decision-reasons";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoAgentRunsState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";

import { staggerStyle, useArrivals, useJustChanged } from "@/lib/motion/use-motion";

export const AGENT_RAIL_QUERY_KEY = ["agent-activity-rail"] as const;

/**
 * Agent Activity rail.
 *
 * Reads a projection of work that already happened and offers only the actions
 * that a real server function can carry out (see ACTION_BACKING in
 * agent-rail.ts). A viewer seat sees the same record of work with the decision
 * buttons replaced by a link to the surface that explains who can decide.
 */

const STATUS_STYLE: Record<RailStatus, string> = {
  done: "border-success/30 text-success",
  in_progress: "border-info/30 text-info",
  needs_you: "border-primary/40 text-primary",
  blocked: "border-warning/40 text-warning-strong",
  failed: "border-destructive/50 text-destructive",
  stopped: "border-muted-foreground/40 text-muted-foreground",
};

const STATUS_ICON: Record<RailStatus, React.ComponentType<{ className?: string }>> = {
  done: Check,
  in_progress: Clock,
  needs_you: UserCheck,
  blocked: AlertTriangle,
  failed: AlertTriangle,
  stopped: CircleSlash,
};

function ItemActions({
  item,
  orgId,
  canDecide,
  onDone,
}: {
  item: RailItem;
  orgId: string;
  canDecide: boolean;
  onDone: () => void;
}) {
  const act = useServerFn(clientAction);
  const retry = useServerFn(retryBlueprintAnalysis);
  const pause = useServerFn(setAgentPaused);
  const [reason, setReason] = useState<string>("");

  const approve = useMutation({
    mutationFn: () =>
      act({ data: { orgId, matchId: item.candidate!.match_id, action: "shortlist" } }),
    onSuccess: () => {
      toast.success("Shortlisted", {
        description: `${item.candidate?.label ?? "The candidate"} moved to your shortlist.`,
      });
      onDone();
    },
    onError: (e: Error) => toast.error("Could not shortlist", { description: e.message }),
  });

  const decline = useMutation({
    mutationFn: (reasonCode: string) =>
      act({
        data: {
          orgId,
          matchId: item.candidate!.match_id,
          action: "not_moving_forward",
          reasonCode,
        },
      }),
    onSuccess: () => {
      toast.success("Declined", { description: "We logged your reason for the team." });
      onDone();
    },
    onError: (e: Error) => toast.error("Could not record that", { description: e.message }),
  });

  const retryRun = useMutation({
    mutationFn: () => retry({ data: { positionId: item.role!.id } }),
    onSuccess: (res: { ok: boolean; reason?: string | null }) => {
      if (res.ok) {
        toast.success("Running again", { description: "We restarted the blueprint." });
      } else {
        toast.message(
          res.reason === "already_running"
            ? "Already running"
            : "Nothing to run yet",
          {
            description:
              res.reason === "already_running"
                ? "This role is being compiled right now."
                : "This role has no intake to compile from. Our team will pick it up.",
          },
        );
      }
      onDone();
    },
    onError: (e: Error) => toast.error("Could not restart", { description: e.message }),
  });

  const pauseAgent = useMutation({
    mutationFn: () =>
      pause({
        data: { organization_id: orgId, agent_key: item.actor.key as never, paused: true },
      }),
    onSuccess: (res: { stopped_jobs: number; stopped_messages: number }) => {
      toast.success(`${item.actor.name} paused`, {
        description: `${res.stopped_jobs} queued task${res.stopped_jobs === 1 ? "" : "s"} stopped.`,
      });
      onDone();
    },
    onError: (e: Error) => toast.error("Could not pause", { description: e.message }),
  });

  const busy =
    approve.isPending || decline.isPending || retryRun.isPending || pauseAgent.isPending;

  const has = (key: RailActionKey) => item.actions.includes(key);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {has("approve") && canDecide && item.candidate && (
        <Button size="sm" disabled={busy} onClick={() => approve.mutate()}>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Approve
        </Button>
      )}

      {has("reject") && canDecide && item.candidate && (
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Decline
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <p className="text-xs font-medium">Why are you declining?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              A reason is required so the next candidates are better matched.
            </p>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="mt-2" aria-label="Reason for declining">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {DECLINE_REASONS.filter((r) => r.code !== "other").map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="mt-2 w-full"
              disabled={!reason || busy}
              onClick={() => decline.mutate(reason)}
            >
              Record decision
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Need to add detail, or change your mind later? Open the candidate —
              decisions there stay reversible for a short window.
            </p>
          </PopoverContent>
        </Popover>
      )}

      {has("review") && item.role && (
        <Button asChild size="sm" variant="outline">
          <Link to="/client/positions/$id" params={{ id: item.role.id }}>
            Review
          </Link>
        </Button>
      )}

      {has("inspect_evidence") && item.candidate?.identified && (
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/client/candidates/$id"
            params={{ id: item.candidate.match_id }}
            hash="sec-coverage"
          >
            <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
            Inspect evidence
          </Link>
        </Button>
      )}

      {has("open_candidate") && item.candidate?.identified && (
        <Button asChild size="sm" variant="ghost">
          <Link to="/client/candidates/$id" params={{ id: item.candidate.match_id }}>
            Open candidate
          </Link>
        </Button>
      )}

      {has("open_role") && item.role && (
        <Button asChild size="sm" variant="ghost">
          <Link to="/client/positions/$id" params={{ id: item.role.id }}>
            Open role
          </Link>
        </Button>
      )}

      {has("retry") && item.role && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => retryRun.mutate()}>
          <RefreshCw
            className={`h-3.5 w-3.5 ${retryRun.isPending ? "animate-spin motion-reduce:animate-none" : ""}`}
            aria-hidden="true"
          />
          Run again
        </Button>
      )}

      {has("pause") && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => pauseAgent.mutate()}>
          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          Pause {item.actor.name}
        </Button>
      )}

      {!canDecide && (has("approve") || has("reject")) && (
        <span className="text-[11px] text-muted-foreground">
          Your seat can view this. Ask a workspace admin to decide.
        </span>
      )}
    </div>
  );
}

function ItemRow({
  item,
  orgId,
  canDecide,
  onDone,
  isNew = false,
  index = 0,
}: {
  item: RailItem;
  orgId: string;
  canDecide: boolean;
  onDone: () => void;
  /** Arrived since the last read of this rail — animates in once. */
  isNew?: boolean;
  index?: number;
}) {
  const StatusIcon = STATUS_ICON[item.status];
  const attention = needsAttention(item);
  // A status transition is a system event, so it gets a single settling cue.
  const statusChanged = useJustChanged(item.status);
  return (
    <li
      style={isNew ? staggerStyle(index) : undefined}
      className={`px-4 py-3 ${attention ? "bg-primary/[0.04]" : ""} ${
        isNew ? "motion-arrive" : ""
      } ${statusChanged ? "motion-state-flash" : ""}`}
      aria-label={`${KIND_LABEL[item.kind]} — ${STATUS_LABEL[item.status]}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${STATUS_STYLE[item.status]}`}
          aria-hidden="true"
        >
          {item.actor.kind === "agent" ? (
            <Bot className="h-3.5 w-3.5" />
          ) : (
            <StatusIcon className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {KIND_LABEL[item.kind]}
            </span>
            <Badge variant="outline" className={`gap-1 ${STATUS_STYLE[item.status]}`}>
              <StatusIcon
                className={`h-3 w-3 ${item.status === "in_progress" ? "motion-live-dot" : ""}`}
                aria-hidden="true"
              />
              {STATUS_LABEL[item.status]}
            </Badge>
            {item.count > 1 && (
              <Badge variant="secondary">×{item.count}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm">{item.action}</p>
          <p className="text-xs text-muted-foreground">{item.result}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span>{item.actor.name}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.occurred_at} title={absTime(item.occurred_at)}>
              {relTime(item.occurred_at)}
            </time>
            {item.candidate && !item.candidate.identified && item.candidate.releaseMeaningful && (
              <>
                <span aria-hidden="true">·</span>
                <span>Not yet released to your workspace</span>
              </>
            )}
          </p>
          {item.actions.length > 0 && (
            <ItemActions item={item} orgId={orgId} canDecide={canDecide} onDone={onDone} />
          )}
        </div>
      </div>
    </li>
  );
}

export function AgentActivityRail({
  organizationId,
  className,
}: {
  organizationId: string | null | undefined;
  className?: string;
}) {
  const fetchRail = useServerFn(getAgentActivityRail);
  const qc = useQueryClient();
  const [filters, setFilters] = useState<RailFilters>(EMPTY_FILTERS);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const signals = useEmptyStateSignals(organizationId ?? undefined);

  const query = useQuery({
    queryKey: [...AGENT_RAIL_QUERY_KEY, organizationId ?? null],
    queryFn: () => fetchRail({ data: { organization_id: organizationId! } }),
    enabled: !!organizationId,
    staleTime: 20_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: AGENT_RAIL_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["client-candidates"] });
    qc.invalidateQueries({ queryKey: ["client-overview"] });
  };

  const groups = useMemo(
    () => (query.data ? filterGroups(query.data.groups, filters) : []),
    [query.data, filters],
  );

  // Ids currently on the rail; anything new since the last read animates in.
  const itemIds = useMemo(
    () => groups.flatMap((g) => g.items.map((i) => i.id)),
    [groups],
  );
  const arrivals = useArrivals(itemIds);

  const header = (
    <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        Agent activity
      </h2>
      {query.data && query.data.attention_total > 0 && (
        <Badge variant="outline" className="border-primary/40 text-primary">
          {query.data.attention_total} need you
        </Badge>
      )}
    </div>
  );

  const shell = (body: React.ReactNode) => (
    <section
      className={`flex h-full min-h-0 flex-col rounded-xl border bg-card ${className ?? ""}`}
      aria-label="Agent activity"
    >
      {header}
      {body}
    </section>
  );

  if (!organizationId) {
    return shell(
      <div className="p-4 text-sm text-muted-foreground">
        Choose a workspace to see the work running against your roles.
      </div>,
    );
  }

  if (query.isLoading) {
    return shell(
      <div className="space-y-3 p-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
        <span className="sr-only">Loading agent activity</span>
      </div>,
    );
  }

  if (query.isError) {
    return shell(
      <div className="p-4">
        <p className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <span>
            We could not load the activity record. Work is still running — this
            panel simply could not read it.
          </span>
        </p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>,
    );
  }

  const data = query.data!;

  if (!data.permission.can_read) {
    return shell(
      <div className="p-4">
        <p className="flex items-start gap-2 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            You do not have access to this workspace's activity. Ask a workspace
            admin to add your seat.
          </span>
        </p>
      </div>,
    );
  }

  const unfilteredEmpty = data.groups.length === 0;

  return shell(
    <>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Select
          value={filters.roleId}
          onValueChange={(v) => setFilters((f) => ({ ...f, roleId: v }))}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by role">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {data.roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.actorKey}
          onValueChange={(v) => setFilters((f) => ({ ...f, actorKey: v }))}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by agent">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {data.actors.map((a) => (
              <SelectItem key={a.key} value={a.key}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v as RailStatus | "all" }))}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Filter by status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {RAIL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Toggle
          size="sm"
          className="h-8 text-xs"
          pressed={filters.attentionOnly}
          onPressedChange={(v) => setFilters((f) => ({ ...f, attentionOnly: v }))}
          aria-label="Show only items that need attention"
        >
          Needs attention
        </Toggle>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {unfilteredEmpty ? (
          <div className="p-4">
            <SurfaceState
              compact
              className="max-w-none border-0 bg-transparent p-0"
              content={resolveNoAgentRunsState({
                activeRoles: signals?.activeRoles ?? 0,
                running: signals?.runsRunning ?? 0,
              })}
            />
          </div>
        ) : groups.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <p>Nothing matches these filters.</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="divide-y motion-content-in">
            {groups.map((group) => {
              const open = openGroups[group.key] ?? true;
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-muted/50"
                    aria-expanded={open}
                    onClick={() =>
                      setOpenGroups((s) => ({ ...s, [group.key]: !open }))
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                        aria-hidden="true"
                      />
                      <span className="truncate text-xs font-semibold">{group.heading}</span>
                      {group.attention_count > 0 && (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          {group.attention_count}
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {group.items.length} item{group.items.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {open && (
                    <ul className="motion-expand divide-y border-t">
                      {group.items.map((item, i) => (
                        <ItemRow
                          key={item.id}
                          isNew={arrivals.has(item.id)}
                          index={i}
                          item={item}
                          orgId={organizationId}
                          canDecide={data.permission.can_decide}
                          onDone={refresh}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-[11px] text-muted-foreground">
        <span>Updated {relTime(data.fetched_at)}</span>
        <Link to="/client/agents" className="inline-flex items-center gap-1 underline">
          Agent controls
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </>,
  );
}
