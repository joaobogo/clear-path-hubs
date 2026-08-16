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

/**
 * Render a candidate work-authorisation field for humans.
 *
 * The column is polymorphic: it can be a plain string, a note from a position
 * blueprint, or an object like `{ visa_required: false, right_to_work: true }`.
 * This collapses the object into a readable line and strips any demo seed markers.
 */
export function formatWorkAuthorization(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const clean = raw.trim();
    if (!clean || /TAASFLOW_DEMO_SEED/i.test(clean)) return null;
    return clean;
  }
  const r = raw as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof r.visa_required === "boolean") {
    parts.push(r.visa_required ? "Visa required" : "No visa required");
  }
  if (typeof r.right_to_work === "boolean") {
    parts.push(r.right_to_work ? "Right to work confirmed" : "No right to work");
  }
  if (typeof r.eu_citizen === "boolean") {
    parts.push(r.eu_citizen ? "EU citizen" : "Non-EU citizen");
  }
  const note = String(r.notes ?? r.required ?? r.summary ?? r.value ?? r.note ?? "").trim();
  if (note && !/TAASFLOW_DEMO_SEED/i.test(note)) {
    parts.push(note);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Extract a human-readable value from a screening answer.
 *
 * Answers may be stored as plain strings, numbers, booleans, or wrapped objects
 * like `{ value: 8 }`. Never render raw JSON to a human.
 */
export function formatAnswerValue(raw: unknown): string {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw)) {
    return raw.map((v) => formatAnswerValue(v)).filter(Boolean).join(", ") || "—";
  }
  const r = raw as Record<string, unknown>;
  if ("value" in r) return formatAnswerValue(r.value);
  if ("answer" in r) return formatAnswerValue(r.answer);
  if ("label" in r) return String(r.label);
  // Fallback: pretty-print object keys that have non-empty values.
  const entries = Object.entries(r)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${formatEnumLabel(k)}: ${formatAnswerValue(v)}`);
  return entries.length > 0 ? entries.join(" · ") : "—";
}
