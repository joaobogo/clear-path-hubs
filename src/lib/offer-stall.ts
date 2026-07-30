// Stalled-offer detection. Pure module — safe on client and server.
//
// An offer is "stalled" when it has been sitting in a live stage (drafted,
// sent, negotiating, accepted-but-unconfirmed) for longer than the stage's
// tolerance, and has not been nudged since it went quiet.

export const STALL_HOURS = 48;

const HOUR_MS = 3_600_000;

export type StallableStatus =
  | "offer_drafted"
  | "offer_sent"
  | "offer_negotiating"
  | "offer_accepted";

const LIVE: readonly string[] = [
  "offer_drafted",
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
];

export interface StallInput {
  status: string;
  drafted_at?: string | null;
  sent_at?: string | null;
  negotiating_at?: string | null;
  accepted_at?: string | null;
  updated_at?: string | null;
  last_nudged_at?: string | null;
}

/** Timestamp the current stage was entered. */
export function stageEnteredAt(h: StallInput): string | null {
  switch (h.status) {
    case "offer_drafted":
      return h.drafted_at ?? h.updated_at ?? null;
    case "offer_sent":
      return h.sent_at ?? h.updated_at ?? null;
    case "offer_negotiating":
      return h.negotiating_at ?? h.updated_at ?? null;
    case "offer_accepted":
      return h.accepted_at ?? h.updated_at ?? null;
    default:
      return h.updated_at ?? null;
  }
}

/** Hours since the last meaningful movement (stage entry or nudge). */
export function hoursSinceMovement(h: StallInput, now: Date = new Date()): number | null {
  const entered = stageEnteredAt(h);
  const marks = [entered, h.last_nudged_at]
    .filter(Boolean)
    .map((t) => new Date(t as string).getTime())
    .filter((n) => Number.isFinite(n));
  if (marks.length === 0) return null;
  const last = Math.max(...marks);
  return Math.max(0, (now.getTime() - last) / HOUR_MS);
}

export function isLiveOffer(status: string): boolean {
  return LIVE.includes(status);
}

/** True when a live offer has had no movement for longer than STALL_HOURS. */
export function isStalled(h: StallInput, now: Date = new Date()): boolean {
  if (!isLiveOffer(h.status)) return false;
  const hours = hoursSinceMovement(h, now);
  return hours != null && hours >= STALL_HOURS;
}

/** "no movement for 3 days" / "no movement for 52 hours". */
export function stallLabel(h: StallInput, now: Date = new Date()): string {
  const hours = hoursSinceMovement(h, now);
  if (hours == null) return "";
  if (hours < 48) return `${Math.floor(hours)}h since last movement`;
  const days = Math.floor(hours / 24);
  return `no movement for ${days} days`;
}

/** Sort helper: most stalled first. */
export function byStallDesc(a: StallInput, b: StallInput, now: Date = new Date()): number {
  return (hoursSinceMovement(b, now) ?? 0) - (hoursSinceMovement(a, now) ?? 0);
}
