import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageSquare, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalculatorResult } from "@/lib/roi-calculator";
import { trackEvent } from "@/lib/analytics";

/**
 * Calculator → CTA bridge (Prompt 13)
 *
 * Adapts the follow-up call-to-action based on the current calculator state
 * without duplicating any pricing math (single source = src/lib/roi-calculator.ts).
 *
 * Three modes:
 *   1. STANDARD package with a positive savings scenario
 *   2. CUSTOM QUOTE (Subscription / not publicly priced)
 *   3. NEGATIVE SAVINGS (assumptions do not favor us — say so honestly)
 */

export interface CalculatorCtaBridgeProps {
  result: CalculatorResult | null;
  className?: string;
}

type Mode = "standard" | "custom" | "negative";

function classify(result: CalculatorResult | null): Mode {
  if (!result) return "standard";
  if (result.isCustomPricing) return "custom";
  if (result.hasNegativeSavings) return "negative";
  return "standard";
}

export function CalculatorCtaBridge({ result, className }: CalculatorCtaBridgeProps) {
  const mode = classify(result);

  const config: {
    tone: "positive" | "neutral" | "honest";
    icon: React.ComponentType<{ className?: string }>;
    eyebrow: string;
    headline: string;
    body: string;
    primary: { to: string; label: string };
    secondary: { to: string; label: string };
    aside?: string;
  } =
    mode === "custom"
      ? {
          tone: "neutral",
          icon: MessageSquare,
          eyebrow: "Custom quote territory",
          headline: "This volume is scoped, not listed.",
          body:
            "Continuous hiring across teams or geographies moves onto a Subscription arrangement. We won't publish a savings number until the scope is confirmed — one 30-minute call gives you an exact price.",
          primary: { to: "/contact", label: "Book Enterprise Consultation" },
          secondary: { to: "/intake", label: "Start Hiring" },
          aside: "You keep the ATS, the recruiter, and the final call.",
        }
      : mode === "negative"
        ? {
            tone: "honest",
            icon: AlertTriangle,
            eyebrow: "Straight talk",
            headline: "At these assumptions, we don't obviously save you money.",
            body:
              "The math is honest — if your agency fee is low, the role count is small, or you don't spend recruiter hours on sourcing, the flat subscription may not beat your current setup on cost alone. What it still gives you: visible reasoning, a reusable pipeline, and one workspace instead of five threads.",
            primary: { to: "/contact", label: "Talk through your scenario" },
            secondary: { to: "/how-it-works", label: "See How It Works" },
            aside:
              "No hard sell — if TaaSFlow isn't the right fit for your volume, we'll say so on the call.",
          }
        : {
            tone: "positive",
            icon: ArrowRight,
            eyebrow: "Next step",
            headline: "The math checks out. Open your first role.",
            body:
              "Submit the intake, get a rubric confirmation within one business day, and see your first ranked shortlist inside the workspace by the end of the first week.",
            primary: { to: "/intake", label: "Start Hiring" },
            secondary: { to: "/pricing", label: "View Pricing" },
            aside: "Month-to-month. Cancel anytime. No placement fees.",
          };

  const Icon = config.icon;

  return (
    <section
      aria-labelledby="calc-bridge-heading"
      className={cn(
        "rounded-3xl border p-6 sm:p-8",
        config.tone === "positive" &&
          "border-[color:var(--brand-ocean)]/25 bg-gradient-to-br from-[color:var(--brand-ocean)]/[0.06] to-white",
        config.tone === "neutral" &&
          "border-[color:var(--brand-navy)]/12 bg-white",
        config.tone === "honest" &&
          "border-amber-500/30 bg-amber-50/60",
        className,
      )}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p
            className={cn(
              "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]",
              config.tone === "positive" && "text-[color:var(--brand-ocean)]",
              config.tone === "neutral" && "text-[color:var(--brand-navy)]/70",
              config.tone === "honest" && "text-amber-800",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {config.eyebrow}
          </p>
          <h3
            id="calc-bridge-heading"
            className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl"
          >
            {config.headline}
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--brand-navy)]/75">
            {config.body}
          </p>
          {config.aside ? (
            <p className="mt-3 inline-flex items-start gap-2 text-xs text-[color:var(--brand-navy)]/60">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {config.aside}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col md:items-stretch">
          <Link
            to={config.primary.to}
            onClick={() =>
              trackEvent("calculator.bridge_cta_clicked", {
                cta: "primary",
                mode,
                to: config.primary.to,
              })
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            {config.primary.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to={config.secondary.to}
            onClick={() =>
              trackEvent("calculator.bridge_cta_clicked", {
                cta: "secondary",
                mode,
                to: config.secondary.to,
              })
            }
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            {config.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
