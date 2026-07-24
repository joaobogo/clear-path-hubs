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
 *
 * Visual direction: Editorial ledger — inputs in a cream column on the left,
 * a large navy "annual savings" card on the right with the winning number set
 * in italic display serif. Traditional vs TaaSFlow split lives beneath the
 * headline. Selected in the Phase 1 redesign ritual (see docs/brand-system.md).
 */

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Minus, Plus, ArrowRight, Info, Calculator } from "lucide-react";

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
import { trackEvent } from "@/lib/analytics";

export type RoiCalculatorVariant = "homepage" | "pricing" | "presentation";

export interface RoiCalculatorProps {
  variant?: RoiCalculatorVariant;
  showHeading?: boolean;
  eyebrow?: string;
  heading?: string;
  supportingCopy?: string;
  showCtas?: boolean;
  onResultChange?: (result: import("@/lib/roi-calculator").CalculatorResult) => void;
  className?: string;
}

const DEFAULT_EYEBROW = "Recruiting Cost Calculator";
const DEFAULT_HEADING = "Quantify your hiring advantage.";
const DEFAULT_COPY =
  "Adjust the variables to compare traditional recruitment costs against the TaaSFlow model.";

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

/* --------------------------------------------------------------- Field */

interface FieldProps {
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

function Field({
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
}: FieldProps) {
  const dec = () => onChange(clamp(value - step, min, max));
  const inc = () => onChange(clamp(value + step, min, max));

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/45"
        >
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Decrease ${ariaLabel ?? label}`}
            onClick={dec}
            disabled={value <= min}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <output
            htmlFor={id}
            className="min-w-[5.5rem] text-right font-[family-name:var(--brand-font-display)] text-xl font-medium tabular-nums text-[color:var(--brand-navy)]"
            aria-live="polite"
          >
            {format(value)}
          </output>
          <button
            type="button"
            aria-label={`Increase ${ariaLabel ?? label}`}
            onClick={inc}
            disabled={value >= max}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {showSlider ? (
        <Slider
          id={id}
          aria-label={ariaLabel ?? label}
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(clamp(v[0] ?? min, min, max))}
        />
      ) : (
        <div className="h-px w-full bg-[color:var(--brand-navy)]/10" />
      )}
      {helper ? (
        <p className="text-[11px] text-[color:var(--brand-navy)]/55">{helper}</p>
      ) : null}
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
  const [showFormula, setShowFormula] = React.useState(false);

  const result = React.useMemo(() => computeRoi(inputs), [inputs]);

  React.useEffect(() => {
    onResultChange?.(result);
  }, [result, onResultChange]);

  const patch = <K extends keyof CalculatorInputs>(key: K, v: number) =>
    setInputs((prev) => ({ ...prev, [key]: v }));

  const headingSize =
    variant === "presentation"
      ? "text-5xl sm:text-6xl"
      : "text-4xl sm:text-5xl";

  const savingsHeadline = result.isCustomPricing
    ? "Custom"
    : result.projectedSavingsUsd == null
      ? "—"
      : formatUsdCompact(result.projectedSavingsUsd);

  return (
    <section
      aria-labelledby="roi-calc-heading"
      className={cn(
        "rounded-3xl border border-[color:var(--brand-navy)]/10 bg-white p-6 shadow-sm sm:p-10 lg:p-12 motion-safe:transition-colors",
        className,
      )}
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14 items-start">
        {/* -------------------------------------------- Inputs column (5/12) */}
        <div className="lg:col-span-5 space-y-10 order-2 lg:order-1">
          {showHeading ? (
            <header className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-navy)]/60">
                {eyebrow}
              </p>
              <h2
                id="roi-calc-heading"
                className={cn(
                  "font-[family-name:var(--brand-font-display)] leading-[1.05] tracking-tight text-[color:var(--brand-navy)]",
                  headingSize,
                )}
              >
                {heading.split(" ").slice(0, -2).join(" ")}{" "}
                <span className="italic">
                  {heading.split(" ").slice(-2).join(" ")}
                </span>
              </h2>
              <p className="max-w-sm text-[color:var(--brand-navy)]/60">
                {supportingCopy}
              </p>
            </header>
          ) : null}

          {/* Preset chips */}
          <div
            role="group"
            aria-label="Scenario presets"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
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
                  onClick={() => {
                    setInputs({ ...preset.inputs });
                    trackEvent("calculator.preset_selected", {
                      preset_id: preset.id,
                      variant,
                      positions: preset.inputs.positions,
                    });
                  }}
                  className={cn(
                    "min-h-8 shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]",
                    active
                      ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                      : "border-[color:var(--brand-navy)]/20 bg-transparent text-[color:var(--brand-navy)]/75 hover:border-[color:var(--brand-navy)]/40 hover:text-[color:var(--brand-navy)]",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Inputs */}
          <div className="space-y-8">
            <Field
              id="roi-positions"
              label="Number of positions"
              value={inputs.positions}
              min={CALCULATOR_LIMITS.positions.min}
              max={CALCULATOR_LIMITS.positions.max}
              step={CALCULATOR_LIMITS.positions.step}
              format={(v) => `${v} ${v === 1 ? "role" : "roles"}`}
              onChange={(v) => patch("positions", v)}
              helper="1–10 maps to approved packages; 11+ moves to a scoped quote."
            />
            <Field
              id="roi-fee"
              label="Agency fee percentage"
              ariaLabel="agency fee percentage"
              value={inputs.agencyFeePct}
              min={CALCULATOR_LIMITS.agencyFeePct.min}
              max={CALCULATOR_LIMITS.agencyFeePct.max}
              step={CALCULATOR_LIMITS.agencyFeePct.step}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => patch("agencyFeePct", Math.round(v * 100) / 100)}
            />
            <Field
              id="roi-salary"
              label="Average salary"
              value={inputs.averageSalaryUsd}
              min={CALCULATOR_LIMITS.averageSalaryUsd.min}
              max={CALCULATOR_LIMITS.averageSalaryUsd.max}
              step={CALCULATOR_LIMITS.averageSalaryUsd.step}
              format={(v) => formatUsdCompact(v)}
              onChange={(v) => patch("averageSalaryUsd", v)}
            />
            <div className="grid grid-cols-2 gap-8 pt-2">
              <Field
                id="roi-hourly"
                label="Hourly rate"
                value={inputs.recruiterHourlyUsd}
                min={CALCULATOR_LIMITS.recruiterHourlyUsd.min}
                max={CALCULATOR_LIMITS.recruiterHourlyUsd.max}
                step={CALCULATOR_LIMITS.recruiterHourlyUsd.step}
                format={(v) => `$${v}`}
                onChange={(v) => patch("recruiterHourlyUsd", v)}
                showSlider={false}
              />
              <Field
                id="roi-hours"
                label="Hours per role"
                value={inputs.sourcingHoursPerRole}
                min={CALCULATOR_LIMITS.sourcingHoursPerRole.min}
                max={CALCULATOR_LIMITS.sourcingHoursPerRole.max}
                step={CALCULATOR_LIMITS.sourcingHoursPerRole.step}
                format={(v) => `${v} hrs`}
                onChange={(v) => patch("sourcingHoursPerRole", v)}
                showSlider={false}
              />
            </div>
          </div>
        </div>

        {/* ---------------------------------------- Results column (7/12) */}
        <div className="lg:col-span-7 order-1 lg:order-2">
          <div
            className="relative overflow-hidden bg-[color:var(--brand-navy)] p-8 text-white shadow-2xl sm:p-12 md:p-14 rounded-2xl"
            aria-live="polite"
            aria-atomic="true"
          >
            {/* Decorative crosshair — echoes the ledger metaphor */}
            <div className="pointer-events-none absolute right-6 top-6 opacity-[0.08]" aria-hidden>
              <svg width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
                <circle cx="50" cy="50" r="45" />
                <path d="M50 5 L50 95 M5 50 L95 50" />
              </svg>
            </div>

            <div className="relative z-10">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] opacity-60">
                {result.isCustomPricing ? "Scoped quote required" : "Annual savings summary"}
              </span>

              <div className="mt-10">
                <h3 className="font-[family-name:var(--brand-font-display)] italic tracking-tight leading-[0.95] text-6xl sm:text-7xl md:text-8xl tabular-nums">
                  {savingsHeadline}
                </h3>
                <p className="mt-3 max-w-md text-base opacity-80 font-light">
                  {result.isCustomPricing
                    ? "Volumes above 10 positions run on a scoped quote — no savings figure is invented."
                    : result.hasNegativeSavings
                      ? "At these assumptions, TaaSFlow doesn't beat your traditional cost. Adjust volume, fee, or internal hours."
                      : `Total projected annual savings with TaaSFlow${result.projectedReductionPct != null ? ` — ${formatPercent(result.projectedReductionPct)} reduction` : ""}.`}
                </p>
              </div>

              {/* Traditional vs TaaSFlow ledger */}
              <div className="mt-14 grid grid-cols-1 gap-10 border-t border-white/20 pt-10 md:grid-cols-2">
                <div>
                  <span className="block text-[10px] uppercase tracking-[0.18em] opacity-45">
                    Traditional agency model
                  </span>
                  <p className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl md:text-4xl tabular-nums text-white/90">
                    {formatUsdCompact(result.traditionalCostUsd)}
                  </p>
                  <p className="mt-1 text-xs opacity-50">
                    {inputs.positions} × {formatUsdCompact(inputs.averageSalaryUsd)} × {Math.round(inputs.agencyFeePct * 100)}% + internal sourcing.
                  </p>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-white/70">
                    TaaSFlow platform
                    {result.taasflowPackage ? ` · ${result.taasflowPackage.name}` : ""}
                  </span>
                  <p className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl md:text-4xl tabular-nums">
                    {result.taasflowCostUsd == null
                      ? "Custom"
                      : formatUsdCompact(result.taasflowCostUsd)}
                  </p>
                  <p className="mt-1 text-xs opacity-50">
                    {result.taasflowCostUsd == null
                      ? "Scoped with founders — no fabricated number."
                      : result.taasflowPackage?.billingType === "monthly-subscription"
                        ? `Per month · annualized ${formatUsdCompact(result.taasflowCostUsd * 12)}`
                        : "Flat package fee."}
                  </p>
                </div>
              </div>

              {/* CTA */}
              {showCtas ? (
                <div className="mt-14 grid gap-3 sm:grid-cols-2">
                  <Link
                    to="/intake"
                    onClick={() =>
                      trackEvent("calculator.cta_clicked", {
                        cta: "start_hiring",
                        variant,
                        mode: result.isCustomPricing
                          ? "custom"
                          : result.hasNegativeSavings
                            ? "negative"
                            : "standard",
                        positions: inputs.positions,
                        projected_savings_usd: result.projectedSavingsUsd ?? undefined,
                      })
                    }
                    className="group inline-flex min-h-12 items-center justify-between gap-3 rounded-md bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)] transition-all hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <span>Start hiring</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                  <Link
                    to={result.isCustomPricing ? "/contact" : "/pricing"}
                    onClick={() =>
                      trackEvent("calculator.cta_clicked", {
                        cta: result.isCustomPricing ? "enterprise_quote" : "view_pricing",
                        variant,
                        positions: inputs.positions,
                      })
                    }
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/30 px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-all hover:bg-white hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {result.isCustomPricing ? "Talk to founders" : "View pricing"}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          {/* Footnote rule */}
          <div className="mt-6 flex items-center gap-4 px-2">
            <div className="h-px flex-1 bg-[color:var(--brand-navy)]/10" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/45 whitespace-nowrap">
              Directional · based on SHRM & Ashby 2025 benchmarks
            </p>
            <div className="h-px flex-1 bg-[color:var(--brand-navy)]/10" />
          </div>
        </div>
      </div>

      {/* Exact formula — collapsible */}
      <div className="mt-10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/70">
        <button
          type="button"
          aria-expanded={showFormula}
          aria-controls="roi-formula-body"
          onClick={() => setShowFormula((s) => !s)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] sm:px-6"
        >
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/65">
            <Calculator className="h-3.5 w-3.5" aria-hidden />
            Exact formula, using your numbers
          </span>
          <span className="text-[11px] font-medium text-[color:var(--brand-navy)]/50">
            {showFormula ? "Hide" : "Show"}
          </span>
        </button>
        {showFormula ? (
          <div
            id="roi-formula-body"
            className="border-t border-[color:var(--brand-navy)]/10 px-5 pb-6 pt-5 sm:px-6"
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-[color:var(--brand-navy)]/5 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
                  Agency placement
                </dt>
                <dd className="mt-1 font-mono text-[13px] tabular-nums text-[color:var(--brand-navy)]">
                  {inputs.positions} × {formatUsdCompact(inputs.averageSalaryUsd)} × {Math.round(inputs.agencyFeePct * 100)}%
                  <span className="mx-1 text-[color:var(--brand-navy)]/50">=</span>
                  <span className="font-semibold">{formatUsdCompact(result.agencyCostUsd)}</span>
                </dd>
              </div>
              <div className="rounded-lg bg-[color:var(--brand-navy)]/5 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
                  Internal sourcing
                </dt>
                <dd className="mt-1 font-mono text-[13px] tabular-nums text-[color:var(--brand-navy)]">
                  {inputs.positions} × ${inputs.recruiterHourlyUsd}/hr × {inputs.sourcingHoursPerRole}h
                  <span className="mx-1 text-[color:var(--brand-navy)]/50">=</span>
                  <span className="font-semibold">{formatUsdCompact(result.internalSourcingCostUsd)}</span>
                </dd>
              </div>
              <div className="rounded-lg bg-[color:var(--brand-navy)]/8 p-3 sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
                  Traditional total vs TaaSFlow
                </dt>
                <dd className="mt-1 font-mono text-[13px] tabular-nums text-[color:var(--brand-navy)]">
                  {formatUsdCompact(result.agencyCostUsd)} + {formatUsdCompact(result.internalSourcingCostUsd)}
                  <span className="mx-1 text-[color:var(--brand-navy)]/50">=</span>
                  <span className="font-semibold">{formatUsdCompact(result.traditionalCostUsd)}</span>
                  <span className="mx-2 text-[color:var(--brand-navy)]/50">−</span>
                  <span className="font-semibold">
                    {result.taasflowCostUsd == null ? "Custom quote" : formatUsdCompact(result.taasflowCostUsd)}
                  </span>
                  {result.projectedSavingsUsd != null ? (
                    <>
                      <span className="mx-1 text-[color:var(--brand-navy)]/50">=</span>
                      <span className="font-semibold text-[color:var(--brand-ocean)]">
                        {formatUsdCompact(result.projectedSavingsUsd)} savings
                      </span>
                    </>
                  ) : null}
                </dd>
                {result.isCustomPricing ? (
                  <p className="mt-2 text-[11px] text-[color:var(--brand-navy)]/60">
                    No savings figure is invented at this volume — the number comes from a scoped quote.
                  </p>
                ) : null}
              </div>
            </dl>
            {result.isCustomPricing ? (
              <div className="mt-4 flex items-start gap-2 rounded-md bg-[color:var(--brand-navy)]/5 p-3 text-sm text-[color:var(--brand-navy)]/80">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-ocean)]" aria-hidden />
                <p>
                  This volume is scoped on a custom quote. Talk to the founders for an
                  exact price — we don&rsquo;t fabricate a savings number when pricing
                  isn&rsquo;t final.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-6 max-w-3xl text-xs text-[color:var(--brand-navy)]/55">
        {CALCULATOR_DISCLAIMER}
      </p>

      {/* Belt-and-suspenders: exact figures for screen readers */}
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
