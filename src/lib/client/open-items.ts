/**
 * "Your open items" — everything the client still owes us, in one place.
 *
 * Pure shaping and ordering. Three kinds of debt only, each traceable to a
 * stored row: an unanswered information request, a candidate waiting on a
 * decision, and an interview that happened with no feedback recorded. Nothing
 * here is invented, and nothing is nagged about twice.
 */

export type OpenItemKind = "info_request" | "pending_decision" | "missing_feedback" | "offer" | "interview";

export type OpenItem = {
  kind: OpenItemKind;
  id: string;
  /** Stable identity for the row — used to guarantee one row per subject. */
  subject_id?: string | null;
  /** What the client reads. */
  label: string;
  /** Extra line: the role, or who asked. */
  context: string | null;
  href: string;
  /** When it is due, if we committed to a date. */
  due_at: string | null;
  /** Derived from due_at. */
  overdue: boolean;
  /** When the wait started. */
  waiting_since?: string | null;
};

export const OPEN_ITEM_LABEL: Record<OpenItemKind, string> = {
  info_request: "Information requests",
  pending_decision: "Decisions waiting",
  missing_feedback: "Feedback missing",
  offer: "Offer responses",
  interview: "Interview times",
};

export function isOverdue(due_at: string | null, now = Date.now()): boolean {
  if (!due_at) return false;
  const t = new Date(due_at).getTime();
  return Number.isFinite(t) && t < now;
}

/**
 * Precedence when the same subject (e.g. candidate) has multiple items.
 * Lower wins.
 */
const KIND_PRECEDENCE: Record<OpenItemKind, number> = {
  missing_feedback: 0,
  offer: 1,
  pending_decision: 2,
  interview: 3,
  info_request: 4,
};

/** One item per subject; the highest-precedence kind wins. */
export function dedupeOpenItems(items: OpenItem[]): OpenItem[] {
  const bySubject = new Map<string, OpenItem>();
  const out: OpenItem[] = [];
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
  return [...out, ...bySubject.values()];
}

/** Overdue first, then earliest due date, then the ones with no date. */
export function sortOpenItems(items: OpenItem[]): OpenItem[] {
  return [...items].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const at = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
    return at - bt;
  });
}

export function countByKind(items: OpenItem[]): Record<OpenItemKind, number> {
  const out: Record<OpenItemKind, number> = {
    info_request: 0,
    pending_decision: 0,
    missing_feedback: 0,
    offer: 0,
    interview: 0,
  };
  for (const i of items) out[i.kind] += 1;
  return out;
}

export function dueLabel(item: OpenItem, nowMs = Date.now()): string {
  if (!item.due_at) return "No deadline";
  const t = new Date(item.due_at).getTime();
  if (!Number.isFinite(t)) return "No deadline";
  const diff = Math.round((t - nowMs) / 86_400_000);
  if (diff < -1) return `${Math.abs(diff)} days overdue`;
  if (diff === -1) return "1 day overdue";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff} days`;
}
