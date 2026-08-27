/**
 * Canonical booking configuration — client-safe.
 *
 * ONE destination for every "book a call / demo / talk to sales" CTA on the
 * site: BOOKING_ROUTE. It renders the native TaaSFlow scheduler, which reads
 * real availability from our own scheduling settings. No third-party embed and
 * no hardcoded personal calendar link may live here.
 *
 * Controls that open the contact form must say so in their label ("Send us a
 * message"), never "Book a call".
 */

export const BOOKING_ROUTE = "/book" as const;

/** Legacy/duplicate paths that must land on the canonical flow. */
export const LEGACY_BOOKING_PATHS: readonly string[] = [
  "/book-call",
  "/book-a-call",
  "/schedule",
  "/demo",
];

export type MeetingTypeId = "discovery" | "demo";

export type MeetingType = {
  id: MeetingTypeId;
  /** Visitor-facing name. */
  name: string;
  /** Nominal duration, for copy only — real slots come from the scheduler. */
  durationLabel: string;
  summary: string;
  agenda: readonly string[];
  prepare: readonly string[];
};

export const MEETING_TYPES: Record<MeetingTypeId, MeetingType> = {
  discovery: {
    id: "discovery",
    name: "Hiring discovery call",
    durationLabel: "20 minutes",
    summary:
      "We map the roles you're hiring, the evidence bar for each, and how TaaSFlow would run them.",
    agenda: [
      "The roles you need filled and by when",
      "What good actually looks like for each role",
      "How our evidence scoring would rank your inbound",
      "Timeline, seats, and what a pilot would cover",
    ],
    prepare: [
      "A job description or role outline, if you have one",
      "Roughly how many hires you expect this quarter",
      "Any hard requirements a candidate must prove",
    ],
  },
  demo: {
    id: "demo",
    name: "Platform walkthrough",
    durationLabel: "30 minutes",
    summary:
      "A live walkthrough of the workspace: intake, evidence extraction, scoring, and the decision queue.",
    agenda: [
      "Role intake and blueprint generation",
      "Evidence extraction from real CVs",
      "Scoring, rubrics, and the review queue",
      "Reporting, seats, and integrations",
    ],
    prepare: [
      "Who else should join from your side",
      "The systems you'd want TaaSFlow to sit alongside",
    ],
  },
};

export const DEFAULT_MEETING_TYPE: MeetingTypeId = "discovery";

export function resolveMeetingType(value: unknown): MeetingTypeId {
  return value === "demo" ? "demo" : DEFAULT_MEETING_TYPE;
}

/**
 * Build a booking link that carries the CTA's origin, so attribution and the
 * analytics events know where the visitor came from.
 */
export function bookingHref(opts?: {
  meetingType?: MeetingTypeId;
  /** Stable identifier of the CTA, e.g. "header_nav" or "pricing_gold". */
  source?: string;
}): string {
  const params = new URLSearchParams();
  if (opts?.meetingType && opts.meetingType !== DEFAULT_MEETING_TYPE) {
    params.set("type", opts.meetingType);
  }
  if (opts?.source) params.set("cta", opts.source.slice(0, 60));
  const qs = params.toString();
  return qs ? `${BOOKING_ROUTE}?${qs}` : BOOKING_ROUTE;
}

/* --------------------------------------------------------- select options -- */

export const COMPANY_SIZES = [
  "1–10",
  "11–50",
  "51–200",
  "201–500",
  "501–1,000",
  "1,000+",
] as const;

export const OPEN_ROLE_COUNTS = ["1", "2–3", "4–9", "10–24", "25+"] as const;

export const HIRING_VOLUMES = [
  "1–5 hires this year",
  "6–15 hires this year",
  "16–50 hires this year",
  "50+ hires this year",
  "Not sure yet",
] as const;

export const HIRING_TIMELINES = [
  "Immediately",
  "Within 30 days",
  "This quarter",
  "Next quarter",
  "Exploring / no date yet",
] as const;

export const CURRENT_PROCESSES = [
  "No system — spreadsheets and inboxes",
  "An ATS we're happy with",
  "An ATS we want to replace",
  "External agencies",
  "In-house recruiters only",
  "A mix of the above",
] as const;

export const HEARD_ABOUT = [
  "Google or search",
  "LinkedIn",
  "Referral or word of mouth",
  "Email from TaaSFlow",
  "Event or webinar",
  "Other",
] as const;
