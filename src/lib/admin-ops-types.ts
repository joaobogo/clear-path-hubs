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

export type QueueItem = {
  id: string;
  title: string;
  subtitle: string;
  meta: string | null;
  waiting_since: string | null;
  /** Typed destination for the single direct action. */
  target: QueueTarget;
  action_label: string;
  tone: "default" | "warning" | "danger";
  owner: QueueOwner;
  claim: QueueClaim;
};

/** The fixed set of "see all" desks, kept as literals for the same reason. */
export type QueueSeeAll =
  | "/admin/intake"
  | "/admin/payments"
  | "/admin/positions"
  | "/admin/candidates"
  | "/admin/messages"
  | "/admin/operations";

export type WorkQueue = {
  key: string;
  label: string;
  description: string;
  count: number;
  action_hint: string;
  items: QueueItem[];
  see_all?: { to: QueueSeeAll };
};
