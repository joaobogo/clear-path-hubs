import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Activity, AlertTriangle, Clock3, RotateCw } from "lucide-react";
import { getSystemStatus } from "@/lib/control-room.functions";
import { INTEGRATION_STATE_COPY, shortAgo } from "@/lib/control-room-shared";
import { cn } from "@/lib/utils";

/**
 * Prompt 22 — the system status strip.
 * What is running now, what is queued, what failed and is retrying, and when
 * each integration last synced. If something is broken, the client learns it
 * here, from us, before they notice it themselves.
 */
export function SystemStatusStrip({ orgId }: { orgId: string }) {
  const statusFn = useServerFn(getSystemStatus);
  const { data, isPending, isError } = useQuery({
    queryKey: ["system-status", orgId],
    queryFn: () => statusFn({ data: { organization_id: orgId } }),
    refetchInterval: 60_000,
    retry: 2,
    placeholderData: (prev) => prev,
  });

  if (isPending && !data) {
    return (
      <div className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
    );
  }

  if (isError && !data) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        System status is catching up. Everything else on this page is live.
      </div>
    );
  }

  const s = data!;

  if (!s.can_read) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {s.unavailable_reason ??
          "System status isn't available on your seat. Everything else on this page is live."}
      </div>
    );
  }

  const broken = s.failed_total > 0;


  return (
    <section
      aria-label="System status"
      className={cn(
        "rounded-lg border px-4 py-3",
        broken
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Activity
            className={cn(
              "h-4 w-4",
              s.running_total > 0
                ? "text-success"
                : "text-muted-foreground",
            )}
            aria-hidden
          />
          {s.running_total > 0
            ? `${s.running_total} job${s.running_total === 1 ? "" : "s"} running`
            : "Nothing running right now"}
        </span>

        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" aria-hidden />
          {s.queued_total} queued
        </span>

        {s.retrying_total > 0 && (
          <span className="flex items-center gap-1.5 text-warning-strong">
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            {s.retrying_total} retrying
          </span>
        )}

        {s.failed_total > 0 && (
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {s.failed_total} stopped after retrying
          </span>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {s.agents.on} of {s.agents.total} agents on
          {s.agents.paused > 0 ? `, ${s.agents.paused} paused` : ""} ·{" "}
          <Link to="/client/agents" className="underline underline-offset-2">
            Agent control
          </Link>
        </span>
      </div>

      {s.running.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {s.running.map((r) => `${r.label} (${r.count})`).join(" · ")}
        </p>
      )}

      {s.failed_examples.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-destructive">
          {s.failed_examples.map((f, i) => (
            <li key={i}>
              {f.label} stopped {shortAgo(f.at)} ago — {f.message}. We are on it.
            </li>
          ))}
        </ul>
      )}

      {s.integrations.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-2 text-xs">
          {s.integrations.map((i) => {
            const copy =
              INTEGRATION_STATE_COPY[i.state] ??
              INTEGRATION_STATE_COPY.not_connected;
            return (
              <div key={i.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    copy.tone === "ok" && "bg-success",
                    copy.tone === "warn" && "bg-warning",
                    copy.tone === "bad" && "bg-destructive",
                    copy.tone === "idle" && "bg-muted-foreground/40",
                  )}
                />
                <dt className="font-medium">{i.name}</dt>
                <dd className="text-muted-foreground">
                  {copy.label}
                  {i.last_success_at
                    ? ` · last sync ${shortAgo(i.last_success_at)} ago`
                    : ""}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
