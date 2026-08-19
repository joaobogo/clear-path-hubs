/**
 * One work-queue row: what it is, how long it has waited, who holds it, and the
 * single action that clears it.
 *
 * The destination is a discriminated union rather than a route string, so every
 * link below is checked against the real route tree at build time.
 */
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimWorkQueueItem } from "@/lib/admin-ops.functions";
import type { QueueItem, QueueRef, QueueTarget } from "@/lib/admin-ops-types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Renders a queue ref as a link to its exact record, or plain text. */
function RefLabel({
  ref: r,
  className,
  suppressLink = false,
}: {
  ref: QueueRef;
  className?: string;
  suppressLink?: boolean;
}) {
  if (r.kind === "position" && !suppressLink) {
    return (
      <Link
        to="/admin/positions/$id"
        params={{ id: r.id }}
        className={cn("hover:underline", className)}
      >
        {r.label}
      </Link>
    );
  }
  if (r.kind === "organization" && !suppressLink) {
    return (
      <Link
        to="/admin/clients/$id"
        params={{ id: r.id }}
        className={cn("hover:underline font-medium text-foreground", className)}
      >
        {r.label}
      </Link>
    );
  }
  return <span className={className}>{r.label}</span>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function toneClass(tone: QueueItem["tone"]) {
  if (tone === "danger") return "text-destructive";
  if (tone === "warning") return "text-warning-foreground";
  return "text-muted-foreground";
}

import { formatRelative } from "@/lib/format/datetime";
function waited(iso: string | null | undefined): string {
  return formatRelative(iso);
}

function TargetLink({ target, children }: { target: QueueTarget; children: React.ReactNode }) {
  switch (target.kind) {
    case "intake":
      return (
        <Link to="/admin/intake/$id" params={{ id: target.id }}>
          {children}
        </Link>
      );
    case "position":
      return (
        <Link to="/admin/positions/$id" params={{ id: target.id }}>
          {children}
        </Link>
      );
    case "review":
      return (
        <Link to="/admin/review/$matchId" params={{ matchId: target.matchId }}>
          {children}
        </Link>
      );
    case "match":
      return (
        <Link to="/admin/candidates/$id" params={{ id: target.id }}>
          {children}
        </Link>
      );
    case "approval":
      if (target.target_kind === "position") {
        return (
          <Link to="/admin/positions/$id" params={{ id: target.target_id }}>
            {children}
          </Link>
        );
      }
      return (
        <Link to="/admin/candidates/$id" params={{ id: target.target_id }}>
          {children}
        </Link>
      );
  }
}

function OwnerCell({ item }: { item: QueueItem }) {
  const claim = useServerFn(claimWorkQueueItem);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => claim({ data: item.claim! }),
    onSuccess: async () => {
      toast.success("You own this now.");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => toast.error("Could not claim this item."),
  });

  if (item.owner) {
    return (
      <span className="flex shrink-0 items-center gap-1.5" title={`Owned by ${item.owner.name}`}>
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground"
        >
          {initials(item.owner.name)}
        </span>
        <span className="hidden max-w-[9rem] truncate text-xs text-muted-foreground sm:inline">
          {item.owner.name}
        </span>
      </span>
    );
  }

  if (!item.claim) {
    return <span className="shrink-0 text-xs text-muted-foreground">Unassigned</span>;
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 shrink-0 gap-1 px-2 text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <UserPlus className="h-3 w-3" />
      {mutation.isPending ? "Claiming…" : "Claim"}
    </Button>
  );
}

import { pluralize } from "@/lib/format/datetime";
export function WorkQueueRow({
  item,
  secondary_badge,
}: {
  item: QueueItem;
  secondary_badge?: { label: string; tone: "default" | "neutral" | "warning" | "danger" } | null;
}) {
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">
            <TargetLink target={item.target}>
              {item.title_ref ? (
                <RefLabel
                  ref={item.title_ref}
                  className="text-foreground hover:underline"
                  suppressLink
                />
              ) : (
                <span className="hover:underline">{item.title}</span>
              )}
            </TargetLink>
          </span>
          {item.sla_breach ? (
            <span
              className="shrink-0 rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive"
              title={`${item.sla_breach.metric_label} promise missed ${pluralize(item.sla_breach.days_over, "day")} ago`}
            >
              SLA +{item.sla_breach.days_over}d
            </span>
          ) : null}
          {secondary_badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                secondary_badge.tone === "default" && "bg-primary/10 text-primary border border-primary/20",
                secondary_badge.tone === "neutral" && "bg-muted text-muted-foreground border",
                secondary_badge.tone === "warning" && "bg-warning/10 text-warning-foreground border border-warning/20",
                secondary_badge.tone === "danger" && "bg-destructive/10 text-destructive border border-destructive/20"
              )}
            >
              {secondary_badge.label}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {item.subtitle_refs?.length ? (
            item.subtitle_refs.map((r, i) => (
              <span key={`${r.kind}-${i}`}>
                {i > 0 ? " · " : ""}
                <RefLabel ref={r} />
              </span>
            ))
          ) : (
            <span>{item.subtitle}</span>
          )}
          {item.meta ? (
            item.key === "unpaid" ? (
              <>
                {" · "}
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[9px] font-semibold uppercase leading-none border-primary/20 bg-primary/10 text-primary",
                  )}
                >
                  {item.meta}
                </Badge>
              </>
            ) : (
              ` · ${item.meta}`
            )
          ) : (
            ""
          )}
        </div>
      </div>

      <OwnerCell item={item} />
      <span className={cn("shrink-0 tabular-nums text-xs", toneClass(item.tone))} title="Waiting">
        {item.key === 'score_stale' ? 'Stale' : waited(item.waiting_since)}
      </span>
      <Button asChild size="sm" variant="secondary" className="h-7 shrink-0 text-xs">
        <TargetLink target={item.target}>
          {item.action_label}
          <ArrowRight className="ml-1 h-3 w-3" />
        </TargetLink>
      </Button>
    </li>
  );
}
