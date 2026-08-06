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
import type { QueueItem, QueueTarget } from "@/lib/admin-ops.server";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function toneClass(tone: QueueItem["tone"]) {
  if (tone === "danger") return "text-destructive";
  if (tone === "warning") return "text-warning-foreground";
  return "text-muted-foreground";
}

function waited(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
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

export function WorkQueueRow({ item }: { item: QueueItem }) {
  return (
    <li className="group flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {item.subtitle}
          {item.meta ? ` · ${item.meta}` : ""}
        </div>
      </div>
      <OwnerCell item={item} />
      <span className={`shrink-0 tabular-nums text-xs ${toneClass(item.tone)}`} title="Waiting">
        {waited(item.waiting_since)}
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
