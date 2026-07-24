import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { SubscriptionTier } from "@/content/pricing-subscriptions";

/**
 * Subscription tier card — mirrors taasflow.com/pricing subscription tab layout.
 */
export function SubscriptionTierCard({ tier }: { tier: SubscriptionTier }) {
  const isCustom = tier.monthly === null;

  return (
    <div
      className={
        "relative flex flex-col rounded-2xl border p-6 sm:p-7 transition-colors " +
        (tier.highlight
          ? "border-[color:var(--brand-navy)] bg-white shadow-md ring-1 ring-[color:var(--brand-navy)]/15"
          : "border-[color:var(--brand-navy)]/12 bg-white hover:border-[color:var(--brand-navy)]/25")
      }
    >
      {tier.highlight ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--brand-navy)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          Most Popular
        </span>
      ) : null}

      <div>
        <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
          {tier.name}
        </h3>
        <p className="mt-1 text-sm text-[color:var(--brand-navy)]/65">
          {tier.eyebrow}
        </p>
      </div>

      <div className="mt-5">
        <span className="font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
          {tier.priceDisplay}
        </span>
        <p className="mt-1 text-xs text-[color:var(--brand-navy)]/60">
          {isCustom ? tier.priceSuffix : tier.priceSuffix}
        </p>
        <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/55">
          {tier.billingNote}
        </p>
      </div>

      <ul className="mt-6 space-y-2.5 text-sm text-[color:var(--brand-navy)]/85">
        {tier.included.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

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
