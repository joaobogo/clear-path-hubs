/**
 * One shared formatter for machine enum values that reach the UI.
 *
 * Raw enum values (`full_time`, `under_review`, `not_entitled`) must never be
 * rendered verbatim. Anything not in the explicit map falls back to a
 * sentence-cased, space-separated label so a new enum value still reads as
 * English rather than as a database token.
 */
const LABELS: Record<string, string> = {
  // Employment / work model
  full_time: "Full time",
  part_time: "Part time",
  contract: "Contract",
  temporary: "Temporary",
  internship: "Internship",
  freelance: "Freelance",
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "On site",
  onsite: "On site",

  // Seniority
  entry_level: "Entry level",
  mid_level: "Mid level",
  senior: "Senior",
  lead: "Lead",
  principal: "Principal",
  director: "Director",
  executive: "Executive",

  // Role / workflow status
  draft: "Draft",
  under_review: "Under review",
  in_review: "In review",
  pending_review: "Pending review",
  awaiting_payment: "Awaiting payment",
  active: "Active",
  approved: "Approved",
  paused: "Paused",
  on_hold: "On hold",
  filled: "Filled",
  closed: "Closed",
  cancelled: "Cancelled",
  archived: "Archived",

  // Entitlement / access
  not_entitled: "Not included in your plan",
  entitled: "Included in your plan",
  trial: "Trial access",
  expired: "Access expired",
  no_org: "No workspace selected",
};

export function formatEnumLabel(
  value: string | null | undefined,
  fallback = "",
): string {
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;
  const key = raw.toLowerCase();
  const mapped = LABELS[key];
  if (mapped) return mapped;
  const words = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return fallback;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Joins several enum-ish values into a human meta line, dropping blanks. */
export function formatEnumList(
  values: Array<string | null | undefined>,
  separator = " · ",
): string {
  return values
    .map((v) => formatEnumLabel(v))
    .filter((v) => v.length > 0)
    .join(separator);
}
