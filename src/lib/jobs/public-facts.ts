import { extractOnsiteDays } from "./onsite-days";
import { titleCaseLocation } from "./location-format";

/**
 * The deciding facts on a public job page, derived once and shared by the
 * data layer, the board card and the detail page.
 *
 * Two rules run through every resolver here:
 *  1. Never invent a number. If the employer did not give us pay, we say so —
 *     no estimate, no "competitive".
 *  2. Never return an empty string. Every resolver returns either a real value
 *     or an explicit not-specified line, so the UI can render a fixed set of
 *     rows without ever emitting a blank one.
 */

export const NOT_SPECIFIED = "Not specified";

/** Employer gave a range but asked us to keep it off the public posting. */
export const RANGE_ON_CALL = "Range shared on the first call";

export type CompensationFact = {
  /** The public range, when the employer approved publishing it. */
  display: string | null;
  /** What the facts block should render — always non-empty. */
  line: string;
};

type CompensationJson = {
  // Current shape from intake.
  summary?: unknown;
  budget_min?: unknown;
  budget_max?: unknown;
  min?: unknown;
  max?: unknown;
  currency?: unknown;
  period?: unknown;
  // Legacy shape.
  approved?: unknown;
  display?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function formatAmount(value: number, currency: string): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString("en-US")}`;
  }
}

/**
 * `compensation_visibility` decides whether a range may be published at all.
 * Anything other than an explicit `public` is treated as withheld — a missing
 * or unrecognised value must never leak a number.
 */
export function resolveCompensation(
  compensation: unknown,
  visibility: string | null | undefined,
): CompensationFact {
  const c = (compensation ?? {}) as CompensationJson;
  const isPublic = visibility === "public";

  // Legacy explicit-approval shape still wins when present.
  const legacy = str(c.display);
  if (c.approved === true && legacy) return { display: legacy, line: legacy };

  if (!isPublic) return { display: null, line: RANGE_ON_CALL };

  // A structured range beats the free-text summary: the summary often carries
  // caveats ("depends on portfolio") that belong in the description, not in a
  // block someone scans in fifteen seconds.


  const min = num(c.budget_min) ?? num(c.min);
  const max = num(c.budget_max) ?? num(c.max);
  const currency = str(c.currency) || "USD";
  const period = str(c.period);
  const suffix = period ? ` per ${period}` : "";
  if (min !== null && max !== null) {
    const range =
      min === max
        ? formatAmount(min, currency)
        : `${formatAmount(min, currency)} to ${formatAmount(max, currency)}`;
    return { display: `${range}${suffix}`, line: `${range}${suffix}` };
  }
  const single = min ?? max;
  if (single !== null) {
    const one = `${formatAmount(single, currency)}${suffix}`;
    return { display: one, line: one };
  }
  // Only when there is no structured range do we fall back to the free text.
  const summary = str(c.summary);
  if (summary) return { display: summary, line: summary };
  return { display: null, line: NOT_SPECIFIED };
}


/**
 * Hybrid without a day count is the complaint we hear most, so an unstated
 * split is called out rather than hidden behind the word "Hybrid".
 */
export function resolveWorkArrangement(
  workModel: string | null | undefined,
  onsiteDays: unknown,
  description?: string | null,
): string {
  const days =
    (typeof onsiteDays === "number" && Number.isFinite(onsiteDays))
      ? onsiteDays
      : str(onsiteDays)
        ? parseInt(str(onsiteDays), 10)
        : extractOnsiteDays(description ?? "");
  switch (workModel) {
    case "remote":
      return "Remote";
    case "onsite":
      return "On-site, full time";
    case "hybrid":
      if (typeof days === "number" && !Number.isNaN(days)) {
        return `Hybrid — ${days} ${days === 1 ? "day" : "days"} a week on-site`;
      }
      return "Hybrid — on-site days not specified";
    default:
      return NOT_SPECIFIED;
  }
}

/** Location, plus any time-zone overlap the role actually requires. */
export function resolveLocation(
  location: string | null | undefined,
  primaryTimezone: string | null | undefined,
  overlapHours: unknown,
): string {
  const place = titleCaseLocation(str(location));
  const tz = str(primaryTimezone);
  const overlap = num(overlapHours);
  const parts: string[] = [];
  if (place) parts.push(place);
  if (tz) parts.push(`${tz} time zone`);
  if (overlap && overlap > 0) {
    parts.push(`${overlap} ${overlap === 1 ? "hour" : "hours"} overlap required`);
  }
  return parts.length > 0 ? parts.join(" · ") : NOT_SPECIFIED;
}

type WorkAuthJson = {
  sponsorship_available?: unknown;
  sponsorship?: unknown;
  sponsors?: unknown;
  required?: unknown;
  countries?: unknown;
  note?: unknown;
};

/**
 * Sponsorship is a yes/no question for the candidate, so we only answer it
 * when the employer answered it. `required` on its own does not imply a
 * sponsorship position and is never read as one.
 */
export function resolveWorkAuthorisation(
  workAuthorization: unknown,
  note: string | null | undefined,
): string {
  const wa = (workAuthorization ?? {}) as WorkAuthJson;
  const explicit = [wa.sponsorship_available, wa.sponsorship, wa.sponsors].find(
    (v) => typeof v === "boolean",
  );
  const countries = Array.isArray(wa.countries)
    ? wa.countries.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  
  // Title-case country names to avoid "unites states" issues.
  const titleCase = (s: string) => {
    // Exact match for the mangled "unites states" string.
    if (s.toLowerCase() === 'unites states') return 'United States';
    return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const where = countries.length > 0 ? countries.map(titleCase).join(", ") : "";

  if (explicit === true) {
    return where
      ? `Employer sponsors work authorisation for ${where}`
      : "Employer sponsors work authorisation";
  }
  if (explicit === false) {
    return where
      ? `No sponsorship — you must already be authorised to work in ${where}`
      : "No sponsorship — you must already be authorised to work";
  }

  const free = str(note) || str(wa.note);
  if (free) return free;
  if (where) return `You must be authorised to work in ${where}. Sponsorship not stated`;
  return `${NOT_SPECIFIED} — ask us and we'll confirm with the employer`;
}

export function resolveEmploymentType(employmentType: string | null | undefined): string {
  const e = str(employmentType);
  if (!e) return NOT_SPECIFIED;
  return e.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The stages this platform commits to publicly, in the order they happen. */
export const HIRING_STAGES = ["apply", "TaaSFlow review", "employer interviews"] as const;

export function resolveStages(): string {
  return `${HIRING_STAGES.length} before an offer: ${HIRING_STAGES.join(", ")}`;
}

export function resolvePostedDate(publishedAt: string | null | undefined): string {
  const raw = str(publishedAt);
  if (!raw) return NOT_SPECIFIED;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return NOT_SPECIFIED;
  const posted = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return `${posted} · today`;
  if (days === 1) return `${posted} · yesterday`;
  return `${posted} · ${days} days ago`;
}

export type PublicJobFacts = {
  compensation: string;
  workArrangement: string;
  location: string;
  workAuthorisation: string;
  employmentType: string;
  stages: string;
  posted: string;
};

/** The seven facts, always in this order, always with a value. */
export function buildPublicJobFacts(input: {
  compensation: unknown;
  compensation_visibility: string | null | undefined;
  work_model: string | null | undefined;
  onsite_days?: unknown;
  location: string | null | undefined;
  primary_timezone?: string | null | undefined;
  timezone_overlap_hours?: unknown;
  work_authorization?: unknown;
  work_authorization_note?: string | null | undefined;
  employment_type: string | null | undefined;
  published_at: string | null | undefined;
  description?: string | null;
}): PublicJobFacts {
  return {
    compensation: resolveCompensation(input.compensation, input.compensation_visibility).line,
    workArrangement: resolveWorkArrangement(
      input.work_model,
      input.onsite_days,
      input.description,
    ),
    location: resolveLocation(
      input.location,
      input.primary_timezone,
      input.timezone_overlap_hours,
    ),
    workAuthorisation: resolveWorkAuthorisation(
      input.work_authorization,
      input.work_authorization_note,
    ),
    employmentType: resolveEmploymentType(input.employment_type),
    stages: resolveStages(),
    posted: resolvePostedDate(input.published_at),
  };
}
