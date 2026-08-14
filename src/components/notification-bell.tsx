import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, Check, ChevronRight, Info, Zap } from "lucide-react";
import {
  dismissNotifications,
  listMyNotifications,
  markNotificationsRead,
} from "@/lib/notifications.functions";
import {
  NOTIFICATION_TIERS,
  TIER_META,
  actorLabel,
  canDismiss,
  groupNotifications,
  relativeTime,
  type NotificationGroup,
  type NotificationRecord,
  type NotificationTier,
} from "@/lib/notifications/notification-tiers";
import { Button } from "@/components/ui/button";
import {
  deliveryChipClass,
  deliveryNotice,
  normaliseDeliveryStatus,
  type DeliveryState,
} from "@/lib/notifications/delivery-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { staggerStyle, useArrivals, useJustChanged } from "@/lib/motion/use-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toastError } from "@/lib/toast-error";

export const NOTIFICATIONS_QUERY_KEY = ["notifications", "mine"] as const;

type Filter = "all" | "unread" | NotificationTier;

const TIER_ICON: Record<NotificationTier, typeof Bell> = {
  critical: AlertTriangle,
  action_required: Zap,
  important: Bell,
  informational: Info,
};

export function NotificationBell() {
  const list = useServerFn(listMyNotifications);
  const mark = useServerFn(markNotificationsRead);
  const dismiss = useServerFn(dismissNotifications);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => list(),
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

  const markMutation = useMutation({
    mutationFn: (ids?: string[]) => mark({ data: { ids } }),
    onSuccess: invalidate,
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't mark. Nothing was saved — please try again." }),
  });
  const dismissMutation = useMutation({
    mutationFn: (ids: string[]) => dismiss({ data: { ids } }),
    onSuccess: invalidate,
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't dismiss. Nothing was saved — please try again." }),
  });

  const items = (data?.items ?? []) as NotificationRecord[];
  const groups = useMemo(() => groupNotifications(items), [items]);
  const unread = data?.unread ?? 0;
  // The badge marks that something arrived; the list marks which rows are new.
  const unreadChanged = useJustChanged(unread);
  const arrivals = useArrivals(useMemo(() => items.map((i) => i.id), [items]));

  const counts = useMemo(() => {
    const c: Record<NotificationTier, number> = {
      critical: 0,
      action_required: 0,
      important: 0,
      informational: 0,
    };
    for (const g of groups) c[g.tier] += g.unread || 1;
    return c;
  }, [groups]);

  const needsAttention = counts.critical + counts.action_required;

  const visible = groups.filter((g) => {
    if (filter === "all") return true;
    if (filter === "unread") return g.unread > 0;
    return g.tier === filter;
  });

  return (
    // Controlled so the panel always opens on the FIRST click: an overlay that
    // is still tearing down (search dialog, menu) used to swallow the initial
    // pointer event and leave the trigger closed.
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onPointerDown={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          onClick={(e) => e.preventDefault()}
          className="relative h-11 w-11 sm:h-9 sm:w-9"
          aria-label={
            unread > 0
              ? `Notifications, ${unread} unread${needsAttention > 0 ? `, ${needsAttention} need attention` : ""}`
              : "Notifications, none unread"
          }
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                unreadChanged ? "motion-approved" : ""
              } ${
                counts.critical > 0
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[26rem] p-0">
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Notifications</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {needsAttention > 0
                  ? `${needsAttention} ${needsAttention === 1 ? "item needs" : "items need"} your attention.`
                  : "Nothing is waiting on you."}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={unread === 0 || markMutation.isPending}
              onClick={() => markMutation.mutate(undefined)}
            >
              Mark all read
            </Button>
          </div>

          <div
            className="flex flex-wrap gap-1 mt-3"
            role="group"
            aria-label="Filter notifications"
          >
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterChip>
            <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")}>
              Unread {unread > 0 ? `(${unread})` : ""}
            </FilterChip>
            {NOTIFICATION_TIERS.filter((t) => counts[t] > 0).map((t) => (
              <FilterChip key={t} active={filter === t} onClick={() => setFilter(t)}>
                {TIER_META[t].label} ({counts[t]})
              </FilterChip>
            ))}
          </div>
        </div>

        <ScrollArea className="max-h-[26rem]">
          {isPending ? (
            <ul className="divide-y" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="px-4 py-3 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                </li>
              ))}
            </ul>
          ) : isError ? (
            <div className="px-4 py-8 text-center text-sm">
              <p className="font-medium">We could not load your notifications.</p>
              <p className="mt-1 text-muted-foreground">
                This is a load failure, not an empty inbox — nothing was dismissed.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                {isFetching ? "Retrying…" : "Try again"}
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {filter === "all"
                ? "You're all caught up."
                : "Nothing in this view right now."}
            </div>
          ) : (
            <ul className="divide-y motion-content-in">
              {visible.map((group, i) => (
                <NotificationRow
                  key={group.key}
                  group={group}
                  isNew={group.items.some((n) => arrivals.has(n.id))}
                  index={i}
                  onRead={(ids) => markMutation.mutate(ids)}
                  onDismiss={(ids) => dismissMutation.mutate(ids)}
                  busy={dismissMutation.isPending}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? "bg-foreground text-background border-transparent"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function NotificationRow({
  group,
  onRead,
  onDismiss,
  busy,
  isNew = false,
  index = 0,
}: {
  group: NotificationGroup;
  onRead: (ids: string[]) => void;
  onDismiss: (ids: string[]) => void;
  busy: boolean;
  /** Arrived since the last time this list was read. */
  isNew?: boolean;
  index?: number;
}) {
  const { lead, rule, tier, items, unread } = group;
  const meta = TIER_META[tier];
  const Icon = TIER_ICON[tier];
  const extra = items.length - 1;
  const actor = actorLabel(lead.actor_label, null);
  // Worst delivery state in the group: a bounced email must not hide behind a
  // sibling notification that went out fine.
  const delivery = deliveryNotice(worstDeliveryState(items.map((n) => n.delivery_state)));

  const body = (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          tier === "critical" ? "text-destructive" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
      <div className={`min-w-0 flex-1 ${unread === 0 ? "opacity-80" : ""}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
          {unread > 0 && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />
          )}
          {extra > 0 && (
            <span className="text-[10px] text-muted-foreground">
              +{extra} more in {rule.group.toLowerCase()}
            </span>
          )}
        </div>

        {/* What happened */}
        <div className="mt-1 text-sm font-medium leading-snug">{lead.title}</div>
        {lead.body && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{lead.body}</div>
        )}

        {/* What it affects · why it matters */}
        <dl className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
          <div className="flex gap-1">
            <dt className="font-medium text-foreground/70">Affects</dt>
            <dd className="min-w-0">{rule.affects}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium text-foreground/70">Why</dt>
            <dd className="min-w-0">{rule.why}</dd>
          </div>
        </dl>

        {/* Actor and time */}
        <div
          className="mt-1.5 text-[10px] text-muted-foreground"
          title={new Date(lead.created_at).toLocaleString()}
        >
          {actor} · {relativeTime(group.latestAt)}
        </div>

        {delivery && delivery.prominent && (
          <div
            className={`mt-1.5 rounded border px-2 py-1 text-[11px] ${deliveryChipClass(delivery.tone)}`}
          >
            <span className="font-semibold">{delivery.label}.</span> {delivery.detail}
          </div>
        )}

        <div className="mt-2 flex items-center gap-3">
          {rule.action && lead.link_path && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              {rule.action}
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
          {canDismiss(tier) ? (
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground disabled:opacity-50"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDismiss(group.ids);
              }}
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              {rule.dismissal === "on_action" ? "Mark handled" : "Clear"}
            </button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Stays until resolved
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const unreadIds = items.filter((i) => !i.read_at).map((i) => i.id);

  return (
    <li
      style={isNew ? staggerStyle(index) : undefined}
      className={`border-l-2 ${meta.accentClass} hover:bg-muted/50 ${
        isNew ? "motion-arrive" : ""
      }`}
    >
      {lead.link_path ? (
        <Link
          to={lead.link_path}
          onClick={() => unreadIds.length > 0 && onRead(unreadIds)}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

const DELIVERY_SEVERITY: DeliveryState[] = ["bounced", "suppressed", "failed", "pending", "sent"];

function worstDeliveryState(states: Array<string | null | undefined>): DeliveryState | null {
  const normalised = states
    .map((s) => normaliseDeliveryStatus(s))
    .filter((s): s is DeliveryState => s !== null);
  for (const candidate of DELIVERY_SEVERITY) {
    if (normalised.includes(candidate)) return candidate;
  }
  return null;
}
