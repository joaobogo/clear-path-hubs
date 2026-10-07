import { Link } from "@tanstack/react-router";

export type LargerPackageRow = {
  id: string;
  name: string;
  total: string;
  billing: string;
  seats: string;
  ctaLabel: string;
  ctaTo: string;
};

/**
 * Packages that are not shown as cards. A real table from tablet width up and a
 * stacked list on phones, so nothing needs sideways scrolling.
 */
export function LargerPackagesTable({
  rows,
  caption,
}: {
  rows: LargerPackageRow[];
  caption: string;
}) {
  return (
    <div>
      <div className="hidden overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-[color:var(--brand-navy)]/[0.04] text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/80">
              <th scope="col" className="px-5 py-3">Package</th>
              <th scope="col" className="px-5 py-3">Total</th>
              <th scope="col" className="px-5 py-3">Billing</th>
              <th scope="col" className="px-5 py-3">Seats</th>
              <th scope="col" className="px-5 py-3">
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--brand-navy)]/10 align-top">
                <th scope="row" className="px-5 py-4 font-semibold text-[color:var(--brand-navy)]">
                  {r.name}
                </th>
                <td className="px-5 py-4 tabular-nums font-semibold text-[color:var(--brand-navy)]">{r.total}</td>
                <td className="px-5 py-4 text-[color:var(--brand-navy)]/85">{r.billing}</td>
                <td className="px-5 py-4 text-[color:var(--brand-navy)]/85">{r.seats}</td>
                <td className="px-5 py-4">
                  <Link
                    to={r.ctaTo}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--brand-navy)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                  >
                    {r.ctaLabel}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-4"
          >
            <p className="text-base font-semibold text-[color:var(--brand-navy)]">{r.name}</p>
            <p className="mt-1 tabular-nums text-lg font-semibold text-[color:var(--brand-navy)]">{r.total}</p>
            <p className="mt-1 text-sm text-[color:var(--brand-navy)]/85">{r.billing}</p>
            <p className="mt-1 text-sm text-[color:var(--brand-navy)]/85">Seats: {r.seats}</p>
            <Link
              to={r.ctaTo}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--brand-navy)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              {r.ctaLabel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
