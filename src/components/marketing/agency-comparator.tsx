import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/**
 * Homepage ROI calculator — "Editorial ledger" direction.
 *
 * Split layout: inputs on the left, a large navy savings card on the right
 * with the winning number set in italic display serif. Traditional vs
 * TaaSFlow ledger sits beneath the headline. Preserves the exact math and
 * tier mapping from src/content/pricing.ts (single source of truth).
 */

import { PRICING_TIERS } from "@/content/pricing";

type TierMatch = {
  label: string;
  detail: string;
  price: number | null; // null => custom / quote
};

function matchTier(positions: number): TierMatch {
  if (positions <= 0) {
    return { label: "—", detail: "Add at least 1 position", price: null };
  }
  if (positions === 1) {
    return {
      label: PRICING_TIERS[0].name,
      detail: "Pilot — Single Position (1)",
      price: PRICING_TIERS[0].oneTime,
    };
  }
  if (positions >= 2 && positions <= 5) {
    return {
      label: PRICING_TIERS[1].name,
      detail: "Multi Position package (2–5)",
      price: PRICING_TIERS[1].oneTime,
    };
  }
  if (positions >= 6 && positions <= 20) {
    return {
      label: PRICING_TIERS[2].name,
      detail: "Hiring Sprint package (6–20)",
      price: PRICING_TIERS[2].oneTime,
    };
  }
  return {
    label: "Custom Billing",
    detail: "20+ roles or continuous hiring — scoped quote",
    price: null,
  };
}

function formatCompact(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    const oneDecimal = Math.round(k * 10) / 10;
    return `$${Number.isInteger(oneDecimal) ? oneDecimal.toFixed(0) : oneDecimal.toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function AgencyComparator() {
  const [positions, setPositions] = useState(5);
  const [agencyPct, setAgencyPct] = useState(20);
  const [salary, setSalary] = useState(85000);
  const [hourly, setHourly] = useState(40);
  const [hours, setHours] = useState(25);

  const tier = useMemo(() => matchTier(positions), [positions]);

  const agencyCost = positions * salary * (agencyPct / 100);
  const sourcingCost = positions * hourly * hours;
  const traditionalCost = agencyCost + sourcingCost;
  const taasCost = tier.price ?? 0;
  const savings = tier.price == null ? null : Math.max(traditionalCost - taasCost, 0);
  const savingsPct =
    savings == null || traditionalCost <= 0
      ? null
      : Math.round((savings / traditionalCost) * 100);
  const isCustom = tier.price == null;

  return (
    <div className="rounded-3xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] p-6 shadow-sm sm:p-10 lg:p-12">
      <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
        {/* -------- Inputs column (5/12) -------- */}
        <div className="order-2 space-y-10 lg:order-1 lg:col-span-5">
          <header className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-navy)]/60">
              For hiring teams · ROI Calculator
            </p>
            <h3 className="font-[family-name:var(--brand-font-display)] text-4xl leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
              Quantify your <br /><span className="italic">hiring advantage.</span>
            </h3>
            <p className="max-w-sm text-[color:var(--brand-navy)]/60">
              Adjust the variables to compare traditional recruitment costs against the TaaSFlow model. Defaults from SHRM & Ashby 2025 benchmarks.
            </p>
          </header>

          <div className="space-y-8">
            <SliderField
              label="Number of positions"
              value={positions}
              onChange={setPositions}
              min={1}
              max={25}
              step={1}
              display={`${positions} ${positions === 1 ? "role" : "roles"}`}
            />
            <SliderField
              label="Agency fee percentage"
              value={agencyPct}
              onChange={setAgencyPct}
              min={0}
              max={40}
              step={1}
              display={`${agencyPct}%`}
            />
            <SliderField
              label="Average salary"
              value={salary}
              onChange={setSalary}
              min={20000}
              max={400000}
              step={5000}
              display={formatCompact(salary)}
            />

            <div className="grid grid-cols-2 gap-8 pt-2">
              <StaticField
                label="Hourly rate"
                value={hourly}
                onChange={setHourly}
                min={0}
                max={200}
                step={5}
                display={`$${hourly}`}
              />
              <StaticField
                label="Hours per role"
                value={hours}
                onChange={setHours}
                min={0}
                max={120}
                step={1}
                display={`${hours} hrs`}
              />
            </div>
          </div>
        </div>

        {/* -------- Results column (7/12) -------- */}
        <div className="order-1 lg:order-2 lg:col-span-7">
          <div
            className="relative overflow-hidden rounded-2xl bg-[color:var(--brand-navy)] p-8 text-[color:var(--brand-cream)] shadow-2xl sm:p-12 md:p-14"
            aria-live="polite"
            aria-atomic="true"
          >
            {/* Decorative crosshair */}
            <div className="pointer-events-none absolute right-6 top-6 opacity-[0.08]" aria-hidden>
              <svg width="140" height="140" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
                <circle cx="50" cy="50" r="45" />
                <path d="M50 5 L50 95 M5 50 L95 50" />
              </svg>
            </div>

            <div className="relative z-10">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] opacity-60">
                {isCustom ? "Scoped quote required" : "Annual savings summary"}
              </span>

              <div className="mt-10">
                <h4 className="font-[family-name:var(--brand-font-display)] text-6xl italic leading-[0.95] tracking-tight tabular-nums sm:text-7xl md:text-8xl">
                  {isCustom ? "Custom" : formatCompact(savings ?? 0)}
                </h4>
                <p className="mt-3 max-w-md text-base font-light opacity-80">
                  {isCustom
                    ? "Volumes above 20 positions run on a scoped quote — no savings figure is invented."
                    : savings != null && savings > 0
                      ? `Total projected savings with TaaSFlow${savingsPct != null ? ` — ${savingsPct}% reduction` : ""}.`
                      : "TaaSFlow doesn't beat your inputs here. Adjust volume, fee, or internal hours."}
                </p>
              </div>

              {/* Ledger split */}
              <div className="mt-14 grid grid-cols-1 gap-10 border-t border-[color:var(--brand-cream)]/20 pt-10 md:grid-cols-2">
                <div>
                  <span className="block text-[10px] uppercase tracking-[0.18em] opacity-45">
                    Traditional agency model
                  </span>
                  <p className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl tabular-nums text-[color:var(--brand-cream)]/90 md:text-4xl">
                    {formatCompact(traditionalCost)}
                  </p>
                  <p className="mt-1 text-xs opacity-50">
                    Agency {formatCompact(agencyCost)} · Sourcing {formatCompact(sourcingCost)}
                  </p>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[color:var(--brand-cream)]/70">
                    TaaSFlow · {tier.label}
                  </span>
                  <p className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl tabular-nums md:text-4xl">
                    {isCustom ? "Custom" : formatCompact(taasCost)}
                  </p>
                  <p className="mt-1 text-xs opacity-50">{tier.detail}</p>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-14 grid gap-3 sm:grid-cols-2">
                <Link
                  to="/intake"
                  className="group inline-flex min-h-12 items-center justify-between gap-3 rounded-md bg-[color:var(--brand-cream)] px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)] transition-all hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-cream)]"
                >
                  <span>Start hiring</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
                <Link
                  to={isCustom ? "/contact" : "/pricing"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[color:var(--brand-cream)]/30 px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-cream)] transition-all hover:bg-[color:var(--brand-cream)] hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-cream)]"
                >
                  {isCustom ? "Talk to founders" : "View pricing"}
                </Link>
              </div>
            </div>
          </div>

          {/* Footnote rule */}
          <div className="mt-6 flex items-center gap-4 px-2">
            <div className="h-px flex-1 bg-[color:var(--brand-navy)]/10" />
            <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/45">
              Directional · SHRM & Ashby 2025 benchmarks
            </p>
            <div className="h-px flex-1 bg-[color:var(--brand-navy)]/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Field primitives ---------- */

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
}) {
  return (
    <label className="block space-y-3">
      <div className="flex items-end justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/45">
          {label}
        </span>
        <span className="font-[family-name:var(--brand-font-display)] text-xl font-medium tabular-nums text-[color:var(--brand-navy)]">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[color:var(--brand-navy)]"
      />
    </label>
  );
}

function StaticField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
}) {
  return (
    <label className="block space-y-3">
      <div className="flex items-end justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/45">
          {label}
        </span>
        <span className="font-[family-name:var(--brand-font-display)] text-xl font-medium tabular-nums text-[color:var(--brand-navy)]">
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[color:var(--brand-navy)]"
      />
    </label>
  );
}
