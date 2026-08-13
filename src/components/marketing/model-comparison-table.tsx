import { Link } from "@tanstack/react-router";
import { PRICE_PILOT_USD } from "@/config/pricing-core";

/**
 * "TaaSFlow vs. agencies vs. sourcing tools" — an operating-model comparison.
 *
 * Factual and non-combative: agencies and sourcing tools both do real work.
 * The point is what you receive and how you pay for it, not who is better.
 */

type Row = {
  dimension: string;
  agency: string;
  tools: string;
  taasflow: string;
};

const ROWS: Row[] = [
  {
    dimension: "What you receive",
    agency: "A batch of CVs, usually with a short cover note",
    tools: "Access to profiles and contact data — you do the outreach",
    taasflow: "Ranked, pre-screened candidates with evidence per requirement",
  },
  {
    dimension: "Who does the screening",
    agency: "The agency, using criteria you rarely see",
    tools: "Your team, on top of their existing workload",
    taasflow: "A recruiter, against criteria you approved in writing at intake",
  },
  {
    dimension: "Why a candidate ranks where they do",
    agency: "Explained verbally, if at all",
    tools: "Keyword and filter matches",
    taasflow: "A written fit narrative plus quotes from the CV behind every score",
  },
  {
    dimension: "Where the work happens",
    agency: "Email threads and spreadsheets",
    tools: "A sourcing tool your team logs into and works in",
    taasflow: "A shared dashboard with pipeline, decisions and audit trail",
  },
  {
    dimension: "How you pay",
    agency: "20–25% of first-year salary, per hire",
    tools: "Per-seat licence, plus your recruiter's time",
    taasflow: "One flat fee, independent of salary and hire count",
  },
  {
    dimension: "Cost of hiring two people instead of one",
    agency: "Roughly doubles",
    tools: "Same licence, double the internal effort",
    taasflow: "Unchanged within your active-role band",
  },
  {
    dimension: "Who owns the candidate data",
    agency: "The agency keeps the pipeline",
    tools: "You, inside that vendor's tool",
    taasflow: "You — candidates stay in your workspace, including the ones you pass on",
  },
];

const COL_HEAD =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider";

export function ModelComparisonTable({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
          Operating models
        </p>
        <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
          TaaSFlow vs. agencies vs. sourcing tools.
        </h2>
        <p className="mt-4 text-[color:var(--brand-navy)]/80">
          All three can fill a role. They differ in who does the screening, what
          arrives at the end, and what it costs when you hire again.
        </p>
      </div>

      {/* Mobile: stacked per-dimension cards — no horizontal scrolling */}
      <ul className="mt-8 space-y-3 md:hidden">
        {ROWS.map((r) => (
          <li
            key={r.dimension}
            className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-4"
          >
            <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
              {r.dimension}
            </p>
            <div className="mt-3 space-y-2.5 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/70">
                  Contingency agency
                </p>
                <p className="mt-0.5 text-[color:var(--brand-navy)]/80">{r.agency}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/70">
                  Sourcing tools &amp; job boards
                </p>
                <p className="mt-0.5 text-[color:var(--brand-navy)]/80">{r.tools}</p>
              </div>
              <div className="rounded-xl bg-[color:var(--brand-navy)]/[0.04] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]">
                  TaaSFlow Platform
                </p>
                <p className="mt-0.5 font-medium text-[color:var(--brand-navy)]">
                  {r.taasflow}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white md:block" tabIndex={0} role="region" aria-label="Hiring model comparison table, scroll horizontally">
        <table className="w-full min-w-[48rem] border-collapse text-sm">

          <caption className="sr-only">
            Comparison of contingency agencies, internal sourcing tools and
            TaaSFlow Platform
          </caption>
          <thead>
            <tr className="border-b border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/[0.03]">
              <th scope="col" className={`${COL_HEAD} text-[color:var(--brand-navy)]/80`}>
                <span className="sr-only">Dimension</span>
              </th>
              <th scope="col" className={`${COL_HEAD} text-[color:var(--brand-navy)]/80`}>
                Contingency agency
              </th>
              <th scope="col" className={`${COL_HEAD} text-[color:var(--brand-navy)]/80`}>
                Sourcing tools &amp; job boards
              </th>
              <th scope="col" className={`${COL_HEAD} text-[color:var(--brand-navy)]`}>
                TaaSFlow Platform
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr
                key={r.dimension}
                className="border-b border-[color:var(--brand-navy)]/8 align-top last:border-0"
              >
                <th
                  scope="row"
                  className="px-4 py-4 text-left text-sm font-semibold text-[color:var(--brand-navy)]"
                >
                  {r.dimension}
                </th>
                <td className="px-4 py-4 text-[color:var(--brand-navy)]/80">{r.agency}</td>
                <td className="px-4 py-4 text-[color:var(--brand-navy)]/80">{r.tools}</td>
                <td className="bg-[color:var(--brand-navy)]/[0.03] px-4 py-4 font-medium text-[color:var(--brand-navy)]">
                  {r.taasflow}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">

        <Link
          to="/pilot"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
        >
          Start with a ${PRICE_PILOT_USD} pilot
        </Link>
      </div>
    </div>
  );
}
