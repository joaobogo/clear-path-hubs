/**
 * Server-only helpers for the parse review screen.
 *
 * Flattens what the parser extracted into individually reviewable fields,
 * locates each value in the original document text, and merges the reversible
 * human-correction layer on top without ever overwriting the machine value.
 */
import { deriveBand, type ConfidenceBand } from "./confidence-bands";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type ParseField = {
  /** Stable path, e.g. "headline" or "experience.1.title". */
  path: string;
  label: string;
  group: "identity" | "experience" | "skills";
  /** What the parser read. */
  machineValue: string | null;
  /** What a recruiter put there instead, if anything. */
  humanValue: string | null;
  /** The value that should be acted on. */
  effectiveValue: string | null;
  /** Character offset of the value inside the document text, when found. */
  offset: number | null;
  /** The exact passage the value came from, when it could be located. */
  passage: string | null;
  located: boolean;
  reviewState: "unreviewed" | "confirmed" | "corrected" | "passage_mismatch";
  reviewerNote: string | null;
  reviewedAt: string | null;
  band: ConfidenceBand;
  /** Excluded from scoring until a human confirms it. */
  excludedFromScoring: boolean;
};

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() ? v.trim() : null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}

/** Case-insensitive, whitespace-tolerant search for a value in the CV text. */
export function locateInText(
  text: string,
  value: string | null,
): { offset: number; passage: string } | null {
  if (!value || !text) return null;
  const needle = value.replace(/\s+/g, " ").trim();
  if (needle.length < 3) return null;
  const hay = text.replace(/\s+/g, " ");
  let idx = hay.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0 && needle.length > 40) {
    // Long values (summaries) rarely survive normalisation verbatim; try the head.
    const head = needle.slice(0, 40);
    idx = hay.toLowerCase().indexOf(head.toLowerCase());
  }
  if (idx < 0) return null;
  const start = Math.max(0, idx - 90);
  const end = Math.min(hay.length, idx + needle.length + 90);
  return { offset: idx, passage: hay.slice(start, end).trim() };
}

type ReviewRow = {
  field_path: string;
  human_value: Any;
  review_state: string;
  reviewer_note: string | null;
  reviewed_at: string | null;
  located: boolean;
};

/**
 * Build the reviewable field list. Fields with no locatable passage render as
 * unlocated — never as a plausible value carried over from another section.
 */
export function buildParseFields(args: {
  extracted: Any;
  cvText: string;
  reviews: ReviewRow[];
  /** Engine confidence by rough field family, from evidence items. */
  matchTypeByPath?: Record<string, { matchType: string | null; confidence: number | null }>;
}): ParseField[] {
  const { extracted, cvText, reviews } = args;
  const byPath = new Map(reviews.map((r) => [r.field_path, r]));
  const raw: { path: string; label: string; group: ParseField["group"]; value: string | null }[] =
    [];

  raw.push({ path: "headline", label: "Headline", group: "identity", value: str(extracted?.headline) });
  raw.push({ path: "location", label: "Location", group: "identity", value: str(extracted?.location) });

  const exp: Any[] = Array.isArray(extracted?.experience) ? extracted.experience : [];
  exp.forEach((e, i) => {
    const n = i + 1;
    raw.push({ path: `experience.${i}.title`, label: `Role ${n} · title`, group: "experience", value: str(e?.title) });
    raw.push({ path: `experience.${i}.company`, label: `Role ${n} · employer`, group: "experience", value: str(e?.company) });
    raw.push({
      path: `experience.${i}.dates`,
      label: `Role ${n} · dates`,
      group: "experience",
      value: str(e?.start) || str(e?.end) ? `${str(e?.start) ?? "—"} – ${str(e?.end) ?? "—"}` : null,
    });
    raw.push({ path: `experience.${i}.summary`, label: `Role ${n} · summary`, group: "experience", value: str(e?.summary) });
  });

  const skills: Any[] = Array.isArray(extracted?.skills) ? extracted.skills : [];
  skills.forEach((s, i) => {
    raw.push({ path: `skills.${i}`, label: `Skill ${i + 1}`, group: "skills", value: str(s) });
  });

  return raw.map(({ path, label, group, value }) => {
    const review = byPath.get(path);
    const humanValue = str(review?.human_value);
    const hit = locateInText(cvText, value);
    const meta = args.matchTypeByPath?.[path];
    const state = (review?.review_state ?? "unreviewed") as ParseField["reviewState"];
    const humanConfirmed = state === "confirmed" || state === "corrected";
    const band = deriveBand({
      humanConfirmed,
      located: Boolean(hit),
      matchType: meta?.matchType ?? null,
      confidence: meta?.confidence ?? null,
      mismatch: state === "passage_mismatch",
    });
    return {
      path,
      label,
      group,
      machineValue: value,
      humanValue,
      effectiveValue: humanValue ?? value,
      offset: hit?.offset ?? null,
      passage: hit?.passage ?? null,
      located: Boolean(hit),
      reviewState: state,
      reviewerNote: review?.reviewer_note ?? null,
      reviewedAt: review?.reviewed_at ?? null,
      band,
      excludedFromScoring: Boolean(value) && !hit && !humanConfirmed,
    };
  });
}

export function summarise(fields: ParseField[]) {
  return {
    total: fields.length,
    filled: fields.filter((f) => f.effectiveValue).length,
    confirmed: fields.filter((f) => f.band === "confirmed").length,
    probable: fields.filter((f) => f.band === "probable").length,
    needs_review: fields.filter((f) => f.band === "needs_review").length,
    unlocated: fields.filter((f) => f.effectiveValue && !f.located).length,
    excluded_from_scoring: fields.filter((f) => f.excludedFromScoring).length,
  };
}
