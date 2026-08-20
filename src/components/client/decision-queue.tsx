import * as React from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QueueRow } from "@/lib/client-decision-queue";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";

/**
 * The one decision queue.
 *
 * Everything that needs the client — candidate reviews, interview feedback,
 * offer responses, information requests — arrives in this single list, ordered
 * by what is due now. Overdue work groups at the top. Each row carries the
 * role, the item type as text, what it concerns, its due date and how long it
 * has waited, and leads to exactly one destination.
 *
 * Marking a row handled removes it immediately and offers an undo for a short
 * window. It hides the row here only; the underlying work is completed at its
 * destination and disappears on the next load either way.
 */

const UNDO_MS = 8000;

export type QueueMeta = {
  checked: number;
  overdue: number;
  next_expected_at: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return formatDate(Date(iso));
}

function waitingLabel(days: number | null): string {
  if (days == null) return "Just arrived";
  if (days === 0) return "Waiting today";
  return days === 1 ? "Waiting 1 day" : `Waiting ${days} days`;
}

function useHandled(orgId: string | null | undefined) {
  const storageKey = orgId ? `client:queueHandled:${orgId}` : null;
  const [handled, setHandled] = React.useState<Set<string>>(new Set());
  const [pending, setPending] = React.useState<{ key: string; until: number } | null>(null);
  const timer = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setHandled(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setHandled(new Set());
    }
  }, [storageKey]);

  const persist = React.useCallback(
    (next: Set<string>) => {
      setHandled(new Set(next));
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch {
        /* a full or blocked store must not break the queue */
      }
    },
    [storageKey],
  );

  const markHandled = (key: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setPending({ key, until: Date.now() + UNDO_MS });
    timer.current = window.setTimeout(() => {
      setPending(null);
      persist(new Set([...handled, key]));
    }, UNDO_MS);
  };

  const undo = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setPending(null);
  };

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { hidden: handled, pending, markHandled, undo };
}

function UndoBar({ onUndo, until }: { onUndo: () => void; until: number }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        Removed from your queue · you can put it back for {left}s
      </span>
      <Button size="sm" variant="outline" className="ml-auto h-8 gap-1.5" onClick={onUndo}>
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </Button>
    </div>
  );
}

function QueueRowItem({
  row,
  search,
  onHandled,
}: {
  row: QueueRow;
  search?: Record<string, string>;
  onHandled: () => void;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:px-5">
      <Link
        to={row.to as never}
        search={search as never}
        className="group min-w-0"
        aria-label={`${row.type_label} — ${row.concerns}, ${row.role_title}. ${row.action}.`}
      >
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="truncate text-[15px] font-semibold leading-snug group-hover:text-primary">
            {row.concerns}
          </span>
          <span className="truncate text-sm text-muted-foreground">· {row.role_title}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground sm:text-[13px]">
          <span className="font-medium text-foreground">{row.type_label}</span>
          <span aria-hidden="true">·</span>
          <span className={row.overdue ? "font-medium taas-fg-warning" : undefined}>
            {row.due_label}
            {row.due_at ? ` (${fmtDate(row.due_at)})` : ""}
          </span>
          <span aria-hidden="true">·</span>
          <span>{waitingLabel(row.days_waiting)}</span>
        </span>
      </Link>
      <span className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={onHandled}>
          Done
        </Button>
        <Link to={row.to as never} search={search as never} aria-label={row.action}>
          <Button size="sm" variant="outline" className="h-9 gap-1 text-xs">
            <span className="hidden sm:inline">{row.action}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </span>
    </li>
  );
}

export function DecisionQueue({
  rows,
  meta,
  loading,
  isError,
  onRetry,
  orgId,
  orgSearch,
}: {
  rows: QueueRow[];
  meta: QueueMeta | null | undefined;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
  orgId: string | null | undefined;
  orgSearch?: string | null;
}) {
  const { hidden, pending, markHandled, undo } = useHandled(orgId);
  const search = orgSearch ? { org: orgSearch } : undefined;

  const visible = rows.filter((r) => !hidden.has(r.key) && pending?.key !== r.key);
  const overdue = visible.filter((r) => r.overdue);
  const upcoming = visible.filter((r) => !r.overdue);

  if (loading) {
    return (
      <section aria-labelledby="queue-heading" className="space-y-3">
        <h2
          id="queue-heading"
          className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          What needs you
        </h2>
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
        <span className="sr-only">Loading your queue</span>
      </section>
    );
  }

  // An error never renders as "nothing needs you".
  if (isError) {
    return (
      <section
        aria-labelledby="queue-heading"
        className="rounded-xl border taas-bd-warning taas-bg-warning-soft p-4"
        role="alert"
      >
        <h2 id="queue-heading" className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-4 w-4 taas-fg-warning" aria-hidden="true" />
          We could not load your queue
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing has been lost. Try again, and it will load if the connection is back.
        </p>
        <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </section>
    );
  }

  if (visible.length === 0) {
    return (
      <section aria-labelledby="queue-heading" className="space-y-3">
        {pending ? <UndoBar until={pending.until} onUndo={undo} /> : null}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full taas-bg-success-soft taas-fg-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="queue-heading" className="text-lg font-semibold">
                Nothing needs you today
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {meta
                  ? `${meta.checked} item${meta.checked === 1 ? "" : "s"} checked.`
                  : "Your queue is clear."}
                {meta?.next_expected_at
                  ? ` Next delivery expected ${fmtDate(meta.next_expected_at)}.`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="queue-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="queue-heading"
          className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          What needs you
        </h2>
        <span className="text-xs text-muted-foreground">
          {visible.length} item{visible.length === 1 ? "" : "s"}, soonest first
        </span>
      </div>

      {pending ? <UndoBar until={pending.until} onUndo={undo} /> : null}

      {overdue.length > 0 && (
        <div className="overflow-hidden rounded-xl border taas-bd-warning">
          <h3 className="flex items-center gap-2 border-b taas-bg-warning-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] taas-fg-warning sm:px-5">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Overdue · {overdue.length}
          </h3>
          <ul className="divide-y bg-card">
            {overdue.map((r) => (
              <QueueRowItem
                key={r.key}
                row={r}
                search={search}
                onHandled={() => markHandled(r.key)}
              />
            ))}
          </ul>
        </div>
      )}

      {upcoming.length > 0 && (
        <ul className={cn("divide-y overflow-hidden rounded-xl border bg-card")}>
          {upcoming.map((r) => (
            <QueueRowItem
              key={r.key}
              row={r}
              search={search}
              onHandled={() => markHandled(r.key)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
