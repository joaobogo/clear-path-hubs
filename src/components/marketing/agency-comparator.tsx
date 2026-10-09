import { useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/**
 * Cost comparison calculator.
 *
 * Compares the SAME hires over the SAME period on both sides: agency fees for
 * those hires against the total of the one TaaSFlow monthly package that
 * covers them. The math lives in `src/lib/pricing-comparison.ts` (pure,
 * unit-tested). Every default is an editable example, not an industry fact.
 * Inputs never leave the browser and are not sent to analytics.
 *
 * Four sliders, no typing: the owner found the typed version confusing, and
 * the one-off project comparison was dropped from this view — the monthly
 * package is the comparison that matters here.
 */

import { Slider } from "@/components/ui/slider";
import { MAX_POSITIONS, formatUsdExact, packageForPositions } from "@/config/pricing-core";
import { CTA_PRIMARY, CTA_MESSAGE, CTA_ENTERPRISE } from "@/config/cta";
import {
  COMPARISON_DEFAULTS,
  DEFAULT_LABEL,
  compareCosts,
  describeDifference,
} from "@/lib/pricing-comparison";

/** Slider ranges. Wide enough for any real plan, coarse enough to drag to. */
const RANGES = {
  positions: { min: 1, max: MAX_POSITIONS, step: 1 },
  hires: { min: 1, max: 100, step: 1 },
  salary: { min: 20_000, max: 300_000, step: 5_000 },
  agencyPct: { min: 5, max: 40, step: 1 },
} as const;

const DEFAULTS = {
  positions: COMPARISON_DEFAULTS.positions,
  hires: Math.max(COMPARISON_DEFAULTS.hires, 10),
  months: COMPARISON_DEFAULTS.months,
  salary: COMPARISON_DEFAULTS.salaryUsd,
  agencyPct: COMPARISON_DEFAULTS.agencyFeePct,
} as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function AgencyComparator() {
  const [positions, setPositions] = useState<number>(DEFAULTS.positions);
  const [hires, setHires] = useState<number>(DEFAULTS.hires);
  const months = DEFAULTS.months;
  const [salary, setSalary] = useState<number>(DEFAULTS.salary);
  const [agencyPct, setAgencyPct] = useState<number>(DEFAULTS.agencyPct);
  const ids = useId();

  const result = useMemo(
    () => compareCosts({ mode: "recurring", hires, positions, agencyFeePct: agencyPct, salaryUsd: salary, months }),
    [hires, positions, agencyPct, salary, months],
  );
  const pkg = packageForPositions(positions);
  const quoteOnly = result.status === "quote-only";

  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8 lg:p-12">
      <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-14">
        {/* -------- Inputs column -------- */}
        <div className="order-2 space-y-7 lg:order-1 lg:col-span-5">
          <header className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-navy)]/80">
              Cost calculator
            </p>
            <h3 className="font-[family-name:var(--brand-font-display)] text-3xl leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Compare agency fees with a monthly package.
            </h3>
            <p className="max-w-sm text-sm text-[color:var(--brand-navy)]/80 sm:text-base">
              Drag the sliders to match your plan. {DEFAULT_LABEL} applies to every starting
              value. Nothing you set is saved or sent.
            </p>
          </header>

          <div className="space-y-6">
            <SliderField
              id={`${ids}-positions`}
              label="Positions open at once"
              value={positions}
              onChange={setPositions}
              range={RANGES.positions}
              display={plural(positions, "position", "positions")}
              hint={pkg ? `Covered by the ${pkg.capacityLabel.toLowerCase()} package` : "Above the largest package — scoped with your account team"}
            />
            <SliderField
              id={`${ids}-hires`}
              label="Hires in that time"
              value={hires}
              onChange={setHires}
              range={RANGES.hires}
              display={plural(hires, "hire", "hires")}
              hint="What an agency would charge a fee on"
            />
            <SliderField
              id={`${ids}-salary`}
              label="Average salary"
              value={salary}
              onChange={setSalary}
              range={RANGES.salary}
              display={formatUsdExact(salary)}
              hint="Example value"
            />
            <SliderField
              id={`${ids}-pct`}
              label="Agency fee"
              value={agencyPct}
              onChange={setAgencyPct}
              range={RANGES.agencyPct}
              display={`${agencyPct}% of salary`}
              hint="Example value"
            />
          </div>

          <div className="rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-4 text-sm text-[color:var(--brand-navy)]/85">
            <p className="font-semibold text-[color:var(--brand-navy)]">How it is worked out</p>
            <p className="mt-1 leading-relaxed">
              {result.status === "invalid"
                ? "Agency fees = hires × average salary × agency fee percentage. TaaSFlow = the monthly package that covers your positions × the number of months."
                : result.formula}
            </p>
            {result.status !== "invalid" ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 leading-relaxed">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {/* -------- Results column -------- */}
        <div className="order-1 min-w-0 lg:order-2 lg:col-span-7">
          <div
            className="relative overflow-hidden rounded-2xl bg-[color:var(--brand-navy)] p-6 text-white shadow-2xl sm:p-10"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
              Estimated cost comparison for this plan
            </span>

            {result.status === "invalid" ? (
              <div className="mt-6">
                <p className="font-[family-name:var(--brand-font-display)] text-3xl">
                  Check your numbers
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/90">
                  {result.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : result.status === "quote-only" ? (
              <div className="mt-6">
                <h4 className="font-[family-name:var(--brand-font-display)] text-4xl leading-tight sm:text-5xl">
                  Scoped with your account team
                </h4>
                <p className="mt-3 max-w-md text-sm text-white/90 sm:text-base">
                  {result.explanation}
                </p>
              </div>
            ) : (
              <div className="mt-6">
                <h4 className="break-words font-[family-name:var(--brand-font-display)] text-4xl leading-tight tabular-nums sm:text-5xl">
                  {describeDifference(result.differenceUsd)}
                </h4>
                <p className="mt-3 max-w-md text-sm text-white/90 sm:text-base">
                  {result.explanation}
                </p>
                <p className="mt-2 max-w-md text-xs text-white/75">
                  A negative result is possible: when agency fees are low or hires are few,
                  the agency can be the cheaper option.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-6 border-t border-white/20 pt-6 sm:grid-cols-2 sm:gap-10">
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-white/80">
                      Agency fees
                    </span>
                    <p className="mt-2 break-words font-[family-name:var(--brand-font-display)] text-2xl tabular-nums sm:text-3xl">
                      {formatUsdExact(result.agencyTotalUsd)}
                    </p>
                    <p className="mt-1 text-xs text-white/75">
                      {plural(result.hires, "hire", "hires")} × {formatUsdExact(salary)} × {agencyPct}%
                    </p>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-white/80">
                      TaaSFlow · {result.packageLabel}
                    </span>
                    <p className="mt-2 break-words font-[family-name:var(--brand-font-display)] text-2xl tabular-nums sm:text-3xl">
                      {formatUsdExact(result.taasTotalUsd)}
                    </p>
                    <p className="mt-1 text-xs text-white/75">
                      {formatUsdExact(result.taasTotalUsd / result.months)} a month × {result.months}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                to={quoteOnly ? CTA_ENTERPRISE.to : CTA_PRIMARY.to}
                className="inline-flex min-h-12 items-center justify-between gap-3 rounded-md bg-white px-5 py-3 text-sm font-semibold text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>{quoteOnly ? CTA_ENTERPRISE.label : CTA_PRIMARY.label}</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to={CTA_MESSAGE.to}
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {CTA_MESSAGE.label}
              </Link>
            </div>
          </div>

          <p className="mt-4 px-2 text-xs uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Illustrative
          </p>
          <p className="mt-1 px-2 text-xs leading-relaxed text-[color:var(--brand-navy)]/80">
            This is an estimate from the values you set, not a quote. Agency fees, salaries and
            hiring volume vary. The package total is the published monthly price for the package
            that covers your positions, before any annual-prepay discount.
          </p>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  id,
  label,
  value,
  onChange,
  range,
  display,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  range: { min: number; max: number; step: number };
  /** The value in words, shown large beside the label and read by screen readers. */
  display: string;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80"
        >
          {label}
        </label>
        <output
          htmlFor={id}
          aria-live="off"
          className="font-[family-name:var(--brand-font-display)] text-xl tabular-nums text-[color:var(--brand-navy)]"
        >
          {display}
        </output>
      </div>
      <Slider
        id={id}
        className="mt-3 [&_[role=slider]]:h-6 [&_[role=slider]]:w-6 [&_[role=slider]]:border-[color:var(--brand-navy)] [&_[role=slider]]:bg-white [&_[data-orientation=horizontal]>span]:bg-[color:var(--brand-navy)] [&>span]:h-2 [&>span]:bg-[color:var(--brand-navy)]/15"
        min={range.min}
        max={range.max}
        step={range.step}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
        aria-labelledby={`${id}-label`}
        aria-valuetext={display}
        aria-describedby={`${id}-hint`}
      />
      <div className="mt-1.5 flex justify-between text-[11px] text-[color:var(--brand-navy)]/60">
        <span>{formatBound(range.min, display)}</span>
        <span>{formatBound(range.max, display)}</span>
      </div>
      <p id={`${id}-hint`} className="mt-1 text-xs text-[color:var(--brand-navy)]/70">
        {hint}
      </p>
    </div>
  );
}

/** Range ends in the same unit as the value ("$20,000", "40%", or the plain number). */
function formatBound(n: number, display: string): string {
  if (display.startsWith("$")) return formatUsdExact(n);
  if (display.includes("%")) return `${n}%`;
  return String(n);
}
