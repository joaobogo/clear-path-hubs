import { Check } from "lucide-react";
import {
  type EntitlementRow,
  type EntitlementValue,
} from "@/config/pricing-entitlements";

/**
 * Compact presentation of the entitlement table. The config
 * (pricing-entitlements.ts) keeps the full wording; this component only
 * shortens how it reads. Rows whose cells are identical across every
 * published package render as a short checklist; the rest render as a
 * lean table with short labels and icon answers.
 */

const SHORT_LABEL: Record<string, string> = {
  active_roles: "Active roles",
  workspace_seats: "Seats",
  agent_capacity: "Agent capacity",
  candidate_records: "Candidate records",
  data_retention: "Data retention",
  hiring_intelligence: "Hiring intelligence",
  evidence_graph: "Evidence behind every score",
  governance: "Governance & approvals",
  audit_exports: "Audit exports",
  integrations: "Integrations",
  support: "Support",
  expert_oversight: "Recruiter review",
  included_results: "Shortlists",
};

const PLAN_HEAD: Record<string, { main: string; sub: string }> = {
  pilot: { main: "Pilot", sub: "1 position" },
  growth: { main: "Up to 10", sub: "positions" },
  scale: { main: "Up to 20", sub: "positions" },
  volume: { main: "Up to 30", sub: "positions" },
  portfolio: { main: "Up to 40", sub: "positions" },
  program: { main: "Up to 100", sub: "positions" },
  enterprise: { main: "100+", sub: "scoped" },
};

const ALWAYS_LINE: Record<string, string> = {
  candidate_records: "Unmetered candidate records. No per-CV charges.",
  evidence_graph: "The evidence behind every score.",
};

const PENDING_SHORT = "On your quote";

function Cell({ v }: { v: EntitlementValue }) {
  if (v.kind === "included") {
    return (
      <span className="inline-flex">
        <Check className="h-4 w-4 text-[color:var(--blue-600)]" aria-hidden />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (v.kind === "not-included") {
    return (
      <span className="text-sm text-[color:var(--brand-navy)]/40">
        <span aria-hidden>—</span>
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  if (v.kind === "pending") {
    return (
      <span className="text-xs text-[color:var(--brand-navy)]/70">{PENDING_SHORT}</span>
    );
  }
  return (
    <span className="block">
      <span className="block text-sm font-medium text-[color:var(--brand-navy)]">
        {v.label}
      </span>
      {v.note ? (
        <span className="mt-0.5 block text-xs text-[color:var(--brand-navy)]/70">
          {v.note}
        </span>
      ) : null}
    </span>
  );
}

export function EntitlementMatrix({
  rows,
  planIds,
  planLabels,
  caption,
  selectedPlanId,
}: {
  rows: EntitlementRow[];
  planIds: readonly string[];
  planLabels: Record<string, string>;
  caption: string;
  /** The package chosen above the table: its column sits on pale blue with a blue top rule. */
  selectedPlanId?: string;
}) {
  const sameEverywhere = (row: EntitlementRow) => {
    const cells = planIds.map((id) => JSON.stringify(row.plans[id] ?? null));
    return new Set(cells).size === 1;
  };
  const alwaysRows = rows.filter(sameEverywhere);
  const varyingRows = rows.filter((row) => !sameEverywhere(row));
  const shortLabel = (row: EntitlementRow) => SHORT_LABEL[row.id] ?? row.label;
  const alwaysText = (row: EntitlementRow) => {
    if (ALWAYS_LINE[row.id]) return ALWAYS_LINE[row.id];
    const v = row.plans[planIds[0]!];
    if (v?.kind === "value") {
      return v.note
        ? `${shortLabel(row)}: ${v.label} — ${v.note}`
        : `${shortLabel(row)}: ${v.label}`;
    }
    return shortLabel(row);
  };
  const selectedCol = (id: string) => (id === selectedPlanId ? "bg-[color:var(--blue-50)]" : "");

  return (
    <div>
      {alwaysRows.length > 0 ? (
        <ul
          className="grid gap-x-8 gap-y-2.5 text-sm font-medium text-[color:var(--brand-navy)] sm:grid-cols-2"
          aria-label="The same in every package"
        >
          {alwaysRows.map((row) => (
            <li key={row.id} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--blue-600)]" aria-hidden />
              <span>{alwaysText(row)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[color:var(--brand-navy)]/[0.04]">
              <th
                scope="col"
                className="sticky left-0 z-10 w-[140px] min-w-[140px] bg-[color:var(--brand-navy)]/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/80"
              >
                By package
              </th>
              {planIds.map((id) => {
                const head = PLAN_HEAD[id];
                return (
                  <th
                    key={id}
                    scope="col"
                    aria-current={id === selectedPlanId ? "true" : undefined}
                    className={`px-4 py-3 text-sm font-semibold text-[color:var(--brand-navy)] ${selectedCol(id)} ${
                      id === selectedPlanId ? "border-t-2 border-[color:var(--blue-600)]" : ""
                    }`}
                  >
                    {head ? (
                      <span className="block">
                        {head.main}
                        <span className="mt-0.5 block text-xs font-normal text-[color:var(--brand-navy)]/70">
                          {head.sub}
                        </span>
                      </span>
                    ) : (
                      planLabels[id]
                    )}
                    <span className="sr-only">{planLabels[id]}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {varyingRows.map((row) => (
              <tr key={row.id} className="border-t border-[color:var(--brand-navy)]/10 align-top">
                <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3">
                  <span className="block text-sm font-semibold text-[color:var(--brand-navy)]">
                    {shortLabel(row)}
                  </span>
                  <span className="sr-only">{row.description}</span>
                </th>
                {planIds.map((id) => (
                  <td key={id} className={`px-4 py-3 ${selectedCol(id)}`}>
                    <Cell v={row.plans[id] ?? { kind: "not-included" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-[color:var(--brand-navy)]/70">
        “{PENDING_SHORT}” means we set that number with you before you sign. We do not
        publish limits we have not committed to.
      </p>
    </div>
  );
}
