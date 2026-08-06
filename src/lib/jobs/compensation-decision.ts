/**
 * Compensation as a decision, never a blank.
 *
 * Exactly three outcomes may be published: a stated range, an explicit
 * "discussed on the first call", or a legally required disclosure. We never
 * estimate, benchmark or infer a range into public copy — an empty field is a
 * publish blocker, not a silent omission.
 */

export type CompensationDisclosure = "range" | "discussed_on_call" | "legally_required";

export type CompensationDecisionInput = {
  disclosure?: string | null;
  currency?: string | null;
  period?: string | null;
  min?: number | null;
  max?: number | null;
  /** Client's own note: variable pay, equity, day rate context. */
  note?: string | null;
  /** Jurisdictions this posting will be published into. */
  jurisdictions?: string[] | null;
};

/**
 * Jurisdictions where pay transparency is mandated, so "discussed on the first
 * call" cannot be chosen. Kept as an explicit list — never guessed from a
 * company address.
 */
export const PAY_DISCLOSURE_JURISDICTIONS = [
  "US-CA",
  "US-CO",
  "US-NY",
  "US-WA",
  "US-IL",
  "EU",
] as const;

export const DISCUSSED_ON_CALL_LINE = "Discussed on the first call";

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

function money(value: number, currency: string): string {
  const code = (currency || "USD").toUpperCase();
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

export function requiresPayDisclosure(jurisdictions: string[] | null | undefined): boolean {
  const j = Array.isArray(jurisdictions) ? jurisdictions : [];
  return j.some((code) =>
    (PAY_DISCLOSURE_JURISDICTIONS as readonly string[]).includes(text(code).toUpperCase()),
  );
}

export type CompensationDecision =
  | { ok: true; disclosure: CompensationDisclosure; line: string }
  | { ok: false; blocker: string };

/**
 * Resolves the one publishable sentence, or the reason publishing is blocked.
 * The blocker text is what the client reads, so it names the decision needed.
 */
export function resolveCompensationDecision(
  input: CompensationDecisionInput,
): CompensationDecision {
  const disclosure = text(input.disclosure) as CompensationDisclosure | "";
  const mandated = requiresPayDisclosure(input.jurisdictions);
  const min = num(input.min);
  const max = num(input.max);
  const currency = text(input.currency) || "USD";
  const period = text(input.period);
  const suffix = period ? ` per ${period}` : "";
  const note = text(input.note);

  if (!disclosure) {
    return {
      ok: false,
      blocker:
        "Pick how pay is shown: a range, or that it is discussed on the first call. We will not publish a blank.",
    };
  }

  if (disclosure === "discussed_on_call") {
    if (mandated) {
      return {
        ok: false,
        blocker:
          "This role is posted somewhere pay transparency is required by law, so a range has to be published. This cannot be overridden.",
      };
    }
    return { ok: true, disclosure, line: DISCUSSED_ON_CALL_LINE };
  }

  // range and legally_required both need real numbers the client supplied.
  if (min === null && max === null) {
    return {
      ok: false,
      blocker: "Enter the range you are willing to pay. We never estimate or benchmark one for you.",
    };
  }
  const range =
    min !== null && max !== null
      ? min === max
        ? money(min, currency)
        : `${money(min, currency)} to ${money(max, currency)}`
      : money((min ?? max) as number, currency);

  return {
    ok: true,
    disclosure: mandated ? "legally_required" : disclosure,
    line: note ? `${range}${suffix}. ${note}` : `${range}${suffix}`,
  };
}
