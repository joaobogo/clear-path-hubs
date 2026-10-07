import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { CTA_BOOK, CTA_PRIMARY } from "@/config/cta";
import {
  ATS_NOTE,
  COMPLIANCE_NOTE,
  FIRST_SHORTLIST_TIMING_SHORT,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";
import { INTAKE_STEPS, INTAKE_TOTAL_MINUTES } from "@/lib/express-intake-schema";
import { PRICING_PACKAGES, isTierPricePublic, formatUsd } from "@/config/public-pricing";
import {
  Users,
  Building2,
  Rocket,
  Globe2,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { PageConnections } from "@/components/marketing/page-connections";

const PILOT = PRICING_PACKAGES.find((p) => p.id === "pilot");
const PILOT_PRICE_LABEL =
  PILOT && isTierPricePublic(PILOT) && PILOT.priceUsd !== null
    ? ` for ${formatUsd(PILOT.priceUsd)}`
    : "";

export const Route = createFileRoute("/solutions")({
  head: () =>
    marketingHead(undefined, "/solutions", {
      title: "Solutions for every hiring need | TaaSFlow",
      description:
        "Pilot a single hire, scale volume hiring, run enterprise hiring or hire globally. Fixed package prices and ranked, evidence-backed shortlists.",
    }),
  component: SolutionsPage,
});

const SOLUTIONS = [
  {
    icon: Rocket,
    title: "Pilot a single hire",
    body: `Test TaaSFlow on one role${PILOT_PRICE_LABEL}. A paid evaluation, not a free trial. ${FIRST_SHORTLIST_TIMING_SHORT}.`,
    cta: { to: CTA_PRIMARY.to, label: CTA_PRIMARY.label },
  },
  {
    icon: Users,
    title: "Scale hiring teams",
    body: "Pick the package that covers your open positions and pay one fixed total. Your workspace tracks every requisition in one place.",
    cta: { to: "/pricing", label: "See pricing" },
  },
  {
    icon: Building2,
    title: "Enterprise programs",
    body: `Multi-department search, structured intake, access controls, an audit trail and agent capacity aligned to your role families. ${ATS_NOTE}`,
    cta: { to: "/enterprise", label: "Enterprise details" },
  },
  {
    icon: Globe2,
    title: "Global talent, remote-ready",
    body: "Time-zone-aware shortlisting, work-authorisation screening and remote-first evidence, scoped to your role.",
    cta: { to: "/global-talent", label: "Global talent" },
  },
  {
    icon: ClipboardList,
    title: "Structured intake",
    body: `A ${INTAKE_STEPS.length}-step intake, about ${INTAKE_TOTAL_MINUTES} minutes, captures role, requirements and hiring context. Every requirement is scored with evidence.`,
    cta: { to: "/how-it-works", label: "How it works" },
  },
  {
    icon: ShieldCheck,
    title: "Compliance & privacy",
    body: `Consent tracking, retention policies and an audit trail. Your candidate records are yours to export. ${COMPLIANCE_NOTE}`,
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
            From a single pilot hire to enterprise programs, TaaSFlow adapts to the
            shape of your team. {WHO_RUNS_THE_SEARCH}
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
            Book a 20-minute call and we will map your open roles to the right
            package.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to={CTA_BOOK.to}
              className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {CTA_BOOK.label}
            </Link>
            <Link
              to={CTA_PRIMARY.to}
              className="rounded-md border border-input px-5 py-3 text-sm font-semibold hover:bg-accent"
            >
              {CTA_PRIMARY.label}
            </Link>
          </div>
        </div>
      </section>
          <PageConnections
        commercial={{ to: CTA_PRIMARY.to, label: CTA_PRIMARY.label, desc: "Share one role and see the process." }}
        explainer={{ to: "/how-it-works", label: "How it works", desc: "Four steps, evidence-first ranking." }}
        resource={{ to: "/case-studies", label: "Example engagements", desc: "Example engagements and how we measure them." }}
        audience={{ to: "/industries", label: "By industry", desc: "Role blueprints for your vertical." }}
      />
    </SiteShell>
  );
}
