import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { formatPrice, type PricingTier } from "@/content/pricing";

/**
 * Pricing tier card — one-off package model.
 * Every card lists the same things in the same order, states how it is billed
 * in plain words, and shows one action.
 */
export function PricingTierCard({ tier }: { tier: PricingTier }) {
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
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
        {tier.eyebrow}
      </p>
      <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight">
        {tier.name}
      </h3>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
          {formatPrice(tier)}
        </span>
      </div>
      {tier.pricePer ? (
        <p className="mt-1 text-sm font-medium text-[color:var(--brand-navy)]">{tier.pricePer}</p>
      ) : null}
      {isCustom ? null : (
        <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/80">One total for the package.</p>
      )}

      <p className="mt-5 text-sm text-[color:var(--brand-navy)]/80">{tier.bestFor}</p>

      <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
        {tier.included.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-7">
      <Link
        to={tier.ctaTo}
        className={
          "flex w-full min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] " +
          (tier.highlight
            ? "bg-[color:var(--brand-navy)] text-white hover:opacity-90"
            : "border border-[color:var(--brand-navy)]/20 text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5")
        }
      >
        {tier.ctaLabel}
      </Link>
      </div>
    </div>
  );
}
