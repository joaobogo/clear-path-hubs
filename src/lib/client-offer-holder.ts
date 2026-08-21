/**
 * Offer stage — who owes what. Pure module, safe on client and server.
 *
 * Three rules live here and nowhere else:
 *  1. The current holder is DERIVED from the last recorded event. There is no
 *     manual "whose turn" field to fall out of date.
 *  2. An expected response date is never invented. When none was agreed the
 *     row says so and offers to set one.
 *  3. Nothing here estimates acceptance odds, advises on negotiation, or
 *     benchmarks pay. It reports recorded facts in plain words.
 */
import { calendarDaysUntil } from "@/lib/format/relative-date";

export type OfferHolder = "you" | "candidate" | "taasflow" | "none";

export const HOLDER_LABEL: Record<OfferHolder, string> = {
  you: "You",
  candidate: "Candidate",
  taasflow: "TaaSFlow team",
  none: "Closed",
};

/** The recorded timestamps an offer can carry, plus its status. */
export type OfferEventInput = {
  status: string;
  drafted_at?: string | null;
  sent_at?: string | null;
  negotiating_at?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  hired_at?: string | null;
  closed_at?: string | null;
  last_nudged_at?: string | null;
  start_date?: string | null;
  expected_response_date?: string | null;
  updated_at?: string | null;
};

export type RecordedEvent = {
  /** Stable key for the kind of event, useful for tests and sorting. */
  kind:
    | "drafted"
    | "sent"
    | "negotiating"
    | "accepted"
    | "declined"
    | "hired"
    | "closed"
    | "nudged";
  at: string;
  /** Plain words, past tense, no jargon. */
  label: string;
};

const DAY = 86_400_000;

function ts(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * The last thing that actually happened, chosen by recorded time — not by
 * status. A status without a timestamp cannot produce an event.
 */
export function lastRecordedEvent(offer: OfferEventInput): RecordedEvent | null {
  const candidates: RecordedEvent[] = [];
  const push = (kind: RecordedEvent["kind"], at: string | null | undefined, label: string) => {
    if (at && ts(at) !== null) candidates.push({ kind, at, label });
  };
  push("drafted", offer.drafted_at, "Offer drafted by the recruiting team");
  push("sent", offer.sent_at, "Offer sent to the candidate");
  push("negotiating", offer.negotiating_at, "Candidate came back with questions on terms");
  push("accepted", offer.accepted_at, "Candidate accepted the offer");
  push("declined", offer.declined_at, "Candidate declined the offer");
  push("hired", offer.hired_at, "Hire confirmed");
  push("closed", offer.closed_at, "Offer closed");
  push("nudged", offer.last_nudged_at, "Recruiting team followed up with the candidate");

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, e) => ((ts(e.at) ?? 0) > (ts(latest.at) ?? 0) ? e : latest));
}

/**
 * Whose turn it is, derived from the last recorded event.
 *
 *  - drafted            → TaaSFlow, it has not gone out yet
 *  - sent / nudged      → Candidate, they hold the offer
 *  - negotiating        → You, the terms need your call
 *  - accepted           → TaaSFlow until a start date is recorded, then You
 *  - declined / hired / closed → nobody, the offer is finished
 */
export function offerHolder(offer: OfferEventInput): {
  holder: OfferHolder;
  label: string;
  because: string;
} {
  const event = lastRecordedEvent(offer);
  if (!event) {
    return {
      holder: "taasflow",
      label: HOLDER_LABEL.taasflow,
      because: "Nothing recorded on this offer yet",
    };
  }
  switch (event.kind) {
    case "drafted":
      return { holder: "taasflow", label: HOLDER_LABEL.taasflow, because: event.label };
    case "sent":
    case "nudged":
      return { holder: "candidate", label: HOLDER_LABEL.candidate, because: event.label };
    case "negotiating":
      return { holder: "you", label: HOLDER_LABEL.you, because: event.label };
    case "accepted":
      return offer.start_date
        ? { holder: "you", label: HOLDER_LABEL.you, because: "Start date agreed — confirm onboarding" }
        : { holder: "taasflow", label: HOLDER_LABEL.taasflow, because: "Confirming the start date" };
    case "declined":
    case "hired":
    case "closed":
    default:
      return { holder: "none", label: HOLDER_LABEL.none, because: event.label };
  }
}

export type ResponseDate = {
  /** The agreed date, or null when none was agreed. */
  date: string | null;
  /** Plain words for the cell. Never blank. */
  label: string;
  /** True only when a real date exists and it has passed. */
  overdue: boolean;
  days_late: number | null;
};

/** Reads the agreed response date. Nothing is inferred when none exists. */
export function expectedResponse(
  offer: OfferEventInput,
  now: Date = new Date(),
): ResponseDate {
  const raw = offer.expected_response_date ?? null;
  const t = raw ? ts(`${raw.slice(0, 10)}T23:59:59Z`) : null;
  if (!raw || t === null) {
    return { date: null, label: "No response date agreed", overdue: false, days_late: null };
  }
  const diff = calendarDaysUntil(new Date(t), now) ?? 0;
  if (diff < 0) {
    const late = Math.abs(diff);
    return {
      date: raw,
      label: late === 1 ? "1 day overdue" : `${late} days overdue`,
      overdue: true,
      days_late: late,
    };
  }
  return {
    date: raw,
    label: diff === 0 ? "Response expected today" : `Response expected in ${diff} days`,
    overdue: false,
    days_late: null,
  };
}

/** Offers that are still live — anything else is history. */
const OPEN: readonly string[] = [
  "offer_drafted",
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
];

export function isOpenOffer(status: string): boolean {
  return OPEN.includes(status);
}

export type OfferRow = {
  holder: OfferHolder;
  holder_label: string;
  holder_because: string;
  last_event: RecordedEvent | null;
  last_event_label: string;
  response: ResponseDate;
  open: boolean;
  /** Set only when a real date has passed on a live offer. */
  needs_attention: boolean;
};

/** Everything a row needs, in one call, from recorded facts only. */
export function buildOfferRow(offer: OfferEventInput, now: Date = new Date()): OfferRow {
  const { holder, label, because } = offerHolder(offer);
  const response = expectedResponse(offer, now);
  const last = lastRecordedEvent(offer);
  const open = isOpenOffer(offer.status);
  return {
    holder,
    holder_label: label,
    holder_because: because,
    last_event: last,
    last_event_label: last?.label ?? "Nothing recorded yet",
    response,
    open,
    needs_attention: open && response.overdue,
  };
}

/** Open offers first, then most overdue, then oldest movement. */
export function byOfferUrgency(
  a: OfferEventInput,
  b: OfferEventInput,
  now: Date = new Date(),
): number {
  const ra = buildOfferRow(a, now);
  const rb = buildOfferRow(b, now);
  if (ra.open !== rb.open) return ra.open ? -1 : 1;
  const la = ra.response.days_late ?? -1;
  const lb = rb.response.days_late ?? -1;
  if (la !== lb) return lb - la;
  return (ts(a.updated_at) ?? 0) - (ts(b.updated_at) ?? 0);
}
