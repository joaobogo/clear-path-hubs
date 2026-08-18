/**
 * Shapes shared between the admin work-queue loader and its UI.
 *
 * Client-safe on purpose: the queue row component needs these types, and it must
 * not import the server module that builds them.
 */

/**
 * Where a queue row goes. A discriminated union, not a loose route string, so
 * the action links are type-checked against the real route tree: rename a route
 * and the build fails instead of the row 404ing at runtime.
 */
export type QueueTarget =
  | { kind: "intake"; id: string }
  | { kind: "position"; id: string }
  | { kind: "review"; matchId: string }
  | { kind: "match"; id: string };

/** Who holds this row today, resolved from the governing position or intake. */
export type QueueOwner = { user_id: string; name: string } | null;

/** What "claim" writes to. Null when the row has no ownable parent record. */
export type QueueClaim = { kind: "position" | "intake"; id: string } | null;

/**
 * A labelled pointer used for the queue row's title and subtitle segments, so
 * the position title and the account name open their own records (P0.1) while
 * plain segments stay text. Ids are exact record ids, never name matches.
 */
export type QueueRef =
  | { kind: "position"; id: string; label: string }
  | { kind: "organization"; id: string; label: string }
  | { kind: "text"; label: string };

export type QueueItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string | null;
  waiting_since: string | null;
  /** Internal queue key, for context-aware rendering. */
  key?: string;
  /** Typed destination for the single direct action. */
  target: QueueTarget;
  action_label: string;
  tone: "default" | "warning" | "danger";
  owner: QueueOwner;
  claim: QueueClaim;
  /**
   * Set when the governing position has a live, unacknowledged commitment
   * breach. Derived from `position_commitments` against real pipeline rows —
   * never a forecast. Rows carrying one sort to the top of their queue.
   */
  sla_breach?: { metric_label: string; days_over: number } | null;
  /** Linkable version of `title`. Falls back to plain text when absent. */
  title_ref?: QueueRef | null;
  /** Linkable segments of `subtitle`, rendered joined by "·". */
  subtitle_refs?: QueueRef[] | null;

};

/** The fixed set of "see all" desks, kept as literals for the same reason. */
export type QueueSeeAll =
  | "/admin/intake"
  | "/admin/payments"
  | "/admin/positions"
  | "/admin/candidates"
  | "/admin/messages"
  | "/admin/operations"
  | "/admin/scoring/review";

export type WorkQueue = {
  key: string;
  label: string;
  description: string;
  count: number;
  action_hint: string;
  items: QueueItem[];
  see_all?: { to: QueueSeeAll };
  secondary_badge?: { label: string; tone: "default" | "neutral" | "warning" | "danger" } | null;
};
