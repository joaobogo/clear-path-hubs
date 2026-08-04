import { useMemo, useState } from "react";
import { Calculator, TrendingDown } from "lucide-react";

/**
 * Cost of an Unfilled Position calculator — a linkable, self-contained tool.
 *
 * Purely presentational arithmetic on user-supplied inputs. It publishes no
 * benchmarks and asserts no outcomes: every number on screen is derived from
 * what the visitor typed.
 */

const WORKING_DAYS_PER_MONTH = 21.7;

type Inputs = {
  salary: number;
  valueMultiple: number;
  coverMonthly: number;
  delayedRevenueMonthly: number;
  daysOpen: number;
};

const DEFAULTS: Inputs = {
  salary: 70_000,
  valueMultiple: 1.5,
  coverMonthly: 1_500,
  delayedRevenueMonthly: 0,
  daysOpen: 45,
};

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(n)));
}

function Field({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  prefix,
  suffix,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        {prefix ? (
          <span className="text-sm text-muted-foreground">{prefix}</span>
        ) : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const next = Number(e.target.value);
            onChange(Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : min);
          }}
          className="w-full bg-transparent text-sm text-foreground outline-none"
        />
        {suffix ? (
          <span className="whitespace-nowrap text-sm text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export function UnfilledPositionCalculator() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);

  const set = <K extends keyof Inputs>(key: K) => (value: number) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(() => {
    const lostOutputMonthly = (inputs.salary * inputs.valueMultiple) / 12;
    const monthly =
      lostOutputMonthly + inputs.coverMonthly + inputs.delayedRevenueMonthly;
    const daily = monthly / WORKING_DAYS_PER_MONTH;
    return {
      lostOutputMonthly,
      monthly,
      daily,
      weekly: daily * 5,
      toDate: daily * inputs.daysOpen,
      twoWeeksSaved: daily * 10,
    };
  }, [inputs]);

  return (
    <section
      aria-labelledby="unfilled-cost-calculator"
      className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
          <Calculator className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2
            id="unfilled-cost-calculator"
            className="text-xl font-semibold tracking-tight text-foreground"
          >
            Cost of an unfilled position calculator
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your inputs, your number. Nothing is submitted or stored.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Field
            label="Annual salary for the role"
            hint="Base salary. Use the band midpoint if the role is not yet offered."
            prefix="$"
            value={inputs.salary}
            min={0}
            max={2_000_000}
            step={1_000}
            onChange={set("salary")}
          />
          <Field
            label="Value multiple of salary"
            hint="What the role is expected to produce relative to its cost. 1.0 is the conservative floor."
            suffix="×"
            value={inputs.valueMultiple}
            min={0}
            max={10}
            step={0.1}
            onChange={set("valueMultiple")}
          />
          <Field
            label="Monthly cover cost"
            hint="Overtime, contractors or agency cover while the seat is empty."
            prefix="$"
            value={inputs.coverMonthly}
            min={0}
            max={500_000}
            step={100}
            onChange={set("coverMonthly")}
          />
          <Field
            label="Monthly delayed revenue or delivery"
            hint="Deals, cases, shifts or projects that cannot start without this role. Leave at 0 if unknown."
            prefix="$"
            value={inputs.delayedRevenueMonthly}
            min={0}
            max={5_000_000}
            step={500}
            onChange={set("delayedRevenueMonthly")}
          />
          <Field
            label="Days the role has been open"
            hint="Calendar days since the role was approved."
            suffix="days"
            value={inputs.daysOpen}
            min={0}
            max={730}
            onChange={set("daysOpen")}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Cost per working day
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
              {money(result.daily)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {money(result.weekly)} per working week · {money(result.monthly)} per month
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-background p-4">
              <dt className="text-xs text-muted-foreground">Cost so far ({inputs.daysOpen} days)</dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {money(result.toDate)}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                Value of closing 2 weeks sooner
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-foreground">
                {money(result.twoWeeksSaved)}
              </dd>
            </div>
          </dl>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Method: lost output = salary × value multiple, spread over 12 months, plus
            cover cost and delayed revenue. Daily figures assume{" "}
            {WORKING_DAYS_PER_MONTH} working days per month. This is a framework for
            your own inputs, not an industry benchmark.
          </p>
        </div>
      </div>
    </section>
  );
}
