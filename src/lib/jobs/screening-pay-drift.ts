/**
 * A screening question must not quote a pay range the role does not offer.
 *
 * Position bf2a3410 published "R$3,500 to R$5,000 per month" on the job board,
 * the public role page and the client's compensation card, while screening
 * question 3 — which every applicant answers — asked candidates to confirm
 * alignment with "R$3,500–R$4,500". A candidate who would decline at R$4,500
 * and accept at R$5,000 screens themselves out, and the record shows they
 * agreed to terms that were never the terms (audit 1 Sep, F14).
 *
 * The cause is that the question text is authored once at role setup with the
 * range baked into the string, and nothing re-checks it when the range moves.
 * Interpolating the live figure is the real fix; this is the guard that makes
 * the drift visible in the meantime, and that catches the next one.
 *
 * Deliberately conservative: it reports only figures it can read confidently,
 * and says nothing when the position has no stored range to compare against.
 * A false alarm on a pay question is expensive — it invites someone to "fix"
 * a question that was right.
 */

/** A money figure written in prose: R$3,500 · €55,000 · 4.500 · 5,000. */
const FIGURE = /(?:R\$|US\$|[$€£])?\s?(\d{1,3}(?:[.,]\d{3})+|\d{4,7})(?!\s*%)/g;

function toNumber(raw: string): number | null {
  // Both separators appear in this product's data: "3,500" and "4.500".
  const digits = raw.replace(/[.,]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Every money-looking figure in a string, in order. */
export function payFiguresIn(text: string | null | undefined): number[] {
  const out: number[] = [];
  for (const m of String(text ?? "").matchAll(FIGURE)) {
    const n = toNumber(m[1]!);
    if (n !== null) out.push(n);
  }
  return out;
}

export type PayDrift = {
  /** Figures the question states that the position's range does not contain. */
  unexpected: number[];
  /** The range the position actually stores. */
  expected: { min: number | null; max: number | null };
  message: string;
};

/**
 * Compare a screening question's stated pay against the position's record.
 *
 * @returns null when the question quotes no figure, when the position has no
 *          stored range, or when every figure the question states matches.
 */
export function screeningPayDrift(
  questionText: string | null | undefined,
  compensation: { min?: number | null; max?: number | null } | null | undefined,
): PayDrift | null {
  const min = typeof compensation?.min === "number" ? compensation.min : null;
  const max = typeof compensation?.max === "number" ? compensation.max : null;
  // Nothing to compare against. Silence beats a guess about pay.
  if (min === null && max === null) return null;

  const stated = payFiguresIn(questionText);
  if (stated.length === 0) return null;

  // A figure is fine if it equals either end of the stored range. Anything
  // inside the range is also fine — a question may quote a starting salary —
  // but a figure OUTSIDE it, or a different endpoint, is drift.
  const lo = min ?? max!;
  const hi = max ?? min!;
  const unexpected = stated.filter((n) => n < lo || n > hi);

  // The observed case: the question's ceiling sits below the advertised one.
  // Both ends are inside [lo, hi] only when they match, so a lower ceiling
  // reads as "within range" and would slip through. Catch a stated MAXIMUM
  // that is below the stored maximum.
  const statedMax = Math.max(...stated);
  if (max !== null && statedMax < max && !unexpected.includes(statedMax)) {
    unexpected.push(statedMax);
  }

  if (unexpected.length === 0) return null;

  return {
    unexpected,
    expected: { min, max },
    message:
      `This question states ${unexpected.join(", ")} but the role's recorded range is ` +
      `${min ?? "—"}–${max ?? "—"}. Candidates answer against the figure in the question, ` +
      `so it must be the figure the role actually offers.`,
  };
}
