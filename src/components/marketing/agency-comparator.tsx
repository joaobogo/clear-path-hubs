import { useState } from "react";

/**
 * Inline live comparator: subscription (fixed monthly) vs traditional agency
 * (percent-of-salary at hire). No fake data — every number is derived from
 * user inputs.
 */
export function AgencyComparator({
  defaultSalary = 120000,
  defaultHires = 3,
  defaultAgencyPct = 22,
  defaultMonthlyFee = 5900,
}: {
  defaultSalary?: number;
  defaultHires?: number;
  defaultAgencyPct?: number;
  defaultMonthlyFee?: number;
}) {
  const [salary, setSalary] = useState(defaultSalary);
  const [hires, setHires] = useState(defaultHires);
  const [pct, setPct] = useState(defaultAgencyPct);
  const [monthly, setMonthly] = useState(defaultMonthlyFee);
  const [months, setMonths] = useState(6);

  const agencyCost = salary * (pct / 100) * hires;
  const taasCost = monthly * months;
  const delta = agencyCost - taasCost;
  const savings = delta > 0 ? delta : 0;

  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
        Live comparison
      </p>
      <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
        Subscription vs percent-of-salary agency
      </h3>
      <p className="mt-2 max-w-2xl text-sm text-[color:var(--brand-navy)]/70">
        Adjust the inputs to compare a traditional agency invoice against a
        TaaSFlow subscription for the same hiring window. Numbers update live.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Average salary (USD)" value={salary} onChange={setSalary} step={5000} />
        <Field label="Hires in the window" value={hires} onChange={setHires} step={1} min={1} />
        <Field label="Agency fee (% of salary)" value={pct} onChange={setPct} step={1} min={0} max={40} />
        <Field label="Engagement months" value={months} onChange={setMonths} step={1} min={1} max={24} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
            TaaSFlow monthly fee (USD)
          </p>
          <input
            type="number"
            value={monthly}
            step={100}
            min={0}
            onChange={(e) => setMonthly(Number(e.target.value) || 0)}
            className="mt-1 w-full bg-transparent font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)] outline-none"
          />
        </div>
        <div className="rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
            Hiring window
          </p>
          <p className="mt-1 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            {months} months · {hires} hire{hires === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Result label="Traditional agency total" value={agencyCost} tone="neutral" />
        <Result label="TaaSFlow subscription total" value={taasCost} tone="highlight" />
        <Result label="Estimated savings" value={savings} tone={savings > 0 ? "positive" : "neutral"} />
      </div>

      <p className="mt-4 text-xs text-[color:var(--brand-navy)]/50">
        Directional estimate only. The contractual price is confirmed on your scoped quote.
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/55">
        {label}
      </span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-3 py-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)] outline-none focus:border-[color:var(--brand-navy)]"
      />
    </label>
  );
}

function Result({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "highlight" | "positive";
}) {
  const bg =
    tone === "highlight"
      ? "bg-[color:var(--brand-navy)] text-white"
      : tone === "positive"
        ? "bg-[color:var(--brand-cream)] text-[color:var(--brand-navy)]"
        : "bg-white text-[color:var(--brand-navy)] border border-[color:var(--brand-navy)]/10";
  const sub = tone === "highlight" ? "text-white/70" : "text-[color:var(--brand-navy)]/55";
  return (
    <div className={"rounded-2xl p-5 " + bg}>
      <p className={"text-xs font-semibold uppercase tracking-wider " + sub}>{label}</p>
      <p className="mt-1 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
        ${Math.round(value).toLocaleString("en-US")}
      </p>
    </div>
  );
}
