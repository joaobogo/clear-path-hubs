import { Check, Minus, HelpCircle } from "lucide-react";
import {
  PENDING_PUBLIC_LABEL,
  type EntitlementRow,
  type EntitlementValue,
} from "@/config/pricing-entitlements";

function ValueCell({ v }: { v: EntitlementValue }) {
  if (v.kind === "included") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--brand-navy)]">
        <Check className="h-4 w-4 shrink-0" aria-hidden />
        Included
      </span>
    );
  }
  if (v.kind === "not-included") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--brand-navy)]/70">
        <Minus className="h-4 w-4 shrink-0" aria-hidden />
        Not included
      </span>
    );
  }
  if (v.kind === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--brand-navy)]/70">
        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
        {PENDING_PUBLIC_LABEL}
      </span>
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

/**
 * Entitlement comparison — platform entitlements per plan.
 * Desktop: comparison table. Mobile: one stacked card per plan (no
 * horizontal scrolling required).
 */
export function EntitlementMatrix({
  rows,
  planIds,
  planLabels,
  caption,
}: {
  rows: EntitlementRow[];
  planIds: readonly string[];
  planLabels: Record<string, string>;
  caption: string;
}) {
  return (
    <div>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[color:var(--brand-navy)]/[0.04]">
              <th
                scope="col"
                className="w-[26%] px-5 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/80"
              >
                Entitlement
              </th>
              {planIds.map((id) => (
                <th
                  key={id}
                  scope="col"
                  className="px-5 py-4 text-sm font-semibold text-[color:var(--brand-navy)]"
                >
                  {planLabels[id]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[color:var(--brand-navy)]/10 align-top"
              >
                <th scope="row" className="px-5 py-4 font-normal">
                  <span className="block text-sm font-semibold text-[color:var(--brand-navy)]">
                    {row.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[color:var(--brand-navy)]/70">
                    {row.description}
                  </span>
                </th>
                {planIds.map((id) => (
                  <td key={id} className="px-5 py-4">
                    <ValueCell v={row.plans[id] ?? { kind: "not-included" }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: per-plan stacked cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {planIds.map((id) => (
          <div
            key={id}
            className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
          >
            <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
              {planLabels[id]}
            </h3>
            <dl className="mt-4 divide-y divide-[color:var(--brand-navy)]/10">
              {rows.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-sm text-[color:var(--brand-navy)]/80">{row.label}</dt>
                  <dd className="text-right">
                    <ValueCell v={row.plans[id] ?? { kind: "not-included" }} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[color:var(--brand-navy)]/70">
        “{PENDING_PUBLIC_LABEL}” means the entitlement is set on your quote rather than
        published as a fixed number — we would rather confirm it than print a limit we
        have not committed to.
      </p>
    </div>
  );
}
