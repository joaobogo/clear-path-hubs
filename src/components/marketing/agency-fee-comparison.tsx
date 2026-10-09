/**
 * Agency-fee comparison — static, transparent example math for 1, 3, and 10
 * hires. Agency percentages and salary are clearly labelled as examples;
 * TaaSFlow figures come from the canonical pricing anchors.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CALCULATOR_DEFAULTS } from "@/config/public-pricing";
import { CTA_PRIMARY, CTA_MESSAGE } from "@/config/cta";
import { compareCosts } from "@/lib/pricing-comparison";

/** Same salary example as the calculator. An example, not an industry fact. */
const EXAMPLE_SALARY = CALCULATOR_DEFAULTS.averageSalaryUsd;
const FEE_LOW = 20;
const FEE_HIGH = 25;

const usd = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function scenario(hires: number, label: string, packageNote: string) {
  const at = (pct: number) =>
    compareCosts({ mode: "project", hires, agencyFeePct: pct, salaryUsd: EXAMPLE_SALARY });
  const lo = at(FEE_LOW);
  const hi = at(FEE_HIGH);
  if (lo.status !== "ok" || hi.status !== "ok") throw new Error("example scenario must be priced");
  return {
    hires,
    label,
    package: packageNote,
    cost: lo.taasTotalUsd,
    low: lo.agencyTotalUsd,
    high: hi.agencyTotalUsd,
    savingLow: lo.differenceUsd,
    savingHigh: hi.differenceUsd,
  };
}

const SCENARIOS = [
  scenario(1, "1 hire", "Pilot: one position, one per company"),
  scenario(3, "3 hires", "3 hires fit inside the Up to 10 positions package"),
  scenario(10, "10 hires", "Up to 10 positions package"),
];

export function AgencyFeeComparison() {
  return (
    <div>
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
          Flat fee vs placement fee
        </p>
        <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
          The same hires, without the percentage.
        </h2>
        <p className="mt-4 text-base text-[color:var(--brand-navy)]/80">
          Example math on a {usd(EXAMPLE_SALARY)} average salary and an agency
          fee of {FEE_LOW}–{FEE_HIGH}% of first-year salary. Both are editable examples,
          not industry facts. Your numbers will differ; this is illustrative, not a quote.
        </p>
      </div>

      {/* Mobile: one card per scenario */}
      <ul className="mt-8 space-y-3 md:hidden">
        {SCENARIOS.map((s) => (
          <li
            key={s.hires}
            className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-4 shadow-[var(--brand-shadow-sm)]"
          >
            <p className="text-base font-semibold text-[color:var(--brand-navy)]">
              {s.label}
            </p>
            <p className="text-xs text-[color:var(--brand-navy)]/80">
              {usd(EXAMPLE_SALARY)} average salary
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[color:var(--brand-navy)]/80">Agency fee ({FEE_LOW}–{FEE_HIGH}%)</span>
                <span className="shrink-0 tabular-nums text-[color:var(--brand-navy)]">
                  {usd(s.low)} – {usd(s.high)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[color:var(--brand-navy)]/80">TaaSFlow flat fee</span>
                <span className="shrink-0 tabular-nums font-semibold text-[color:var(--brand-navy)]">
                  {usd(s.cost)}
                </span>
              </div>
              <p className="text-xs text-[color:var(--brand-navy)]/80">{s.package}</p>
              <div className="rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">
                  Difference
                </p>
                <p className="mt-0.5 tabular-nums font-semibold text-[color:var(--brand-ocean-text)]">
                  {usd(s.savingLow)} – {usd(s.savingHigh)} less with TaaSFlow
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white shadow-[var(--brand-shadow-sm)] md:block" tabIndex={0} role="region" aria-label="Agency fee comparison table, scroll horizontally">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">

          <caption className="sr-only">
            Example cost comparison between agency placement fees at 20 to 25
            percent of a {usd(EXAMPLE_SALARY)} example salary and flat-fee TaaSFlow
            packages, for 1, 3, and 10 hires.
          </caption>
          <thead>
            <tr className="border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/80">
              <th scope="col" className="px-5 py-3">Scenario</th>
              <th scope="col" className="px-5 py-3">Agency fee ({FEE_LOW}–{FEE_HIGH}%)</th>
              <th scope="col" className="px-5 py-3">TaaSFlow flat fee</th>
              <th scope="col" className="px-5 py-3">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--brand-navy)]/8">
            {SCENARIOS.map((s) => (
              <tr key={s.hires}>
                <th
                  scope="row"
                  className="px-5 py-4 align-top font-semibold text-[color:var(--brand-navy)]"
                >
                  {s.label}
                  <span className="mt-0.5 block text-xs font-normal text-[color:var(--brand-navy)]/80">
                    {usd(EXAMPLE_SALARY)} average salary
                  </span>
                </th>
                <td className="px-5 py-4 align-top tabular-nums text-[color:var(--brand-navy)]/85">
                  {usd(s.low)} – {usd(s.high)}
                  <span className="mt-0.5 block text-xs text-[color:var(--brand-navy)]/80">
                    Charged per placement
                  </span>
                </td>
                <td className="px-5 py-4 align-top tabular-nums font-semibold text-[color:var(--brand-navy)]">
                  {usd(s.cost)}
                  <span className="mt-0.5 block text-xs font-normal text-[color:var(--brand-navy)]/80">
                    {s.package}
                  </span>
                </td>
                <td className="px-5 py-4 align-top tabular-nums font-semibold text-[color:var(--brand-ocean-text)]">
                  {usd(s.savingLow)} – {usd(s.savingHigh)}
                  <span className="mt-0.5 block text-xs font-normal text-[color:var(--brand-navy)]/80">
                    Less with TaaSFlow, for the same number of hires
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-[color:var(--brand-navy)]/80">
        Examples only. Agency fees vary by market and seniority; TaaSFlow package
        prices are fixed and published. The Up to 10 positions package covers up to 10 positions for one total. The flat fee covers the search — you are
        never charged a percentage of salary when someone is hired.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          to={CTA_PRIMARY.to}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[color:var(--blue-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[color:var(--blue-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          {CTA_PRIMARY.label}{" "}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          to={CTA_MESSAGE.to}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:border-[color:var(--brand-navy)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          {CTA_MESSAGE.label}
        </Link>
      </div>
    </div>
  );
}
