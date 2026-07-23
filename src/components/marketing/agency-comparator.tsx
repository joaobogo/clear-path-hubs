import { useMemo, useState } from "react";

/**
 * Exact clone of the ROI Calculator on taasflow.com/pricing.
 *
 * Source parity (verified against https://taasflow.com/pricing):
 *  - Eyebrow: "For hiring teams · ROI Calculator"
 *  - Title:   "Cut your cost-per-hire. See the math."
 *  - Copy:    "Defaults based on industry benchmarks (SHRM, Ashby 2025).
 *              Adjust the sliders to match your hiring plan."
 *  - Section "Assumptions & Inputs": Positions to fill (5), Agency fee (20%),
 *              Average Salary ($) — $85,000.
 *  - Section "Internal Recruiter Cost": Hourly rate ($40), Hours per role (25h).
 *  - Results:  Traditional Cost = agency + sourcing.
 *              TaaSFlow Cost = tier-selected one-off package
 *                (Pilot $399 / Multi $2.1K / Hiring Sprint $4.5K / Custom 11+).
 *              Projected Savings shown with "% reduction" band.
 *  - Disclaimer: SHRM & Ashby 2025 benchmarks.
 *
 * Prices come from src/content/pricing.ts (single source of truth).
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
      detail: "Pilot — Single Position one-off package (1)",
      price: PRICING_TIERS[0].oneTime,
    };
  }
  if (positions >= 2 && positions <= 5) {
    return {
      label: PRICING_TIERS[1].name,
      detail: "Multi Position one-off package (2-5)",
      price: PRICING_TIERS[1].oneTime,
    };
  }
  if (positions >= 6 && positions <= 20) {
    return {
      label: PRICING_TIERS[2].name,
      detail: "Hiring Sprint one-off package (6-20)",
      price: PRICING_TIERS[2].oneTime,
    };
  }
  return {
    label: "Custom Billing",
    detail: "20+ roles or continuous hiring — quote-based",
    price: null,
  };
}

function formatCompact(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    const oneDecimal = Math.round(k * 10) / 10;
    // Show one decimal only when it's not a whole number.
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

  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
        For hiring teams · ROI Calculator
      </p>
      <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
        Cut your cost-per-hire. See the math.
      </h3>
      <p className="mt-2 max-w-2xl text-sm text-[color:var(--brand-navy)]/70">
        Defaults based on industry benchmarks (SHRM, Ashby 2025). Adjust the
        sliders to match your hiring plan.
      </p>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
        Assumptions &amp; Inputs
      </p>
      <div className="mt-3 grid gap-5 md:grid-cols-3">
        <Slider
          label="Positions to fill"
          value={positions}
          onChange={setPositions}
          min={1}
          max={25}
          step={1}
          display={String(positions)}
        />
        <Slider
          label="Agency fee"
          value={agencyPct}
          onChange={setAgencyPct}
          min={0}
          max={40}
          step={1}
          display={`${agencyPct}%`}
        />
        <Slider
          label="Average Salary ($)"
          value={salary}
          onChange={setSalary}
          min={20000}
          max={400000}
          step={5000}
          display={formatCompact(salary)}
        />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
        Internal Recruiter Cost
      </p>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <Slider
          label="Hourly rate"
          value={hourly}
          onChange={setHourly}
          min={0}
          max={200}
          step={5}
          display={`$${hourly}`}
        />
        <Slider
          label="Hours per role"
          value={hours}
          onChange={setHours}
          min={0}
          max={120}
          step={1}
          display={`${hours}h`}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Result
          label="Traditional Cost"
          value={formatCompact(traditionalCost)}
          tone="neutral"
          detail={`Agency ${formatCompact(agencyCost)} · Sourcing ${formatCompact(sourcingCost)}`}
        />
        <Result
          label="TaaSFlow Cost"
          value={tier.price == null ? "Custom" : formatCompact(taasCost)}
          tone="highlight"
          detail={tier.detail}
        />
        <Result
          label="Projected Savings"
          value={savings == null ? "—" : formatCompact(savings)}
          tone={savings != null && savings > 0 ? "positive" : "neutral"}
          detail={
            savings == null
              ? "Quote-based — talk to us for a custom estimate"
              : savingsPct != null && savings > 0
                ? `${savingsPct}% reduction`
                : "No savings at these inputs"
          }
        />
      </div>

      <p className="mt-4 text-xs text-[color:var(--brand-navy)]/50">
        Estimates are directional and depend on role volume, salary, package,
        hiring complexity, and client context. Based on SHRM &amp; Ashby 2025
        benchmarks.
      </p>
    </div>
  );
}

function Slider({
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
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
          {label}
        </span>
        <span className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]">
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
        className="mt-2 w-full accent-[color:var(--brand-navy)]"
      />
    </label>
  );
}

function Result({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "neutral" | "highlight" | "positive";
  detail?: string;
}) {
  const bg =
    tone === "highlight"
      ? "bg-[color:var(--brand-navy)] text-white"
      : tone === "positive"
        ? "bg-[color:var(--brand-cream)] text-[color:var(--brand-navy)]"
        : "bg-white text-[color:var(--brand-navy)] border border-[color:var(--brand-navy)]/10";
  const sub =
    tone === "highlight" ? "text-white/70" : "text-[color:var(--brand-navy)]/55";
  return (
    <div className={"rounded-2xl p-5 " + bg}>
      <p className={"text-xs font-semibold uppercase tracking-wider " + sub}>
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
        {value}
      </p>
      {detail ? <p className={"mt-1 text-xs " + sub}>{detail}</p> : null}
    </div>
  );
}
