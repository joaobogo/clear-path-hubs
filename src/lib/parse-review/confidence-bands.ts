/**
 * Field-level confidence, stated in plain language.
 *
 * Three bands, one fixed definition each. No decimal percentages in the
 * recruiter interface — false precision is worse than none — and no band that
 * describes the person rather than the field.
 */

export type ConfidenceBand = "confirmed" | "probable" | "needs_review";

export const BAND_LABEL: Record<ConfidenceBand, string> = {
  confirmed: "Confirmed",
  probable: "Probable",
  needs_review: "Needs review",
};

/** Fixed, written definitions. Shown identically everywhere a band appears. */
export const BAND_DEFINITION: Record<ConfidenceBand, string> = {
  confirmed:
    "The value matches text found in the original document, or a recruiter has confirmed it.",
  probable:
    "The value was inferred from surrounding context in the document. It is likely right but was not matched word-for-word.",
  needs_review:
    "The value could not be located in the document, or was reconstructed. A human should confirm it before anyone acts on it.",
};

/** Tailwind classes per band, using semantic tokens only. */
export const BAND_CLASS: Record<ConfidenceBand, string> = {
  confirmed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  probable: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  needs_review: "border-destructive/40 bg-destructive/10 text-destructive",
};

export type BandInput = {
  /** Human confirmed or corrected the field. */
  humanConfirmed?: boolean;
  /** The value was found verbatim in the source document. */
  located?: boolean;
  /** How the parser produced the value, when known. */
  matchType?: string | null;
  /** Raw engine confidence, used only as a tie-breaker — never displayed. */
  confidence?: number | null;
  /** A reviewer flagged the passage as not matching the field. */
  mismatch?: boolean;
};

/**
 * Derive the band from where the value came from and how it matched.
 * Human confirmation always wins; an unlocated value can never be "confirmed".
 */
export function deriveBand(input: BandInput): ConfidenceBand {
  if (input.mismatch) return "needs_review";
  if (input.humanConfirmed) return "confirmed";
  if (input.located) {
    if (input.matchType === "reconstructed") return "probable";
    return "confirmed";
  }
  const mt = (input.matchType ?? "").toLowerCase();
  if (mt === "exact" || mt === "verbatim") return "probable";
  if (mt === "inferred" || mt === "context") return "probable";
  if (typeof input.confidence === "number" && input.confidence >= 0.75) return "probable";
  return "needs_review";
}
