/**
 * Public platform status — pure logic and vocabulary.
 *
 * Rules this module enforces, deliberately:
 *  - A status is a claim, so it must come from a measurement taken in this
 *    request. Where nothing was measured the status is `unknown`, never a
 *    green light and never a guess.
 *  - There are no uptime percentages, no historical availability figures and
 *    no invented incident record. Incident and maintenance history is only
 *    what a person has published.
 *  - Nothing here carries infrastructure detail: no hostnames, regions,
 *    provider names, versions, error strings, table names, job ids or trace
 *    ids. Only a service, a status, a measurement window and a plain line.
 */

export const STATUS_LEVELS = [
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
  "maintenance",
  "unknown",
] as const;

export type StatusLevel = (typeof STATUS_LEVELS)[number];

export const STATUS_LABEL: Record<StatusLevel, string> = {
  operational: "Operational",
  degraded_performance: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Maintenance",
  unknown: "Unknown",
};

/**
 * What each status means for someone using the product. Written for a reader
 * who is trying to decide whether to wait or to act.
 */
export const STATUS_MEANING: Record<StatusLevel, string> = {
  operational: "Working normally when we last checked.",
  degraded_performance: "Working, but slower than it should be.",
  partial_outage: "Some of this is not working right now.",
  major_outage: "This is not working right now.",
  maintenance: "Deliberately paused for planned work.",
  unknown: "We could not measure this, so we are not claiming a status.",
};

/**
 * Escalation order. Higher wins when rolling services up to one headline.
 * `unknown` deliberately ranks above `operational`: an unmeasured service must
 * never be absorbed into a green summary.
 */
const RANK: Record<StatusLevel, number> = {
  operational: 0,
  maintenance: 1,
  unknown: 2,
  degraded_performance: 3,
  partial_outage: 4,
  major_outage: 5,
};

export function worstStatus(levels: StatusLevel[]): StatusLevel {
  if (levels.length === 0) return "unknown";
  return levels.reduce((worst, next) => (RANK[next] > RANK[worst] ? next : worst), levels[0]!);
}

export function isDisrupted(level: StatusLevel): boolean {
  return level === "degraded_performance" || level === "partial_outage" || level === "major_outage";
}

// ----------------------------------------------------------------- services

export const SERVICE_KEYS = [
  "website",
  "authentication",
  "workspace",
  "roles",
  "agents",
  "candidate_data",
  "file_storage",
  "realtime",
  "scoring",
  "integrations",
  "notifications",
  "billing",
] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

export type ServiceDefinition = {
  key: ServiceKey;
  name: string;
  /** What a reader loses when this service is disrupted. */
  covers: string;
  /**
   * How the status is produced. Stated on the page so nobody has to assume
   * monitoring we do not have.
   */
  measured_by: string;
};

export const SERVICES: readonly ServiceDefinition[] = [
  {
    key: "website",
    name: "Public website",
    covers: "Public pages, the job board and application forms.",
    measured_by: "Served by the same request that produced this page.",
  },
  {
    key: "authentication",
    name: "Authentication",
    covers: "Signing in, signing up and password resets.",
    measured_by: "A live check of the sign-in service at page load.",
  },
  {
    key: "workspace",
    name: "Client workspace",
    covers: "The signed-in workspace: dashboards, queues and decisions.",
    measured_by: "A live read of workspace records at page load.",
  },
  {
    key: "roles",
    name: "Role management",
    covers: "Creating, publishing and editing roles.",
    measured_by: "A live read of role records at page load.",
  },
  {
    key: "agents",
    name: "Updates and processing",
    covers: "Background work: CV processing, enrichment and processing steps.",
    measured_by: "Background work still waiting or in progress at page load.",
  },
  {
    key: "candidate_data",
    name: "Candidate data",
    covers: "Candidate records, evidence and application status.",
    measured_by: "A live read of candidate records at page load.",
  },
  {
    key: "file_storage",
    name: "File storage",
    covers: "Uploading CVs and downloading candidate documents.",
    measured_by: "A live check of the private document store at page load.",
  },
  {
    key: "realtime",
    name: "Live updates",
    covers: "Queues, dashboards and messages updating without a refresh.",
    measured_by: "A live connection to the live-updates service at page load.",
  },
  {
    key: "scoring",
    name: "Scoring",
    covers: "Evidence-backed assessments against role requirements.",
    measured_by: "Outcomes of assessments in the last 24 hours.",
  },
  {
    key: "integrations",
    name: "Integrations",
    covers: "Connections to calendars, CRM and messaging tools.",
    measured_by: "The most recent recorded check for each connection.",
  },
  {
    key: "notifications",
    name: "Notifications",
    covers: "Email and in-product notifications.",
    measured_by: "Delivery outcomes in the last 24 hours.",
  },
  {
    key: "billing",
    name: "Billing",
    covers: "Checkout, subscriptions and payment records.",
    measured_by: "Payment and subscription events in the last 7 days.",
  },
];

export function serviceDefinition(key: ServiceKey): ServiceDefinition {
  return SERVICES.find((s) => s.key === key)!;
}

// ------------------------------------------------------------------- shapes

export type ServiceStatus = {
  key: ServiceKey;
  name: string;
  covers: string;
  measured_by: string;
  status: StatusLevel;
  /** One plain line about what was measured. Never an internal error. */
  detail: string;
  /** True when a measurement was actually taken for this request. */
  measured: boolean;
  /** The window the measurement covers, in words. */
  window: string;
  /**
   * True only when the measurement describes right now — a live probe taken in
   * this request. Windowed measurements (a failure ratio over the last day or
   * week) describe history, not the present, and must never raise an in-product
   * alarm on their own.
   */
  covers_now?: boolean;
  /** Set when a published maintenance window is in force for this service. */
  maintenance_note: string | null;
};

export type StatusNotice = {
  id: string;
  kind: "incident" | "maintenance";
  title: string;
  summary: string;
  severity: StatusLevel;
  state: string;
  services: ServiceKey[];
  started_at: string;
  resolved_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
};

export type PlatformStatus = {
  /** When these measurements were taken. */
  checked_at: string;
  overall: StatusLevel;
  headline: string;
  services: ServiceStatus[];
  /** Currently open incidents, newest first. */
  active_incidents: StatusNotice[];
  /** Resolved incidents a person published, newest first. */
  incident_history: StatusNotice[];
  /** Scheduled or in-progress maintenance a person published. */
  maintenance: StatusNotice[];
  /**
   * Since when there is a published record to read. Null means nothing has
   * ever been published — which is stated as such, not as "no incidents".
   */
  history_since: string | null;
  /** Whether status change notifications can be subscribed to. */
  subscription_supported: boolean;
};

// ------------------------------------------------------------ measured lines

export const NOT_MEASURED_DETAIL =
  "No measurement was available for this check, so no status is claimed.";

export function headlineFor(overall: StatusLevel, disruptedNames: string[]): string {
  switch (overall) {
    case "operational":
      return "All measured services are working normally.";
    case "maintenance":
      return "Planned maintenance is in progress.";
    case "degraded_performance":
      return `Slower than normal: ${disruptedNames.join(", ")}.`;
    case "partial_outage":
      return `Partly unavailable: ${disruptedNames.join(", ")}.`;
    case "major_outage":
      return `Not working right now: ${disruptedNames.join(", ")}.`;
    case "unknown":
    default:
      return "Some services could not be measured, so we are not claiming a status for them.";
  }
}

/**
 * Latency thresholds for the live read checks. A read that answers but takes
 * this long is honestly "degraded", not "operational".
 */
export const SLOW_MS = 1_500;
export const VERY_SLOW_MS = 4_000;

export function statusFromProbe(input: {
  ok: boolean;
  ms: number;
}): { status: StatusLevel; detail: string } {
  if (!input.ok) {
    return { status: "major_outage", detail: "The check did not complete." };
  }
  if (input.ms >= VERY_SLOW_MS) {
    return { status: "partial_outage", detail: "The check completed, but far slower than normal." };
  }
  if (input.ms >= SLOW_MS) {
    return { status: "degraded_performance", detail: "The check completed, but slower than normal." };
  }
  return { status: "operational", detail: "The check completed normally." };
}

/**
 * Smallest sample that can carry a claim about background work. Below this a
 * single failure would swing the band, so nothing is claimed at all.
 */
export const MIN_OUTCOME_SAMPLE = 10;

/**
 * How long background work may sit unfinished before it counts as behind.
 * Below these, waiting is normal operation, not a disruption.
 */
export const BACKLOG_QUEUED_MINUTES = 10;
export const BACKLOG_RUNNING_MINUTES = 20;
/** Enough overdue work at once that more than one person is affected. */
export const BACKLOG_PARTIAL_OUTAGE_COUNT = 10;

/**
 * Live backlog bands for background work.
 *
 * Only work that is unfinished *right now* and already past its threshold can
 * lower this status. Completed, failed and cancelled rows are history: they
 * describe what happened, never what a reader is waiting on, so they can never
 * raise a degradation here. No pending work at all is the healthy case, and it
 * is a genuine measurement rather than an absence of one.
 */
export function statusFromBacklog(input: {
  /** Unfinished runs, whatever their age. */
  pending: number;
  /** Unfinished runs already past their threshold. */
  overdue: number;
  /** Age of the oldest overdue run, in whole minutes. */
  oldestOverdueMinutes: number;
}): { status: StatusLevel; detail: string; measured: boolean } {
  const { pending, overdue, oldestOverdueMinutes } = input;
  if (overdue <= 0) {
    const detail =
      pending > 0
        ? `${pending} ${pending === 1 ? "run is" : "runs are"} in progress and none is behind.`
        : "No background work is waiting.";
    return { status: "operational", measured: true, detail };
  }
  const line = `${overdue} of ${pending} ${pending === 1 ? "run" : "runs"} in progress ${
    overdue === 1 ? "has" : "have"
  } been waiting longer than expected — the oldest for ${oldestOverdueMinutes} ${
    oldestOverdueMinutes === 1 ? "minute" : "minutes"
  }.`;
  return {
    status: overdue >= BACKLOG_PARTIAL_OUTAGE_COUNT ? "partial_outage" : "degraded_performance",
    measured: true,
    detail: line,
  };
}


/**
 * Failure-ratio bands for measured background work. Bands are stated in the
 * page copy so the reader knows what "degraded" means here.
 */
export function statusFromFailureRatio(input: {
  total: number;
  failed: number;
  noun: string;
  window: string;
}): { status: StatusLevel; detail: string; measured: boolean } {
  if (input.total === 0) {
    return {
      status: "unknown",
      measured: false,
      detail: `No ${input.noun} ran in the ${input.window}, so there is nothing to measure.`,
    };
  }
  if (input.total < MIN_OUTCOME_SAMPLE) {
    return {
      status: "unknown",
      measured: false,
      detail: `Too few ${input.noun} ran in the ${input.window} to claim a status.`,
    };
  }
  const ratio = input.failed / input.total;
  const line = `${input.failed} of ${input.total} ${input.noun} did not complete in the ${input.window}.`;
  if (ratio >= 0.5) return { status: "major_outage", measured: true, detail: line };
  if (ratio >= 0.2) return { status: "partial_outage", measured: true, detail: line };
  if (ratio >= 0.05) return { status: "degraded_performance", measured: true, detail: line };
  return {
    status: "operational",
    measured: true,
    detail: `${input.total - input.failed} of ${input.total} ${input.noun} completed in the ${input.window}.`,
  };
}

// --------------------------------------------------------- in-product notice

export type DegradedNotice = {
  /** Whether anything should be shown at all. */
  show: boolean;
  status: StatusLevel;
  /** What the reader is looking at. */
  title: string;
  /** What may be delayed or unavailable, and what still works. */
  body: string;
  affected: string[];
};

/**
 * Turns measured platform status into the one in-product line that tells a
 * signed-in user whether to wait or to act.
 *
 * The bar for showing anything is deliberately high, because a false alarm
 * costs more trust than a slow page:
 *  - a published incident or maintenance window that is open right now, or
 *  - a service whose measurement describes right now (`covers_now`) and came
 *    back disrupted.
 *
 * A failure ratio over the last day or week is history, not an incident: it
 * belongs on the status page and never raises this banner by itself. An
 * unmeasured service is never an alarm, and "no data yet" is never a warning.
 */
export function degradedNotice(status: PlatformStatus | undefined | null): DegradedNotice {
  const hidden: DegradedNotice = {
    show: false,
    status: "unknown",
    title: "",
    body: "",
    affected: [],
  };
  if (!status) return hidden;

  const publishedNow =
    status.active_incidents.length > 0 ||
    status.maintenance.some((m) => m.state !== "scheduled" && !m.resolved_at);

  const live = status.services.filter((s) => s.covers_now === true);
  const disrupted = live.filter((s) => isDisrupted(s.status));
  const maintaining = status.services.filter((s) => s.status === "maintenance");

  if (!publishedNow && disrupted.length === 0 && maintaining.length === 0) {
    return { ...hidden, status: "operational" };
  }
  if (publishedNow && disrupted.length === 0 && maintaining.length === 0) {
    const notice = status.active_incidents[0] ?? status.maintenance[0]!;
    return {
      show: true,
      status: notice.kind === "maintenance" ? "maintenance" : notice.severity,
      title: notice.title,
      body: notice.summary,
      affected: notice.services
        .map((key) => status.services.find((s) => s.key === key)?.name)
        .filter((n): n is string => Boolean(n)),
    };
  }


  const affected = [...disrupted, ...maintaining].map((s) => s.name);
  const worst = worstStatus([...disrupted, ...maintaining].map((s) => s.status));

  const consequence =
    worst === "maintenance"
      ? "Some actions are paused while planned work finishes. Anything you have already submitted is kept."
      : worst === "major_outage"
        ? "Actions that depend on this will fail until it recovers. Nothing you have already submitted is lost."
        : worst === "partial_outage"
          ? "Some actions here may fail and some data may be out of date."
          : "Data here may be a few minutes behind and some actions may take longer than usual.";

  return {
    show: true,
    status: worst,
    title:
      worst === "maintenance"
        ? "Planned maintenance in progress"
        : worst === "degraded_performance"
          ? "Some updates are running slowly"
          : `${STATUS_LABEL[worst]}: ${affected.join(", ")}`,
    body: consequence,
    affected,
  };
}
