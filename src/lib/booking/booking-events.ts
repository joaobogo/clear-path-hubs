/**
 * Booking funnel analytics. One helper per stage so no surface invents its own
 * event name, and each conversion-grade event fires at most once per session
 * (reloads, back-button, and repeated Calendly postMessages are deduped).
 */
import { BRAND_DOMAIN, BRAND_KEY, getJourneyId } from "@/lib/crm/attribution";
import { trackEvent } from "@/lib/tracking/pixels";

export const BOOKING_EVENTS = {
  ctaClicked: "booking_cta_clicked",
  pageViewed: "booking_page_viewed",
  intakeStarted: "intake_started",
  intakeCompleted: "intake_completed",
  schedulerLoaded: "scheduler_loaded",
  timeSelected: "time_selected",
  completed: "booking_completed",
  failed: "booking_failed",
  abandoned: "booking_abandoned",
  rescheduled: "booking_rescheduled",
  canceled: "booking_canceled",
} as const;

export type BookingEventName = (typeof BOOKING_EVENTS)[keyof typeof BOOKING_EVENTS];

export type BookingEventContext = {
  /** Where the visitor clicked from, e.g. "header_nav". */
  ctaLocation?: string | null;
  /** Page that originated the journey. */
  originPage?: string | null;
  meetingType?: string | null;
  bookingSessionId?: string | null;
  step?: string | null;
  reason?: string | null;
};

const DEDUPE_KEY = "taasflow.booking.events";
/** Events that must never double-count a conversion. */
const ONCE: readonly BookingEventName[] = [
  BOOKING_EVENTS.intakeCompleted,
  BOOKING_EVENTS.completed,
];

function firedSet(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(DEDUPE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function remember(key: string) {
  if (typeof sessionStorage === "undefined") return;
  try {
    const set = firedSet();
    set.add(key);
    sessionStorage.setItem(DEDUPE_KEY, JSON.stringify([...set].slice(-40)));
  } catch {
    /* storage disabled — dedupe degrades, tracking still works */
  }
}

export function trackBooking(name: BookingEventName, context: BookingEventContext = {}) {
  if (typeof window === "undefined") return;
  if (ONCE.includes(name)) {
    const key = `${name}:${context.bookingSessionId ?? "anon"}`;
    if (firedSet().has(key)) return;
    remember(key);
  }
  trackEvent(name, {
    brand_key: BRAND_KEY,
    source_domain: BRAND_DOMAIN,
    page_path: window.location.pathname,
    fgv_journey_id: getJourneyId() ?? undefined,
    cta_location: context.ctaLocation ?? undefined,
    origin_page: context.originPage ?? undefined,
    meeting_type: context.meetingType ?? undefined,
    booking_session_id: context.bookingSessionId ?? undefined,
    booking_step: context.step ?? undefined,
    failure_reason: context.reason ?? undefined,
  });
}

/** Clears dedupe state so a genuinely new booking can convert again. */
export function resetBookingFunnel() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(DEDUPE_KEY);
  } catch {
    /* noop */
  }
}
