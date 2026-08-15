// Compensation decision support — evidence-only.
//
// Rules this module enforces:
//  1. We only ever show figures that exist on record (captured at intake,
//     shared by the candidate, or recorded on a real offer).
//  2. We never model, extrapolate, or estimate a market rate. If we don't
//     hold data, we say so.
//  3. Anything computed from fewer than MIN_SAMPLE real offers is marked
//     "thin data" and is explicitly NOT called a benchmark.

export const MIN_SAMPLE = 3;

export type MoneyRange = {
  min: number | null;
  max: number | null;
  currency: string | null;
  period: string | null;
  /** Original text we parsed, kept so the client can see the raw record. */
  raw: string | null;
};

export type CompSource = "intake" | "candidate" | "offers_on_record";

export type CompFigure = {
  label: string;
  /** Formatted, human-readable value. Null when nothing is on record. */
  display: string | null;
  source: CompSource;
  sourceLabel: string;
  /** Number of real records behind the figure (1 for a single stated value). */
  sampleSize: number;
  /** True when we hold too little data to treat this as representative. */
  thin: boolean;
  note: string | null;
};

export type CompAlignment = "in_range" | "above_range" | "below_range" | "unknown";

export type CompensationSignal = {
  location: string | null;
  roleRange: MoneyRange | null;
  candidateExpectation: MoneyRange | null;
  offersOnRecord: {
    count: number;
    min: number | null;
    max: number | null;
    currency: string | null;
    period: string | null;
  } | null;
  figures: CompFigure[];
  alignment: CompAlignment;
  alignmentNote: string;
  /** Overall: do we hold enough to support a decision? */
  dataQuality: "on_record" | "thin" | "none";
  disclaimer: string;
};

// ─── Parsing ────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  "₹": "INR",
  "kr": "SEK",
};

const PERIOD_WORDS: Array<[RegExp, string]> = [
  [/\b(per\s+hour|hourly|\/\s*h(r|our)?)\b/i, "hour"],
  [/\b(per\s+day|daily|\/\s*day)\b/i, "day"],
  [/\b(per\s+month|monthly|\/\s*mo(nth)?)\b/i, "month"],
  [/\b(per\s+year|annually|annual|p\.?a\.?|\/\s*y(r|ear)?)\b/i, "year"],
];

/** Turn "80.000-120.000", "€80k – 120k", "50000" into numbers we can trust. */
function parseAmount(token: string): number | null {
  let t = token.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  const kMultiplier = /k$/.test(t) ? 1000 : 1;
  t = t.replace(/k$/, "");
  // Thousands separators: 80.000 / 80,000 / 80 000 → 80000
  t = t.replace(/[.,](?=\d{3}\b)/g, "");
  // Remaining comma acts as a decimal point.
  t = t.replace(/,/g, ".");
  const n = Number(t.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n * kMultiplier;
}

export function parseMoneyRange(input: unknown): MoneyRange | null {
  if (input == null) return null;
  const text = String(input).trim();
  if (!text) return null;

  let currency: string | null = null;
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(sym)) {
      currency = code;
      break;
    }
  }
  const iso = text.match(/\b(EUR|USD|GBP|CHF|SEK|NOK|DKK|PLN|AED|INR|CAD|AUD)\b/i);
  if (iso) currency = iso[1].toUpperCase();

  let period: string | null = null;
  for (const [re, p] of PERIOD_WORDS) {
    if (re.test(text)) {
      period = p;
      break;
    }
  }

  const numeric = text.match(/\d[\d.,\s]*k?/gi) ?? [];
  const amounts = numeric
    .map((t) => parseAmount(t))
    .filter((n): n is number => n != null);

  if (amounts.length === 0) return null;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return {
    min,
    max: amounts.length > 1 && max !== min ? max : null,
    currency,
    period,
    raw: text,
  };
}

/** Pull a range out of the JSON we store on positions / candidate profiles. */
export function rangeFromRecord(raw: unknown): MoneyRange | null {
  if (raw == null) return null;
  if (typeof raw === "string") return parseMoneyRange(raw);
  if (typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const min = num(r.min ?? r.min_amount ?? r.minimum ?? r.low ?? r.target ?? r.expected ?? r.amount);
  const max = num(r.max ?? r.max_amount ?? r.maximum ?? r.high);
  const currency = typeof r.currency === "string" ? r.currency.toUpperCase() : null;
  const period =
    typeof r.period === "string"
      ? r.period
      : typeof r.cadence === "string"
        ? r.cadence
        : typeof r.frequency === "string"
          ? r.frequency
          : null;
  if (min != null || max != null) {
    return { min, max, currency, period, raw: null };
  }
  const text = [r.display, r.summary, r.note, r.text, r.expectation]
    .map((v) => (typeof v === "string" ? v : null))
    .find((v) => v && v.trim());
  return text ? parseMoneyRange(text) : null;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

export function formatAmount(n: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: currency ? "currency" : "decimal",
      currency: currency ?? undefined,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n).toLocaleString("en-US")}${currency ? ` ${currency}` : ""}`;
  }
}

export function formatRange(r: MoneyRange | null): string | null {
  if (!r) return null;
  const { min, max, currency, period } = r;
  const suffix = period ? ` / ${period}` : "";
  if (min != null && max != null) {
    return `${formatAmount(min, currency)} – ${formatAmount(max, currency)}${suffix}`;
  }
  if (min != null) return `${formatAmount(min, currency)}${suffix}`;
  if (max != null) return `Up to ${formatAmount(max, currency)}${suffix}`;
  return r.raw;
}

// ─── Alignment ──────────────────────────────────────────────────────────────

export function classifyAlignment(
  role: MoneyRange | null,
  cand: MoneyRange | null,
): CompAlignment {
  if (!role || !cand) return "unknown";
  const ask = cand.min ?? cand.max;
  if (ask == null) return "unknown";
  if (role.currency && cand.currency && role.currency !== cand.currency) return "unknown";
  const lo = role.min ?? -Infinity;
  const hi = role.max ?? role.min ?? Infinity;
  if (ask < lo) return "below_range";
  if (ask > hi) return "above_range";
  return "in_range";
}

const ALIGNMENT_NOTE: Record<CompAlignment, string> = {
  in_range: "In range — Candidate expectation sits inside the approved role range.",
  above_range: "Above range — The candidate is asking for more than the range set at intake. Review if the gap can be closed by total rewards or negotiation.",
  below_range: "Below range — The candidate expectation is below the minimum range set for this role.",
  unknown: "Not comparable yet — one side of the figure isn't on record.",
};

// ─── Assembly ───────────────────────────────────────────────────────────────

export type CompensationInputs = {
  /** positions.compensation JSON as stored. */
  roleCompensation: unknown;
  /** candidate_profiles.compensation_preferences JSON as stored. */
  candidateCompensation: unknown;
  location: string | null;
  /** Real offers recorded for this role + location. Never modelled. */
  offerAmounts: Array<{ amount: number; currency: string | null; period: string | null }>;
};

export function buildCompensationSignal(input: CompensationInputs): CompensationSignal {
  const roleRange = rangeFromRecord(input.roleCompensation);
  const candidateExpectation = rangeFromRecord(input.candidateCompensation);

  const amounts = input.offerAmounts.filter((o) => Number.isFinite(o.amount) && o.amount > 0);
  const offersOnRecord =
    amounts.length > 0
      ? {
          count: amounts.length,
          min: Math.min(...amounts.map((a) => a.amount)),
          max: Math.max(...amounts.map((a) => a.amount)),
          currency: amounts[0].currency ?? roleRange?.currency ?? null,
          period: amounts[0].period ?? roleRange?.period ?? null,
        }
      : null;

  const figures: CompFigure[] = [
    {
      label: input.location ? `Role range — ${input.location}` : "Role range",
      display: formatRange(roleRange),
      source: "intake",
      sourceLabel: "Captured at intake",
      sampleSize: roleRange ? 1 : 0,
      thin: false,
      note: roleRange ? null : "No range on record for this role. We don't estimate one.",
    },
    {
      label: "Candidate expectation",
      display: formatRange(candidateExpectation),
      source: "candidate",
      sourceLabel: "Stated by the candidate",
      sampleSize: candidateExpectation ? 1 : 0,
      thin: false,
      note: candidateExpectation ? null : "The candidate hasn't shared an expectation yet.",
    },
    {
      label: "Offers you've made for this role",
      display: offersOnRecord
        ? offersOnRecord.min === offersOnRecord.max
          ? formatAmount(offersOnRecord.min!, offersOnRecord.currency)
          : `${formatAmount(offersOnRecord.min!, offersOnRecord.currency)} – ${formatAmount(
              offersOnRecord.max!,
              offersOnRecord.currency,
            )}`
        : null,
      source: "offers_on_record",
      sourceLabel: offersOnRecord
        ? `${offersOnRecord.count} offer${offersOnRecord.count === 1 ? "" : "s"} on record`
        : "No offers on record",
      sampleSize: offersOnRecord?.count ?? 0,
      thin: (offersOnRecord?.count ?? 0) > 0 && (offersOnRecord?.count ?? 0) < MIN_SAMPLE,
      note: offersOnRecord
        ? offersOnRecord.count < MIN_SAMPLE
          ? `Thin data — based on ${offersOnRecord.count} offer${
              offersOnRecord.count === 1 ? "" : "s"
            }. Read it as history, not a benchmark.`
          : "Your own offer history for this role. Not a market benchmark."
        : "No offers recorded yet for this role.",
    },
  ];

  const alignment = classifyAlignment(roleRange, candidateExpectation);
  const onRecord = figures.filter((f) => f.display).length;
  const dataQuality: CompensationSignal["dataQuality"] =
    onRecord === 0 ? "none" : figures.some((f) => f.thin) || onRecord < 2 ? "thin" : "on_record";

  const disclaimer =
    dataQuality === "none"
      ? "We hold no compensation data for this role yet. We won't show an estimate in its place."
      : "Every figure here comes from your own records — intake, the candidate, or offers you've made. Nothing is modelled or benchmarked.";

  return {
    location: input.location,
    roleRange,
    candidateExpectation,
    offersOnRecord,
    figures,
    alignment,
    alignmentNote: ALIGNMENT_NOTE[alignment],
    dataQuality,
    disclaimer,
  };
}
