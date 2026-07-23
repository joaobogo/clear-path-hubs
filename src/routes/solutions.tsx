import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { PRICING_PACKAGES, isTierPricePublic, formatUsdCompact } from "@/config/public-pricing";
import {
  Users,
  Building2,
  Rocket,
  Globe2,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

const PILOT = PRICING_PACKAGES.find((p) => p.id === "pilot");
const PILOT_PRICE_LABEL =
  PILOT && isTierPricePublic(PILOT) && PILOT.priceUsd !== null
    ? ` for ${formatUsdCompact(PILOT.priceUsd)}`
    : "";

export const Route = createFileRoute("/solutions")({
  head: () =>
    marketingHead(undefined, "/solutions", {
      title: "Solutions — Subscription recruiting for every hiring need | TaaSFlow",
      description:
        "Pilot a single hire, scale volume hiring, run enterprise programs, or hire globally. One workspace, one flat monthly fee, ranked candidates in 14 days.",
    }),
  component: SolutionsPage,
});

const SOLUTIONS = [
  {
    icon: Rocket,
    title: "Pilot a single hire",
    body: "Test TaaSFlow on one role for $399. Ranked shortlist in 14 days. If it isn't the best hiring experience you've had, you don't renew.",
    cta: { to: "/pilot", label: "Start a pilot" },
  },
  {
    icon: Users,
    title: "Scale hiring teams",
    body: "Run 3–15 active roles at a flat monthly rate. Unlimited hires per subscription. Your workspace tracks every requisition in one place.",
    cta: { to: "/pricing", label: "See pricing" },
  },
  {
    icon: Building2,
    title: "Enterprise programs",
    body: "Multi-department search, structured intake, SSO, audit trail, dedicated pod. Keep your ATS — we integrate.",
    cta: { to: "/enterprise", label: "Enterprise details" },
  },
  {
    icon: Globe2,
    title: "Global talent, remote-ready",
    body: "50+ countries covered. Timezone-aware shortlisting, work-authorization screening, and remote-first evidence.",
    cta: { to: "/global-talent", label: "Global talent" },
  },
  {
    icon: ClipboardList,
    title: "Structured intake",
    body: "5-step consultation captures role, requirements, and hiring context. Every requirement scored 0–100 with evidence.",
    cta: { to: "/how-it-works", label: "How it works" },
  },
  {
    icon: ShieldCheck,
    title: "Compliance & privacy",
    body: "Consent tracking, retention policies, and full audit trail. GDPR-aligned. Your data stays yours.",
    cta: { to: "/privacy", label: "Privacy" },
  },
] as const;

function SolutionsPage() {
  return (
    <SiteShell>
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Solutions
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            One workspace. Every hiring model.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            From a single pilot hire to enterprise programs across 50+ countries —
            TaaSFlow adapts to the shape of your team.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <article
              key={s.title}
              className="flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
            >
              <s.icon className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.body}</p>
              <Link
                to={s.cta.to}
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                {s.cta.label} →
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">
            Not sure which fits?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Book a 20-minute consultation — we'll map your open roles to the right
            plan.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/contact"
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Book a consultation
            </Link>
            <Link
              to="/intake"
              className="rounded-md border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              Start a pilot
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
