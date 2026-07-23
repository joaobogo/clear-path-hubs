/**
 * TaaSFlow ROI Calculator — reusable component.
 *
 * Variants:
 *   - "homepage"      — compact, embedded in the homepage flow
 *   - "pricing"       — full detail for the Pricing page
 *   - "presentation"  — larger typography for demos / decks
 *
 * All variants share the same math (see src/lib/roi-calculator.ts) and the
 * same canonical pricing (see src/config/public-pricing.ts). No database
 * reads or writes. No anonymous input persistence.
 */

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ArrowRight, Info } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  CALCULATOR_DEFAULTS,
  CALCULATOR_LIMITS,
  CALCULATOR_DISCLAIMER,
  CALCULATOR_PRESETS,
  formatUsdCompact,
} from "@/config/public-pricing";
import { computeRoi, type CalculatorInputs } from "@/lib/roi-calculator";

export type RoiCalculatorVariant = "homepage" | "pricing" | "presentation";

export interface RoiCalculatorProps {
  variant?: RoiCalculatorVariant;
  /** When false, the component renders results only (no eyebrow/heading). */
  showHeading?: boolean;
  /** Override the default eyebrow. */
  eyebrow?: string;
  /** Override the default heading. */
  heading?: string;
  /** Override the default supporting copy. */
  supportingCopy?: string;
  /** When false, hide the pair of CTAs beneath the results. */
  showCtas?: boolean;
  /**
   * Fires whenever the computed result changes. Downstream consumers use this
   * to adapt CTA copy without duplicating pricing math (single source of truth
   * = src/lib/roi-calculator.ts).
   */
  onResultChange?: (result: import("@/lib/roi-calculator").CalculatorResult) => void;
  className?: string;
}


const DEFAULT_EYEBROW = "Recruiting Cost Calculator";
const DEFAULT_HEADING = "Cut your cost-per-hire. See the math.";
const DEFAULT_COPY =
  "Adjust the assumptions to reflect your hiring plan.";

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatUsdExact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPercent(fraction: number) {
  return `${Math.round(fraction * 100)}%`;
}

/* --------------------------------------------------------------- Stepper */

interface StepperProps {
  id: string;
  label: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  helper?: string;
  showSlider?: boolean;
}

function Stepper({
  id,
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  onChange,
  format,
  helper,
  showSlider = true,
}: StepperProps) {
  const dec = () => onChange(clamp(value - step, min, max));
  const inc = () => onChange(clamp(value + step, min, max));

  return (
    <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/65"
        >
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Decrease ${ariaLabel ?? label}`}
            onClick={dec}
            disabled={value <= min}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <output
            htmlFor={id}
            className="min-w-[4.5rem] rounded-md bg-[color:var(--brand-navy)]/5 px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-[color:var(--brand-navy)]"
            aria-live="polite"
          >
            {format(value)}
          </output>
          <button
            type="button"
            aria-label={`Increase ${ariaLabel ?? label}`}
            onClick={inc}
            disabled={value >= max}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {showSlider ? (
        <div className="mt-3">
          <Slider
            id={id}
            aria-label={ariaLabel ?? label}
            value={[value]}
            min={min}
            max={max}
            step={step}
            onValueChange={(v) => onChange(clamp(v[0] ?? min, min, max))}
          />
        </div>
      ) : null}
      {helper ? (
        <p className="mt-2 text-[11px] text-[color:var(--brand-navy)]/55">{helper}</p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- ResultRow */

function ResultRow({
  label,
  value,
  emphasis = false,
  muted = false,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-[color:var(--brand-navy)]/8 py-2.5 last:border-0",
        muted && "text-[color:var(--brand-navy)]/55",
      )}
    >
      <div className="min-w-0">
        <p className={cn(
          "text-sm",
          emphasis ? "font-semibold text-[color:var(--brand-navy)]" : "text-[color:var(--brand-navy)]/75",
        )}>
          {label}
        </p>
        {hint ? (
          <p className="mt-0.5 text-[11px] text-[color:var(--brand-navy)]/55">{hint}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "shrink-0 text-right tabular-nums",
          emphasis
            ? "font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]"
            : "text-sm font-semibold text-[color:var(--brand-navy)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Component */

export function RoiCalculator({
  variant = "homepage",
  showHeading = true,
  eyebrow = DEFAULT_EYEBROW,
  heading = DEFAULT_HEADING,
  supportingCopy = DEFAULT_COPY,
  showCtas = true,
  onResultChange,
  className,
}: RoiCalculatorProps) {
  const [inputs, setInputs] = React.useState<CalculatorInputs>({
    positions: CALCULATOR_DEFAULTS.positions,
    averageSalaryUsd: CALCULATOR_DEFAULTS.averageSalaryUsd,
    agencyFeePct: CALCULATOR_DEFAULTS.agencyFeePct,
    recruiterHourlyUsd: CALCULATOR_DEFAULTS.recruiterHourlyUsd,
    sourcingHoursPerRole: CALCULATOR_DEFAULTS.sourcingHoursPerRole,
  });
  const [showHelper, setShowHelper] = React.useState(false);

  const result = React.useMemo(() => computeRoi(inputs), [inputs]);

  React.useEffect(() => {
    onResultChange?.(result);
  }, [result, onResultChange]);


  const patch = <K extends keyof CalculatorInputs>(key: K, v: number) =>
    setInputs((prev) => ({ ...prev, [key]: v }));

  const headingSize =
    variant === "presentation"
      ? "text-4xl sm:text-5xl"
      : variant === "pricing"
        ? "text-3xl sm:text-4xl"
        : "text-3xl sm:text-4xl";

  return (
    <section
      aria-labelledby="roi-calc-heading"
      className={cn(
        "rounded-3xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] p-6 shadow-sm sm:p-8 lg:p-10 motion-safe:transition-colors",
        className,
      )}
    >
      {showHeading ? (
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            {eyebrow}
          </p>
          <h2
            id="roi-calc-heading"
            className={cn(
              "mt-3 font-[family-name:var(--brand-font-display)] font-semibold tracking-tight text-[color:var(--brand-navy)]",
              headingSize,
            )}
          >
            {heading}
          </h2>
          <p className="mt-3 text-[color:var(--brand-navy)]/75">{supportingCopy}</p>

          {/* How to read this — expandable helper (Prompt 12) */}
          <div className="mt-4 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white">
            <button
              type="button"
              aria-expanded={showHelper}
              aria-controls="roi-helper-body"
              onClick={() => setShowHelper((s) => !s)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              <span className="inline-flex items-center gap-2">
                <Info className="h-4 w-4 text-[color:var(--brand-ocean)]" aria-hidden />
                How to read this calculator
              </span>
              <span className="text-xs font-medium text-[color:var(--brand-navy)]/55">
                {showHelper ? "Hide" : "Show"}
              </span>
            </button>
            {showHelper ? (
              <div
                id="roi-helper-body"
                className="border-t border-[color:var(--brand-navy)]/8 px-4 py-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/75"
              >
                <ul className="grid gap-2 sm:grid-cols-2">
                  <li>
                    <span className="font-semibold text-[color:var(--brand-navy)]">Traditional cost</span> = agency placement (positions × salary × fee) plus internal sourcing time (positions × hourly × hours).
                  </li>
                  <li>
                    <span className="font-semibold text-[color:var(--brand-navy)]">TaaSFlow cost</span> comes from the approved package that covers your volume — never a fabricated number.
                  </li>
                  <li>
                    <span className="font-semibold text-[color:var(--brand-navy)]">Presets</span> only change the inputs. The math still runs against the same approved pricing.
                  </li>
                  <li>
                    <span className="font-semibold text-[color:var(--brand-navy)]">Custom quote</span> appears when your volume crosses into Subscription — no savings number is invented.
                  </li>
                  <li>
                    <span className="font-semibold text-[color:var(--brand-navy)]">Negative savings</span> is shown honestly when your inputs don't favor us — we surface it instead of hiding it.
                  </li>
                  <li>
                    <span className="font-semibold text-[color:var(--brand-navy)]">Sliders</span> respond to arrow keys, Page Up/Down, and Home/End for precise adjustment.
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        </header>
      ) : null}


      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Inputs */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
              Assumptions
            </p>
            <p className="text-[11px] text-[color:var(--brand-navy)]/50">
              Presets adjust inputs only — never results.
            </p>
          </div>

          <div
            role="group"
            aria-label="Scenario presets"
            className="mt-3 flex flex-wrap gap-2"
          >
            {CALCULATOR_PRESETS.map((preset) => {
              const active =
                inputs.positions === preset.inputs.positions &&
                inputs.averageSalaryUsd === preset.inputs.averageSalaryUsd &&
                Math.round(inputs.agencyFeePct * 100) === Math.round(preset.inputs.agencyFeePct * 100) &&
                inputs.recruiterHourlyUsd === preset.inputs.recruiterHourlyUsd &&
                inputs.sourcingHoursPerRole === preset.inputs.sourcingHoursPerRole;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  title={preset.description}
                  onClick={() => setInputs({ ...preset.inputs })}
                  className={cn(
                    "min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]",
                    active
                      ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                      : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] hover:border-[color:var(--brand-navy)]/30",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3">
            <Stepper
              id="roi-positions"
              label="Positions to fill"
              value={inputs.positions}
              min={CALCULATOR_LIMITS.positions.min}
              max={CALCULATOR_LIMITS.positions.max}
              step={CALCULATOR_LIMITS.positions.step}
              format={(v) => `${v}`}
              onChange={(v) => patch("positions", v)}
              helper="Approved pricing tiers apply from 1 to 10 positions; 11+ moves to Subscription."
            />
            <Stepper
              id="roi-salary"
              label="Average salary"
              value={inputs.averageSalaryUsd}
              min={CALCULATOR_LIMITS.averageSalaryUsd.min}
              max={CALCULATOR_LIMITS.averageSalaryUsd.max}
              step={CALCULATOR_LIMITS.averageSalaryUsd.step}
              format={(v) => formatUsdCompact(v)}
              onChange={(v) => patch("averageSalaryUsd", v)}
            />
            <Stepper
              id="roi-fee"
              label="Typical agency fee"
              ariaLabel="agency fee percentage"
              value={inputs.agencyFeePct}
              min={CALCULATOR_LIMITS.agencyFeePct.min}
              max={CALCULATOR_LIMITS.agencyFeePct.max}
              step={CALCULATOR_LIMITS.agencyFeePct.step}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch("agencyFeePct", Math.round(v * 100) / 100)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Stepper
                id="roi-hourly"
                label="Recruiter hourly cost"
                value={inputs.recruiterHourlyUsd}
                min={CALCULATOR_LIMITS.recruiterHourlyUsd.min}
                max={CALCULATOR_LIMITS.recruiterHourlyUsd.max}
                step={CALCULATOR_LIMITS.recruiterHourlyUsd.step}
                format={(v) => `$${v}/hr`}
                onChange={(v) => patch("recruiterHourlyUsd", v)}
                showSlider={false}
              />
              <Stepper
                id="roi-hours"
                label="Sourcing hours per role"
                value={inputs.sourcingHoursPerRole}
                min={CALCULATOR_LIMITS.sourcingHoursPerRole.min}
                max={CALCULATOR_LIMITS.sourcingHoursPerRole.max}
                step={CALCULATOR_LIMITS.sourcingHoursPerRole.step}
                format={(v) => `${v}h`}
                onChange={(v) => patch("sourcingHoursPerRole", v)}
                showSlider={false}
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div
          className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 sm:p-6"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/55">
            Estimated cost comparison
          </p>

          {/* Proportional cost bars */}
          {(() => {
            const maxCost = Math.max(
              result.traditionalCostUsd,
              result.taasflowCostUsd ?? 0,
              1,
            );
            const tradPct = (result.traditionalCostUsd / maxCost) * 100;
            const taasPct = result.taasflowCostUsd == null
              ? 0
              : (result.taasflowCostUsd / maxCost) * 100;
            return (
              <div className="mt-4 space-y-3" aria-hidden>
                <div>
                  <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
                    <span>Traditional</span>
                    <span className="tabular-nums text-[color:var(--brand-navy)]">
                      {formatUsdCompact(result.traditionalCostUsd)}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[color:var(--brand-navy)]/8">
                    <div
                      className="h-full rounded-full bg-[color:var(--brand-navy)]/70 motion-safe:transition-all motion-safe:duration-500"
                      style={{ width: `${Math.max(2, Math.min(100, tradPct))}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
                    <span>TaaSFlow</span>
                    <span className="tabular-nums text-[color:var(--brand-navy)]">
                      {result.taasflowCostUsd == null
                        ? "Custom"
                        : formatUsdCompact(result.taasflowCostUsd)}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[color:var(--brand-ocean)]/10">
                    <div
                      className="h-full rounded-full bg-[color:var(--brand-ocean)] motion-safe:transition-all motion-safe:duration-500"
                      style={{
                        width: result.taasflowCostUsd == null
                          ? "8%"
                          : `${Math.max(2, Math.min(100, taasPct))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-5">
            <ResultRow
              label="Traditional recruiting cost"
              value={formatUsdCompact(result.traditionalCostUsd)}
              emphasis
            />
            <ResultRow
              label="Agency placement fees"
              value={formatUsdCompact(result.agencyCostUsd)}
              hint={`${inputs.positions} × ${formatUsdCompact(inputs.averageSalaryUsd)} × ${Math.round(inputs.agencyFeePct * 100)}%`}
            />
            <ResultRow
              label="Internal sourcing cost"
              value={formatUsdCompact(result.internalSourcingCostUsd)}
              hint={`${inputs.positions} × $${inputs.recruiterHourlyUsd}/hr × ${inputs.sourcingHoursPerRole}h`}
            />
          </div>

          <div className="mt-4 rounded-xl bg-[color:var(--brand-navy)] p-5 text-white">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                TaaSFlow cost
              </p>
              {result.taasflowPackage ? (
                <p className="text-[11px] text-white/70">
                  {result.taasflowPackage.name}
                </p>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <p className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tabular-nums">
                {result.taasflowCostUsd == null
                  ? "Custom"
                  : formatUsdCompact(result.taasflowCostUsd)}
              </p>
              {result.taasflowCostUsd != null ? (
                <p className="text-xs text-white/70">
                  {result.taasflowPackage?.billingType === "monthly-subscription"
                    ? "per month"
                    : "flat fee"}
                </p>
              ) : null}
            </div>
            {/* Annualized context — only meaningful for monthly billing */}
            {result.taasflowCostUsd != null &&
            result.taasflowPackage?.billingType === "monthly-subscription" ? (
              <p className="mt-1 text-[11px] text-white/60">
                Annualized reference: {formatUsdCompact(result.taasflowCostUsd * 12)} at 12 months.
                Subscription is month-to-month — cancel anytime.
              </p>
            ) : null}


            {result.isCustomPricing ? (
              <div className="mt-4 rounded-lg bg-white/8 p-3 text-sm text-white/85">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-white/80" aria-hidden />
                  <p>
                    This volume is scoped on a custom quote. Talk to Sales for
                    an exact price — we don&rsquo;t fabricate a savings number
                    when pricing isn&rsquo;t final.
                  </p>
                </div>
                <Link
                  to="/contact"
                  className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Talk to enterprise <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="mt-4 border-t border-white/15 pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                    Projected savings
                  </p>
                  <p className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tabular-nums">
                    {result.projectedSavingsUsd == null
                      ? "—"
                      : formatUsdCompact(result.projectedSavingsUsd)}
                  </p>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-4">
                  <p className="text-xs text-white/70">Projected reduction</p>
                  <p className="text-sm font-semibold tabular-nums text-white/90">
                    {result.projectedReductionPct == null
                      ? "—"
                      : formatPercent(result.projectedReductionPct)}
                  </p>
                </div>
                {result.hasNegativeSavings ? (
                  <p className="mt-3 rounded-md bg-white/10 p-2.5 text-xs text-white/85">
                    At these assumptions, TaaSFlow does not show a cost
                    reduction versus your inputs. Adjust volume, agency fee,
                    or internal sourcing hours to compare a different scenario.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <p className="mt-4 text-[11px] text-[color:var(--brand-navy)]/55">
            Traditional cost = agency placement + internal sourcing. TaaSFlow
            cost comes from the current approved pricing tier for the selected
            volume. Amounts shown to nearest hundred.
          </p>
        </div>
      </div>

      {showCtas ? (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/intake"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            Start Hiring <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            View Pricing
          </Link>
        </div>
      ) : null}

      <p className="mt-6 max-w-3xl text-xs text-[color:var(--brand-navy)]/55">
        {CALCULATOR_DISCLAIMER}
      </p>

      {/* Belt-and-suspenders: expose exact figures for screen readers */}
      <p className="sr-only" aria-live="polite">
        Traditional recruiting cost {formatUsdExact(result.traditionalCostUsd)}.
        TaaSFlow cost{" "}
        {result.taasflowCostUsd == null
          ? "custom quote"
          : formatUsdExact(result.taasflowCostUsd)}
        .{" "}
        {result.projectedSavingsUsd == null
          ? ""
          : `Projected savings ${formatUsdExact(result.projectedSavingsUsd)}.`}
      </p>
    </section>
  );
}

export default RoiCalculator;
