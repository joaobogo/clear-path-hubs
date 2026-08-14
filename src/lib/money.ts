/**
 * ONE money formatter for the whole app.
 *
 * Two different scales exist in the database and mixing them up printed
 * "€640" for a €64,000 offer:
 *   - `payments.amount_cents`     → minor units (cents)
 *   - `hire_records.salary_amount` → major units (whole euros/dollars)
 *
 * So every render goes through one of two named helpers, and the name states
 * the scale of the number being passed. Never divide or multiply by 100 at a
 * call site — if you are reaching for `/ 100`, you want `formatMoneyFromCents`.
 */

const DEFAULT_CURRENCY = "EUR";

function format(amountMajor: number, currency: string | null | undefined): string {
  const cur = (currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amountMajor);
  } catch {
    // Unknown/invalid currency code — still show the number, never "NaN".
    return `${cur} ${Math.round(amountMajor).toLocaleString("en-US")}`;
  }
}

/** Format a value stored in MAJOR units (e.g. `hire_records.salary_amount`). */
export function formatMoneyMajor(
  amount: number | null | undefined,
  currency?: string | null,
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  return format(Number(amount), currency);
}

/** Format a value stored in MINOR units (e.g. `payments.amount_cents`). */
export function formatMoneyFromCents(
  cents: number | null | undefined,
  currency?: string | null,
): string {
  if (cents == null || !Number.isFinite(Number(cents))) return "—";
  return format(Number(cents) / 100, currency);
}

/** Compact form for dense strips: €64k, €1.2M. Input is MAJOR units. */
export function formatMoneyMajorCompact(
  amount: number | null | undefined,
  currency?: string | null,
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  const cur = (currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Number(amount));
  } catch {
    return formatMoneyMajor(amount, currency);
  }
}

/** Salary line for a hire/offer record, including the period when known. */
export function formatSalaryLine(hire: {
  salary_amount: number | null | undefined;
  salary_currency?: string | null;
  salary_period?: string | null;
}): string | null {
  if (hire.salary_amount == null) return null;
  const base = formatMoneyMajor(hire.salary_amount, hire.salary_currency);
  return hire.salary_period ? `${base}/${hire.salary_period}` : base;
}
