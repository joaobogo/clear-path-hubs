/**
 * One decision queue — pure ordering, grouping and labelling.
 *
 * Work reaches a client from several places: new shortlists, interview
 * feedback, offers, and questions from the recruiting team. This module turns
 * those into a single list ordered by what is due now.
 *
 * Rules (fixed, and covered by tests):
 *  - An item may appear only once. Duplicates for the same subject collapse to
 *    the highest-precedence kind.
 *  - Order: due date ascending. Items with no due date sort after every dated
 *    item. Ties break by days waiting, longest first.
 *  - Items already past their due date group at the top under "Overdue".
 *  - A missing due date reads "No deadline", never a blank cell.
 */

export type QueueKind = "decision" | "feedback" | "offer" | "info_request" | "interview";

/** Item type as a plain text label — no colour-only or icon-only meaning. */
export const QUEUE_TYPE_LABEL: Record<QueueKind, string> = {
  decision: "Candidate review",
  feedback: "Interview feedback",
  offer: "Offer response",
  info_request: "Information request",
  interview: "Interview time",
};

/**
 * Collapse precedence when the same subject produces more than one item.
 * Lower wins.
 */
const KIND_PRECEDENCE: Record<QueueKind, number> = {
  feedback: 0,
  offer: 1,
  decision: 2,
  interview: 3,
  info_request: 4,
};

export type QueueItem = {
  /** Stable identity for the row. */
  key: string;
  kind: QueueKind;
  /** What the item concerns: a candidate name, or the subject of a request. */
  concerns: string;
  role_title: string;
  position_id?: string | null;
  /** The subject the item hangs off — used to guarantee one row per subject. */
  subject_id?: string | null;
  /** Recorded due date, when one exists. */
  due_at: string | null;
  /** When the wait started. */
  waiting_since: string | null;
  /** The single action, and the single destination it leads to. */
  action: string;
  to: string;
};

export type QueueRow = QueueItem & {
  type_label: string;
  overdue: boolean;
  /** Whole days waited, or null when the start of the wait is unknown. */
  days_waiting: number | null;
  due_label: string;
};

const DAY = 86_400_000;

function days(from: string | null, nowMs: number): number | null {
  if (!from) return null;
  const t = new Date(from).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / DAY));
}

export function dueLabel(dueAt: string | null, nowMs: number): string {
  if (!dueAt) return "No deadline";
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return "No deadline";
  const diff = Math.round((t - nowMs) / DAY);
  if (diff < -1) return `${Math.abs(diff)} days overdue`;
  if (diff === -1) return "1 day overdue";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}

/** One row per subject; the highest-precedence kind wins. */
export function dedupeQueue(items: QueueItem[]): QueueItem[] {
  const bySubject = new Map<string, QueueItem>();
  const out: QueueItem[] = [];
  for (const item of items) {
    const subject = item.subject_id;
    if (!subject) {
      out.push(item);
      continue;
    }
    const existing = bySubject.get(subject);
    if (!existing || KIND_PRECEDENCE[item.kind] < KIND_PRECEDENCE[existing.kind]) {
      bySubject.set(subject, item);
    }
  }
  // Keyed subjects keep their first-seen position stable enough; ordering is
  // applied by buildQueue afterwards, so insertion order here is not load-bearing.
  return [...out, ...bySubject.values()];
}

export type QueueGroups = {
  overdue: QueueRow[];
  upcoming: QueueRow[];
  total: number;
};

export function buildQueue(items: QueueItem[], now: Date = new Date()): QueueGroups {
  const nowMs = now.getTime();
  const rows: QueueRow[] = dedupeQueue(items).map((item) => {
    const dueMs = item.due_at ? new Date(item.due_at).getTime() : null;
    return {
      ...item,
      type_label: QUEUE_TYPE_LABEL[item.kind],
      overdue: dueMs != null && !Number.isNaN(dueMs) && dueMs < nowMs,
      days_waiting: days(item.waiting_since, nowMs),
      due_label: dueLabel(item.due_at, nowMs),
    };
  });

  const sort = (a: QueueRow, b: QueueRow) => {
    const at = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return (b.days_waiting ?? -1) - (a.days_waiting ?? -1);
  };

  return {
    overdue: rows.filter((r) => r.overdue).sort(sort),
    upcoming: rows.filter((r) => !r.overdue).sort(sort),
    total: rows.length,
  };
}
