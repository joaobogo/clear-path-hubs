/**
 * Seniority is stored free-form (intake writes "mid", the wizard writes "Mid").
 * The edit wizard's picker only matches its own option labels, so an unmatched
 * value renders as an empty select and the client is asked to re-answer
 * something they already told us. Normalise on the way in.
 */
export const SENIORITY_OPTIONS = [
  "Intern",
  "Junior",
  "Mid",
  "Senior",
  "Lead",
  "Staff",
  "Principal",
  "Director",
  "VP",
  "C-Level",
] as const;

/** Extra spellings we have seen in stored briefs, mapped to a picker option. */
const ALIASES: Record<string, string> = {
  entry: "Junior",
  associate: "Junior",
  midlevel: "Mid",
  mid_level: "Mid",
  intermediate: "Mid",
  senior_level: "Senior",
  teamlead: "Lead",
  team_lead: "Lead",
  manager: "Lead",
  head: "Director",
  executive: "C-Level",
  clevel: "C-Level",
  c_level: "C-Level",
  cxo: "C-Level",
};

/** Returns a picker option, or "" when the stored value maps to nothing. */
export function normalizeSeniority(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return "";
  const direct = SENIORITY_OPTIONS.find((o) => o.toLowerCase() === key.replace(/_/g, "-") || o.toLowerCase() === key);
  if (direct) return direct;
  return ALIASES[key] ?? ALIASES[key.replace(/_/g, "")] ?? "";
}
