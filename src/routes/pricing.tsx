import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { marketingHead, faqScript, serviceScript } from "@/lib/marketing/head";
import { SiteShell, PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { AgencyComparator } from "@/components/marketing/agency-comparator";
import { ModelComparisonTable } from "@/components/marketing/model-comparison-table";
import { EntitlementMatrix } from "@/components/marketing/entitlement-matrix";
import { Receipt, type ReceiptDetail, type ReceiptLine } from "@/components/signature/receipt";
import { PackageSelector, type PackageStop } from "@/components/system/package-selector";
import { RunLinkButton } from "@/components/system/run-button";
import { NEVER_CHARGED, PRICING_GUARANTEES } from "@/content/pricing";
import { PRICING_FAQ as FAQ } from "@/content/pricing-faq";
import {
  ABOVE_MAX_ROLES_LABEL,
  ANNUAL_DISCOUNT_NOTE,
  MAX_POSITIONS,
  PACKAGES,
  PRICE_PILOT_DISPLAY,
  formatUsdExact,
  subscriptionTotalsUsd,
  type PackageId,
} from "@/config/pricing-core";
import { offer } from "@/config/offer";
import { OFFER_CATEGORY, OFFER_LAST_UPDATED_LABEL, PILOT_IS_PAID_NOTE, TIMING_FINE_PRINT } from "@/config/offer-facts";
import { CTA_ENTERPRISE, CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import {
  ENTITLEMENT_POLICY,
  PUBLIC_ONEOFF_ENTITLEMENTS,
  PUBLIC_PLAN_IDS,
  PUBLIC_PLAN_LABELS,
  PUBLIC_SUBSCRIPTION_ENTITLEMENTS,
  SCOPED_PUBLIC_LABEL,
  publicSeatsLine,
} from "@/config/pricing-entitlements";

export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(undefined, "/pricing", {
      title: `Recruiting Packages & ${PRICE_PILOT_DISPLAY} Pilot | TaaSFlow`,
      description: `Your invoice before you sign: TaaSFlow recruiting packages by number of roles, paid once or monthly, and the ${PRICE_PILOT_DISPLAY} one-role pilot. No placement fee.`,
    }, {
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Pricing", path: "/pricing" },
      ],
      scripts: [
        serviceScript({
          name: "TaaSFlow recruiting packages",
          description:
            `${OFFER_CATEGORY}, sold as packages by number of positions: one-off (paid once) or as a subscription billed monthly. A ${PRICE_PILOT_DISPLAY} pilot covers one role, once per company. No placement fees.`,
          path: "/pricing",
          serviceType: "Recruiting",
        }),
        faqScript(FAQ),
      ],
    }),
  component: PricingPage,
});

/* ------------------------------------------------------------------ data */

/** The seven stops, in the order they sell: the pilot, five packages, scoped. */
const STOPS: readonly PackageStop[] = [
  ...PACKAGES.map((p) => ({
    id: p.id,
    roles: p.capacity,
    label: p.capacityLabel,
    short: String(p.capacity),
  })),
  { id: "enterprise", roles: null, label: ABOVE_MAX_ROLES_LABEL, short: `${MAX_POSITIONS}+` },
];

const ENTERPRISE_ID = "enterprise";

/** Support level for a package, read from the published entitlement table. */
function supportFor(planId: string, rows: typeof PUBLIC_ONEOFF_ENTITLEMENTS): string {
  const v = rows.find((r) => r.id === "support")?.plans[planId];
  return v && v.kind === "value" ? v.label : SCOPED_PUBLIC_LABEL;
}

type Billing = "once" | "monthly";

/* ------------------------------------------------------------------ page */

function PricingPage() {
  const [stopId, setStopId] = useState<string>("growth");
  const [billing, setBilling] = useState<Billing>("once");

  const stop = STOPS.find((s) => s.id === stopId) ?? STOPS[1]!;
  const pkg = PACKAGES.find((p) => p.id === stop.id);
  const isPilot = stop.id === "pilot";
  const isEnterprise = stop.id === ENTERPRISE_ID;
  const rows = billing === "once" ? PUBLIC_ONEOFF_ENTITLEMENTS : PUBLIC_SUBSCRIPTION_ENTITLEMENTS;

  // The pilot is paid once whatever the billing mode; packages follow it.
  const monthlyTotals = pkg && !isPilot ? subscriptionTotalsUsd(pkg.capacity) : null;
  const paidMonthly = billing === "monthly" && monthlyTotals !== null;
  const total = pkg ? (paidMonthly ? monthlyTotals!.monthly : pkg.totalUsd) : 0;

  const lines: ReceiptLine[] = pkg
    ? [
        {
          label: isPilot ? "Pilot, one role" : `Package, ${pkg.capacityLabel.toLowerCase()}`,
          note: isPilot ? "Once per company" : paidMonthly ? "Charged each month" : "Paid once",
          amount: total,
        },
        ...NEVER_CHARGED.slice(0, 3).map((label) => ({ label, amount: 0 })),
      ]
    : [];
  const details: ReceiptDetail[] = pkg
    ? [
        { label: "Seats", value: publicSeatsLine(pkg.id) },
        { label: "Support", value: supportFor(pkg.id, rows) },
        { label: "Workspace access", value: `${offer.accessMonths} months` },
      ]
    : [];

  const maxTotal = Math.max(...PACKAGES.map((p) => p.totalUsd));

  return (
    <SiteShell>
      <PublicSection className="pb-0 pt-14 sm:pb-0 sm:pt-20 lg:pb-0">
        <PublicPage>
          <h1 className="display max-w-[14ch] text-[clamp(40px,5.5vw,60px)] text-[color:var(--ink)]">
            Your invoice, before you sign.
          </h1>
          <p className="mt-6 max-w-[640px] text-[21px] leading-[1.45] text-[color:var(--slate)]">
            Every package is the full platform with managed execution. Tell us how many roles you have
            open and read the whole bill.
          </p>
          <p className="mt-3 text-sm text-[color:var(--faint)]" data-testid="last-updated">
            {OFFER_LAST_UPDATED_LABEL}
          </p>
        </PublicPage>
      </PublicSection>

      {/* One control, one invoice */}
      <PublicSection className="pt-10 sm:pt-12 lg:pt-12">
        <PublicPage>
          <div className="flex flex-col gap-6 border-t border-[color:var(--ink)] pt-8 lg:flex-row lg:items-end lg:justify-between">
            <PackageSelector stops={STOPS} value={stopId} onChange={setStopId} />
            <div role="radiogroup" aria-label="Billing" className="flex gap-2">
              {(
                [
                  ["once", "Paid once"],
                  ["monthly", "Billed monthly"],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={billing === value}
                  onClick={() => setBilling(value)}
                  className={
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)] " +
                    (billing === value
                      ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-white"
                      : "border-[color:var(--rule-2)] bg-white text-[color:var(--ink)]")
                  }
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            {isEnterprise ? (
              <div className="tint rounded-[var(--r-3)] p-8">
                <p className="wide text-2xl font-semibold text-[color:var(--text)]">{ABOVE_MAX_ROLES_LABEL}</p>
                <p className="mt-3 max-w-[480px] text-[17px] text-[color:var(--text-2)]">
                  Above {MAX_POSITIONS} positions we scope the package with you rather than print a price we have
                  not committed to. Tell us the roles and the timing, and you will have a written quote within one
                  business day.
                </p>
                <RunLinkButton to={CTA_ENTERPRISE.to} className="mt-6">
                  {CTA_ENTERPRISE.label}
                </RunLinkButton>
              </div>
            ) : (
              <Receipt
                title={stop.label}
                subtitle={isPilot ? "One role, once per company" : paidMonthly ? "Charged each month" : "Paid once, for the whole package"}
                lines={lines}
                details={details}
                total={{ label: paidMonthly ? "A month" : "Total", amount: total }}
                tilt={-0.4}
                footer={
                  <p>
                    {paidMonthly ? `${ANNUAL_DISCOUNT_NOTE} ` : ""}
                    {isPilot ? PILOT_IS_PAID_NOTE : "No placement fee, however many of the ten you hire."}
                  </p>
                }
              />
            )}

            <div className="min-w-0">
              <p className="narrow text-[13px] font-medium text-[color:var(--faint)]">Every published package, one total each</p>
              <ol className="mt-4 flex flex-col gap-3" aria-label="Package totals">
                {PACKAGES.map((p) => {
                  const selected = p.id === stop.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setStopId(p.id)}
                        aria-pressed={selected}
                        className="group grid w-full grid-cols-[150px_minmax(0,1fr)_96px] items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)]"
                      >
                        <span className={"text-[15px] " + (selected ? "font-semibold text-[color:var(--ink)]" : "text-[color:var(--slate)]")}>
                          {p.capacityLabel}
                        </span>
                        <span className="h-3 w-full rounded-full bg-[color:var(--blue-100)]" aria-hidden>
                          <span
                            className={"block h-3 rounded-full " + (selected ? "bg-[color:var(--blue-600)]" : "bg-[color:var(--blue-200)] group-hover:bg-[color:var(--blue-300)]")}
                            style={{ width: `${Math.max(6, (p.totalUsd / maxTotal) * 100)}%` }}
                          />
                        </span>
                        <span className={"wide num text-right text-base " + (selected ? "font-semibold text-[color:var(--ink)]" : "text-[color:var(--slate)]")}>
                          {p.totalDisplay}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-sm text-[color:var(--faint)]">{TIMING_FINE_PRINT}</p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <RunLinkButton to={CTA_PRIMARY.to}>{CTA_PRIMARY.label}</RunLinkButton>
                {!isPilot ? (
                  <RunLinkButton to={isEnterprise ? CTA_ENTERPRISE.to : CTA_MESSAGE.to} variant="ghost">
                    Ask about {stop.label.toLowerCase()}
                  </RunLinkButton>
                ) : null}
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[color:var(--slate)]">
                {PRICING_GUARANTEES.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* The table follows the selector */}
      <PublicSection>
        <PublicPage>
          <h2 className="max-w-[20ch] text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px] sm:leading-[1.04]">
            What each package entitles you to.
          </h2>
          <p className="mt-4 max-w-[640px] text-[17px] text-[color:var(--slate)]">
            The platform is the same on every package. What differs is capacity, seats and support. Where a
            cell says “{SCOPED_PUBLIC_LABEL}”, we set it with you rather than print a limit we have not
            committed to.
          </p>
          <div className="mt-8">
            <EntitlementMatrix
              rows={rows}
              planIds={PUBLIC_PLAN_IDS}
              planLabels={PUBLIC_PLAN_LABELS}
              selectedPlanId={stop.id}
              caption={
                billing === "once"
                  ? "Entitlements by one-off package, from the pilot to more than 100 positions"
                  : "Entitlements by subscription package, from the pilot to more than 100 positions"
              }
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* Commercial terms: seven short answers */}
      <PublicSection>
        <PublicPage>
          <h2 className="max-w-[20ch] text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px] sm:leading-[1.04]">
            The terms, in seven answers.
          </h2>
          <p className="mt-4 max-w-[640px] text-[17px] text-[color:var(--slate)]">
            Your signed quote or agreement is always the authority on commercial terms.
          </p>
          <dl className="mt-8 grid gap-x-12 md:grid-cols-2">
            {ENTITLEMENT_POLICY.map((item) => (
              <div key={item.id} className="border-t border-[color:var(--rule)] py-5">
                <dt className="text-base font-semibold text-[color:var(--ink)]">{item.question}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-[color:var(--slate)]">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </PublicPage>
      </PublicSection>

      {/* The three-way comparison, moved from the homepage */}
      <PublicSection>
        <PublicPage>
          <ModelComparisonTable />
        </PublicPage>
      </PublicSection>

      {/* Your own numbers against an agency */}
      <PublicSection>
        <PublicPage>
          <AgencyComparator />
        </PublicPage>
      </PublicSection>

      {/* Questions */}
      <PublicSection>
        <PublicPage>
          <h2 className="max-w-[20ch] text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px] sm:leading-[1.04]">
            Before you sign.
          </h2>
          <p className="mt-4 text-[17px] text-[color:var(--slate)]">
            More answers are on the{" "}
            <Link to="/faq" className="font-medium text-[color:var(--blue-600)] underline underline-offset-4">
              FAQ page
            </Link>
            .
          </p>
          <div className="mt-8 divide-y divide-[color:var(--rule)] border-y border-[color:var(--rule)]">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-[color:var(--ink)]">
                  <span>{f.q}</span>
                  <span aria-hidden className="text-xl leading-none text-[color:var(--faint)] group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[color:var(--slate)]">{f.a}</p>
              </details>
            ))}
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
