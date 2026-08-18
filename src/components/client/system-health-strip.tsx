import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  HelpCircle,
  Lock,
  RefreshCw,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { relTime, absTime } from "@/lib/agent-rail/agent-rail";
import { getSystemHealth } from "@/lib/system-health/system-health.functions";
import {
  ACTION_LABEL,
  ACTION_TO,
  isAttention,
  SIGNAL_LABEL,
  STATE_LABEL,
  STATE_SHORT,
  type HealthActionKey,
  type HealthSignal,
  type HealthState,
} from "@/lib/system-health/system-health";
import { getPlatformStatus } from "@/lib/status/platform-status.functions";
import { useStableDegradedNotice } from "@/lib/status/use-stable-degraded-notice";

export const SYSTEM_HEALTH_QUERY_KEY = ["system-health"] as const;

/**
 * System health and freshness strip.
 *
 * One compact line that answers "is this working, and is what I'm looking at
 * current?". It never claims "Operational" without measured signals behind it,
 * pairs every state with a word and a distinct icon (never colour alone), and
 * only raises an alert for delayed / degraded / action-required states.
 */

const STATE_STYLE: Record<HealthState, string> = {
  operational: "border-success/30 text-success",
  processing: "border-info/30 text-info",
  waiting_approval: "border-primary/40 text-primary",
  delayed: "border-warning/40 text-warning-strong",
  degraded: "border-warning/50 text-warning-strong",
  action_required: "border-destructive/50 text-destructive",
  unknown: "border-muted-foreground/30 text-muted-foreground",
  unavailable: "border-muted-foreground/30 text-muted-foreground",
};

const STATE_ICON: Record<HealthState, React.ComponentType<{ className?: string }>> = {
  operational: Check,
  processing: RefreshCw,
  waiting_approval: UserCheck,
  delayed: Clock,
  degraded: AlertTriangle,
  action_required: TriangleAlert,
  unknown: HelpCircle,
  unavailable: Lock,
};

function StateChip({ state, className }: { state: HealthState; className?: string }) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        STATE_STYLE[state],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{STATE_LABEL[state]}</span>
    </span>
  );
}

function SignalActions({ signal }: { signal: HealthSignal }) {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  if (signal.actions.length === 0) return null;

  // "Check again" used to look inert: it fired an invalidate and gave no
  // feedback. Now it shows progress and reports the outcome.
  const recheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await queryClient.refetchQueries({ queryKey: SYSTEM_HEALTH_QUERY_KEY });
      toast.success("Checked again", {
        description: "This panel now shows the latest reading.",
      });
    } catch {
      toast.error("We could not check again", {
        description: "Nothing changed — please try once more in a moment.",
      });
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {signal.actions.map((key: HealthActionKey) =>
        key === "refresh" ? (
          <Button
            key={key}
            size="sm"
            variant="outline"
            onClick={recheck}
            disabled={checking}
            aria-busy={checking}
          >
            <RefreshCw
              className={cn("mr-1.5 h-3.5 w-3.5", checking && "animate-spin")}
              aria-hidden="true"
            />
            {checking ? "Checking…" : ACTION_LABEL[key]}
          </Button>
        ) : (
          <Button key={key} size="sm" variant="outline" asChild>
            <Link to={ACTION_TO[key]}>{ACTION_LABEL[key]}</Link>
          </Button>
        ),
      )}
    </div>
  );
}

function SignalRow({ signal }: { signal: HealthSignal }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-border/60 py-3 first:border-t-0 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{SIGNAL_LABEL[signal.key]}</span>
          <StateChip state={signal.state} />
          {signal.count !== null && signal.count > 0 ? (
            <span className="text-xs text-muted-foreground">{signal.count}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
        {signal.measured_at ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            <time dateTime={signal.measured_at} title={absTime(signal.measured_at)}>
              Measured {relTime(signal.measured_at)}
            </time>
          </p>
        ) : (
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">Not measured</p>
        )}
      </div>
      <SignalActions signal={signal} />
    </li>
  );
}

export function SystemHealthStrip({
  organizationId,
  className,
}: {
  organizationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const fetchHealth = useServerFn(getSystemHealth);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...SYSTEM_HEALTH_QUERY_KEY, organizationId],
    enabled: !!organizationId,
    staleTime: 60_000,
    queryFn: () => fetchHealth({ data: { organization_id: organizationId! } }),
  });

  // The degraded-mode banner and this pill must never disagree: both read the
  // same platform-status measurement, and a degraded platform outranks a local
  // "operational" reading.
  const { data: platform } = useQuery({
    queryKey: ["platform-status", "banner"],
    queryFn: () => getPlatformStatus(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });
  // Same flap guard as the banner, so the pill and the banner never disagree.
  const platformNotice = useStableDegradedNotice(platform);

  const attentionSignals = useMemo(
    () => (data?.signals ?? []).filter((s) => isAttention(s.state)),
    [data],
  );

  if (!organizationId) return null;

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border bg-card px-3 py-2.5", className)}>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={cn("rounded-xl border bg-card px-3 py-2.5", className)}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Status unavailable.</span> We couldn&apos;t
            read system status just now — this doesn&apos;t mean anything is wrong.
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data.can_read) {
    return (
      <div className={cn("rounded-xl border bg-card px-3 py-2.5", className)}>
        <div className="flex min-w-0 items-center gap-2">
          <StateChip state="unavailable" />
          <p className="min-w-0 truncate text-xs text-muted-foreground">{data.headline}</p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="System status and data freshness"
      className={cn("rounded-xl border bg-card", className)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <StateChip state={platformNotice.show ? "degraded" : data.overall} />
          <p
            className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm"
            aria-live="polite"
          >
            {platformNotice.show ? platformNotice.title : data.headline}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {data.attention_count > 0 ? (
            <span className="hidden text-[11px] font-semibold text-foreground sm:inline">
              {data.attention_count} to look at
            </span>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={open}
            aria-controls="system-health-detail"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="hidden sm:inline">{open ? "Hide detail" : "Detail"}</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform sm:ml-1.5", open && "rotate-180")}
              aria-hidden="true"
            />
            <span className="sr-only">
              {open ? "Hide system status detail" : "Show system status detail"}
            </span>
          </Button>
        </div>
      </div>

      {open ? (
        <div id="system-health-detail" className="border-t px-3 pb-3">
          {attentionSignals.length === 0 ? (
            <p className="pt-3 text-xs text-muted-foreground">
              Nothing needs a decision from you here. Signals without recorded activity are shown as
              not measured rather than assumed healthy.
            </p>
          ) : null}
          <ul className="mt-1">
            {data.signals.map((s) => (
              <SignalRow key={s.key} signal={s} />
            ))}
          </ul>
          <p className="pt-1 text-[11px] text-muted-foreground/80">
            <time dateTime={data.fetched_at} title={absTime(data.fetched_at)}>
              Checked {relTime(data.fetched_at)}
            </time>
          </p>
        </div>
      ) : null}
    </section>
  );
}
