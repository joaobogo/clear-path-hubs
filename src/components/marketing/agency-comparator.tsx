import { useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/**
 * Cost comparison calculator.
 *
 * Compares the SAME hires over the SAME period on both sides: agency fees for
 * those hires against the total of the one TaaSFlow package that covers them.
 * The math lives in `src/lib/pricing-comparison.ts` (pure, unit-tested). Every
 * default is an editable example, not an industry fact. Inputs never leave the
 * browser and are not sent to analytics.
 */

import { formatUsdExact } from "@/config/pricing-core";
import { CTA_PRIMARY, CTA_MESSAGE, CTA_ENTERPRISE } from "@/config/cta";
import {
  COMPARISON_DEFAULTS,
  DEFAULT_LABEL,
  MAX_COMPARISON_MONTHS,
  compareCosts,
  describeDifference,
  type ComparisonMode,
} from "@/lib/pricing-comparison";

const toNumber = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

export function AgencyComparator() {
  const [mode, setMode] = useState<ComparisonMode>(COMPARISON_DEFAULTS.mode);
  const [hires, setHires] = useState(String(COMPARISON_DEFAULTS.hires));
  const [positions, setPositions] = useState(String(COMPARISON_DEFAULTS.positions));
  const [agencyPct, setAgencyPct] = useState(String(COMPARISON_DEFAULTS.agencyFeePct));
  const [salary, setSalary] = useState(String(COMPARISON_DEFAULTS.salaryUsd));
  const [months, setMonths] = useState(String(COMPARISON_DEFAULTS.months));
  const ids = useId();

  const result = useMemo(
    () =>
      compareCosts({
        mode,
        hires: toNumber(hires),
        positions: toNumber(positions),
        agencyFeePct: toNumber(agencyPct),
        salaryUsd: toNumber(salary),
        months: toNumber(months),
      }),
    [mode, hires, positions, agencyPct, salary, months],
  );

  const quoteOnly = result.status === "quote-only";

  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8 lg:p-12">
      <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-14">
        {/* -------- Inputs column -------- */}
        <div className="order-2 space-y-6 lg:order-1 lg:col-span-5">
          <header className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-navy)]/80">
              Cost calculator
            </p>
            <h3 className="font-[family-name:var(--brand-font-display)] text-3xl leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Compare agency fees with a flat package.
            </h3>
            <p className="max-w-sm text-sm text-[color:var(--brand-navy)]/80 sm:text-base">
              Change any number to match your plan. {DEFAULT_LABEL} applies to every
              starting value below. Nothing you type is saved or sent.
            </p>
          </header>

          <fieldset>
            <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              What are you comparing?
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["project", "One hiring project, paid once"],
                  ["recurring", "A recurring monthly package"],
                ] as const
              ).map(([value, text]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[color:var(--brand-navy)]/15 px-3 py-2 text-sm text-[color:var(--brand-navy)] has-[:checked]:border-[color:var(--brand-navy)] has-[:checked]:bg-[color:var(--brand-navy)]/[0.04] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--brand-focus-ring)]"
                >
                  <input
                    type="radio"
                    name={`${ids}-mode`}
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="accent-[color:var(--brand-navy)]"
                  />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <NumberField
              id={`${ids}-hires`}
              label={mode === "project" ? "Hires (and positions)" : "Hires in the period"}
              value={hires}
              onChange={setHires}
              min={1}
              step={1}
              hint="Whole number"
            />
            {mode === "recurring" ? (
              <NumberField
                id={`${ids}-positions`}
                label="Positions open at once"
                value={positions}
                onChange={setPositions}
                min={1}
                step={1}
                hint="Decides the package"
              />
            ) : null}
            {mode === "recurring" ? (
              <NumberField
                id={`${ids}-months`}
                label="Months"
                value={months}
                onChange={setMonths}
                min={1}
                max={MAX_COMPARISON_MONTHS}
                step={1}
                hint={`1 to ${MAX_COMPARISON_MONTHS}`}
              />
            ) : null}
            <NumberField
              id={`${ids}-salary`}
              label="Average salary (USD)"
              value={salary}
              onChange={setSalary}
              min={1}
              step={1000}
              hint="Example value"
            />
            <NumberField
              id={`${ids}-pct`}
              label="Agency fee (% of salary)"
              value={agencyPct}
              onChange={setAgencyPct}
              min={0}
              max={100}
              step={1}
              hint="Example value"
            />
          </div>

          <div className="rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-4 text-sm text-[color:var(--brand-navy)]/85">
            <p className="font-semibold text-[color:var(--brand-navy)]">How it is worked out</p>
            <p className="mt-1 leading-relaxed">
              {result.status === "invalid"
                ? "Agency fees = hires × average salary × agency fee percentage. TaaSFlow = the total of the package that covers your positions."
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
              Estimated cost comparison for this hiring project
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
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-white/80">
                      TaaSFlow · {result.packageLabel}
                    </span>
                    <p className="mt-2 break-words font-[family-name:var(--brand-font-display)] text-2xl tabular-nums sm:text-3xl">
                      {formatUsdExact(result.taasTotalUsd)}
                    </p>
                    <p className="mt-1 text-xs text-white/75">
                      {result.mode === "project"
                        ? "Paid once"
                        : `${formatUsdExact(result.taasTotalUsd / result.months)} a month × ${result.months}`}
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
            This is an estimate from the numbers you entered, not a quote. Agency fees, salaries and
            hiring volume vary. The package total is the published price for the package that
            covers your positions.
          </p>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max?: number;
  step: number;
  hint: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 min-h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 py-2 text-base tabular-nums text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-[color:var(--brand-navy)]/70">
        {hint}
      </p>
    </div>
  );
}
