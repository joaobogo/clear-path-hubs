import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatPrice, type PricingTier } from "@/content/pricing";

/**
 * Pricing tier card — one-off package model.
 * Progressive disclosure: shows price, roles, turnaround, and top 3 items;
 * "See all capabilities" expands the rest.
 */
export function PricingTierCard({ tier }: { tier: PricingTier }) {
  const [open, setOpen] = useState(false);
  const topItems = tier.included.slice(0, 3);
  const restItems = tier.included.slice(3);
  const isCustom = tier.oneTime === null;

  return (
    <div
      className={
        "flex flex-col rounded-2xl border p-6 sm:p-7 transition-colors " +
        (tier.highlight
          ? "border-[color:var(--brand-navy)] bg-white shadow-md ring-1 ring-[color:var(--brand-navy)]/15"
          : "border-[color:var(--brand-navy)]/12 bg-white hover:border-[color:var(--brand-navy)]/25")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            {tier.eyebrow}
          </p>
          <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
            {tier.name}
          </h3>
        </div>
        {tier.highlight ? (
          <span className="rounded-full bg-[color:var(--brand-navy)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Most Popular
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
          {formatPrice(tier)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[color:var(--brand-navy)]/80">
        {isCustom ? "Scoped to your programme" : "one-time flat fee"}
      </p>
      {tier.pricePer ? (
        <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/80">{tier.pricePer}</p>
      ) : null}

      <p className="mt-5 text-sm text-[color:var(--brand-navy)]/80">{tier.bestFor}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[color:var(--brand-navy)]/[0.04] px-4 py-3 text-xs">
        <div>
          <dt className="text-[color:var(--brand-navy)]/80">Active roles</dt>
          <dd className="mt-0.5 font-semibold text-[color:var(--brand-navy)]">
            {tier.rolesIncluded}
          </dd>
        </div>
        <div>
          <dt className="text-[color:var(--brand-navy)]/80">Turnaround</dt>
          <dd className="mt-0.5 font-semibold text-[color:var(--brand-navy)]">
            {tier.turnaround}
          </dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
        {topItems.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {restItems.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]"
          >
            <ChevronDown
              className={"h-3.5 w-3.5 transition-transform " + (open ? "rotate-180" : "")}
              aria-hidden
            />
            {open ? "Hide details" : `See all ${tier.included.length} capabilities`}
          </button>
          {open ? (
            <ul className="mt-3 space-y-2 border-t border-[color:var(--brand-navy)]/10 pt-3 text-sm text-[color:var(--brand-navy)]/85">
              {restItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Link
        to={tier.ctaTo}
        className={
          "mt-7 inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity " +
          (tier.highlight
            ? "bg-[color:var(--brand-navy)] text-white hover:opacity-90"
            : "border border-[color:var(--brand-navy)]/20 text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5")
        }
      >
        {tier.ctaLabel}
      </Link>
    </div>
  );
}
