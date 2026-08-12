/**
 * Duplicating a role.
 *
 * Repeat hiring is the normal case: the second Account Executive brief should
 * start from the first one, not from a blank form. This module decides exactly
 * what a duplicate copies — the brief — and what it must never copy — the
 * pipeline. Candidates, decisions, notes, interviews and delivery commitments
 * belong to the original role and stay there.
 *
 * Pure: it takes a position row and returns form values plus an honest note of
 * what came across and what did not.
 */

import type { CarryValue } from "./intake-carry";

/** Compensation older than this is worth re-checking before it goes back out. */
export const COMPENSATION_STALE_DAYS = 180;

export const DUPLICATE_COPIED = [
  "Requirements and their must-have / nice-to-have / trainable tags",
  "Compensation range and package details",
  "Location, work model and work authorisation",
  "Interview process, stages and decision makers",
  "Deal-breakers",
] as const;

export const DUPLICATE_NOT_COPIED = [
  "Candidates and shortlists",
  "Your decisions and interview feedback",
  "Notes and messages",
  "The delivery commitment — this role gets its own",
] as const;

export const DUPLICATE_TITLE_PROMPT =
  "Change the job title for this role, or confirm it is intentionally the same.";

export type DuplicateSourcePosition = {
  id: string;
  title?: string | null;
  location?: string | null;
  work_model?: string | null;
  description?: string | null;
  requirements?: unknown;
  preferred_requirements?: unknown;
  dealbreakers?: unknown;
  compensation?: unknown;
  work_authorization?: unknown;
  intake_context?: unknown;
  updated_at?: string | null;
  created_at?: string | null;
};

export type DuplicateDraft = {
  sourcePositionId: string;
  sourceTitle: string | null;
  /** Prefilled answers, keyed by intake form field. */
  values: Record<string, CarryValue | Array<{ text: string; tag: string }>>;
  /** The fields that were prefilled from the original role. */
  copiedFields: string[];
  copied: string[];
  notCopied: string[];
  /** When this role's compensation was last touched, if known. */
  compensationAsOf: string | null;
  /** True when the copied compensation is old enough to need a second look. */
  compensationStale: boolean;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function labelOf(row: unknown): string {
  if (typeof row === "string") return row.trim();
  const r = obj(row);
  return str(r["label"] ?? r["text"] ?? r["name"]);
}

export function isCompensationStale(asOf: string | null, now: Date = new Date()): boolean {
  if (!asOf) return false;
  const then = new Date(asOf).getTime();
  if (!Number.isFinite(then)) return false;
  const days = (now.getTime() - then) / 86_400_000;
  return days > COMPENSATION_STALE_DAYS;
}

export function buildDuplicateDraft(
  position: DuplicateSourcePosition | null | undefined,
  now: Date = new Date(),
): DuplicateDraft | null {
  if (!position?.id) return null;

  const ctx = obj(position.intake_context);
  const comp = obj(position.compensation);
  const auth = obj(position.work_authorization);

  const values: DuplicateDraft["values"] = {};
  const put = (field: string, value: DuplicateDraft["values"][string] | null | undefined) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    if (Array.isArray(value) && value.length === 0) return;
    if (value === false) return;
    values[field] = value;
  };

  // The role itself. The title comes across so the client can adjust it rather
  // than retype it, and the form makes them confirm or change it.
  put("roleTitle", str(position.title));
  put("team", str(ctx["team"]));
  put("jobDescriptionText", str(position.description));

  // Requirements keep their tags — that is the whole point of copying them.
  const requirements: Array<{ text: string; tag: string }> = [];
  for (const row of arr(position.requirements)) {
    const text = labelOf(row);
    if (text) requirements.push({ text, tag: "must_have" });
  }
  for (const row of arr(position.preferred_requirements)) {
    const text = labelOf(row);
    if (!text) continue;
    const kind = str(obj(row)["kind"]);
    requirements.push({ text, tag: kind === "trainable" ? "trainable" : "nice_to_have" });
  }
  put("requirements", requirements);

  const dealBreakers = [
    ...arr(ctx["deal_breaker_list"]).map(labelOf),
    ...arr(position.dealbreakers).map(labelOf),
  ].filter((d) => d.length > 0);
  put("dealBreakerList", Array.from(new Set(dealBreakers)).slice(0, 5));

  // Location and authorisation.
  put("location", str(position.location));
  const workModel = str(position.work_model);
  if (workModel === "remote" || workModel === "hybrid" || workModel === "onsite") {
    put("workModel", workModel);
    if (workModel === "hybrid" && ctx["onsite_days"] != null) put("onsiteDays", String(ctx["onsite_days"]));
    if (workModel === "remote") {
      put(
        "remoteTimezones",
        arr(ctx["remote_timezones"]).filter((z): z is string => typeof z === "string"),
      );
      put("remoteAnywhereInCountry", ctx["remote_anywhere_in_country"] === true);
    }
  }
  const sponsorship = str(ctx["sponsorship_available"]);
  if (sponsorship === "yes" || sponsorship === "no") put("sponsorshipAvailable", sponsorship);
  else if (typeof auth["sponsorship_available"] === "boolean") {
    put("sponsorshipAvailable", auth["sponsorship_available"] ? "yes" : "no");
  }
  put("workAuthorization", str(auth["rule"]));
  put("workAuthorizationNote", str(auth["note"]));

  // Compensation, numbers included — with its age surfaced, not hidden.
  put("currency", str(comp["currency"]));
  put("compensationPeriod", str(comp["period"]));
  if (comp["min"] != null) put("salaryMin", String(comp["min"]));
  if (comp["max"] != null) put("salaryMax", String(comp["max"]));
  put("compensationNote", str(comp["note"]));
  put("bonusStructure", str(comp["bonus"]));
  put("equity", str(comp["equity"]));
  put("compensationFlexible", comp["flexible"] === true);
  put("compensationUndecided", comp["undecided"] === true);

  // Interview process and decision makers.
  const stages = arr(ctx["interview_stages"])
    .map((s) => {
      const row = obj(s);
      return {
        name: str(row["name"]),
        ownerName: str(row["ownerName"] ?? row["owner_name"]),
        ownerEmail: str(row["ownerEmail"] ?? row["owner_email"]).toLowerCase(),
        format: str(row["format"]),
      };
    })
    .filter((s) => s.name.length > 0);
  put("interviewStages", stages);
  put("interviewProcess", str(ctx["interview_process"]));
  if (ctx["target_days_to_offer"] != null) put("targetDaysToOffer", String(ctx["target_days_to_offer"]));
  put("decisionMaker", str(ctx["decision_maker"]));
  put("decisionMakerEmail", str(ctx["decision_maker_email"]));

  const compensationAsOf =
    str(comp["collected_at"]) ||
    str(ctx["collected_at"]) ||
    str(position.updated_at) ||
    str(position.created_at) ||
    null;

  return {
    sourcePositionId: position.id,
    sourceTitle: str(position.title) || null,
    values,
    copiedFields: Object.keys(values),
    copied: [...DUPLICATE_COPIED],
    notCopied: [...DUPLICATE_NOT_COPIED],
    compensationAsOf: compensationAsOf || null,
    compensationStale: isCompensationStale(compensationAsOf || null, now),
  };
}
