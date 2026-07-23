import { useState } from "react";

/**
 * Live ROI comparator: TaaSFlow one-off package vs percent-of-salary agency,
 * plus internal recruiter sourcing time. Defaults match the taasflow.com/pricing
 * ROI illustration (5 positions, 20% agency fee, $85K avg salary → $2.1K vs
 * $90K traditional = ~98% savings). No fake data — every number is derived
 * from user inputs.
 */
export function AgencyComparator({
  defaultSalary = 85000,
  defaultHires = 5,
  defaultAgencyPct = 20,
  defaultPackageFee = 2100,
  defaultInternalHourly = 40,
  defaultInternalHours = 25,
}: {
  defaultSalary?: number;
  defaultHires?: number;
  defaultAgencyPct?: number;
  defaultPackageFee?: number;
  defaultInternalHourly?: number;
  defaultInternalHours?: number;
}) {
  const [salary, setSalary] = useState(defaultSalary);
  const [hires, setHires] = useState(defaultHires);
  const [pct, setPct] = useState(defaultAgencyPct);
  const [packageFee, setPackageFee] = useState(defaultPackageFee);
  const [hourly, setHourly] = useState(defaultInternalHourly);
  const [hours, setHours] = useState(defaultInternalHours);

  const agencyCost = salary * (pct / 100) * hires;
  const sourcingCost = hourly * hours * hires;
  const traditionalCost = agencyCost + sourcingCost;
  const taasCost = packageFee;
  const delta = traditionalCost - taasCost;
  const savings = delta > 0 ? delta : 0;
  const savingsPct = traditionalCost > 0 ? Math.round((savings / traditionalCost) * 100) : 0;

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
      <div className="mt-3 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Positions to fill" value={hires} onChange={setHires} step={1} min={1} />
        <Field label="Agency fee (% of salary)" value={pct} onChange={setPct} step={1} min={0} max={40} suffix="%" />
        <Field label="Average salary (USD)" value={salary} onChange={setSalary} step={5000} min={0} prefix="$" />
        <Field label="TaaSFlow package fee (USD)" value={packageFee} onChange={setPackageFee} step={100} min={0} prefix="$" />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
        Internal Recruiter Cost
      </p>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <Field label="Hourly rate" value={hourly} onChange={setHourly} step={5} min={0} prefix="$" />
        <Field label="Hours per role" value={hours} onChange={setHours} step={1} min={0} suffix="h" />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Result
          label="Traditional Cost"
          value={traditionalCost}
          tone="neutral"
          detail={`Agency $${Math.round(agencyCost).toLocaleString("en-US")} · Sourcing $${Math.round(sourcingCost).toLocaleString("en-US")}`}
        />
        <Result
          label="TaaSFlow Cost"
          value={taasCost}
          tone="highlight"
          detail="Multi Position one-off package (2–5)"
        />
        <Result
          label="Projected Savings"
          value={savings}
          tone={savings > 0 ? "positive" : "neutral"}
          detail={savings > 0 ? `${savingsPct}% reduction` : "No savings at these inputs"}
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

function Field({
  label,
  value,
  onChange,
  step,
  min,
  max,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
        {label}
      </span>
      <div className="mt-1 flex items-center gap-1.5 rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2 focus-within:border-[color:var(--brand-navy)]">
        {prefix ? (
          <span className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]/60">
            {prefix}
          </span>
        ) : null}
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-transparent font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)] outline-none"
        />
        {suffix ? (
          <span className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]/60">
            {suffix}
          </span>
        ) : null}
      </div>
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
  value: number;
  tone: "neutral" | "highlight" | "positive";
  detail?: string;
}) {
  const bg =
    tone === "highlight"
      ? "bg-[color:var(--brand-navy)] text-white"
      : tone === "positive"
        ? "bg-[color:var(--brand-cream)] text-[color:var(--brand-navy)]"
        : "bg-white text-[color:var(--brand-navy)] border border-[color:var(--brand-navy)]/10";
  const sub = tone === "highlight" ? "text-white/70" : "text-[color:var(--brand-navy)]/55";
  const compact = value >= 1000 ? `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K` : `$${Math.round(value).toLocaleString("en-US")}`;
  return (
    <div className={"rounded-2xl p-5 " + bg}>
      <p className={"text-xs font-semibold uppercase tracking-wider " + sub}>{label}</p>
      <p className="mt-1 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
        {compact}
      </p>
      {detail ? <p className={"mt-1 text-xs " + sub}>{detail}</p> : null}
    </div>
  );
}
