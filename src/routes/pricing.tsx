import { createFileRoute, Link } from "@tanstack/react-router";
import { marketingHead } from "@/lib/marketing/head";
import { PublicPage, PublicSection, CtaSection } from "@/components/marketing/site-shell";
import {
  Check,
  X,
  Repeat,
  Users,
  Building2,
  ClipboardList,
  Search,
  ListChecks,
  Handshake,
  Sparkles,
} from "lucide-react";

// Pricing metadata is authored inline. The legacy JSON entry contains
// unapproved commercial terms ($399, $6,999, 14-day, 10% annual discount).
export const Route = createFileRoute("/pricing")({
  head: () =>
    marketingHead(undefined, "/pricing", {
      title: "Pricing — TaaSFlow subscription recruiting",
      description:
        "Transparent, flat-fee subscription recruiting. No placement fees, no salary-percentage commissions. Every engagement is scoped to your roles and volume.",
    }),
  component: PricingPage,
});

const INCLUDED = [
  "Guided intake and search plan",
  "Sourcing across multiple channels",
  "Role-specific, evidence-based scoring",
  "Ranked candidates delivered to your Client workspace",
  "Recruiter-written fit narratives with CV quotes",
  "Kanban pipeline with stage validation",
  "Direct messaging with the TaaSFlow team",
  "CV downloads and full candidate profiles",
  "Direct handover after shortlist — you own the candidates",
  "Audit trail on every decision",
];

const EXCLUDED = [
  "Placement fees",
  "Salary-percentage commissions",
  "Per-CV pass-through charges",
  "Hidden markups on interviews or offers",
];

function PricingPage() {
  return (
    <>
      {/* ── Pricing Hero ─────────────────────────────────────────── */}
      <PublicSection className="pb-10 pt-16 sm:pt-20">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Pricing
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            Flat-fee subscription recruiting. No placement fees.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            You pay for the work, not a share of the salary. Every engagement is scoped to
            your roles and volume, delivered in the Client workspace with ranked candidates
            and recruiter-written evidence — and a direct handover after shortlist.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Start Hiring
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Contact Sales
            </Link>
          </div>
          <ul className="mt-8 grid gap-3 text-sm text-[color:var(--brand-navy)]/75 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "No salary-percentage fees",
              "Ranked candidates every week",
              "Live workspace visibility",
              "You keep the candidates",
            ].map((x) => (
              <li key={x} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      {/* ── Service Model ────────────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            The service model
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            One recurring team. One workspace. Weekly ranked delivery.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/75">
            TaaSFlow works like a recruiting subscription. The same recruiters stay on your
            roles, deliver ranked candidates into the Client workspace on a regular cadence,
            and hand over control after shortlist so your team runs the interview process.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <ModelPillar
              icon={<Repeat className="h-5 w-5" aria-hidden />}
              title="Recurring, not per-hire"
              body="Predictable cost tied to the search, not to the offer. Budget it like any other subscription line."
            />
            <ModelPillar
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="Same team on your roles"
              body="A dedicated pod that learns your requirements, tightens the scoring, and keeps context across roles."
            />
            <ModelPillar
              icon={<Handshake className="h-5 w-5" aria-hidden />}
              title="Direct handover"
              body="After shortlist, you run interviews and offers. No middleman on your candidate conversations."
            />
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── Commercial Paths ─────────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Commercial paths
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            Scoped to your roles and volume.
          </h2>
          <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/75">
            Because every search has a different scope, seniority, and volume, we quote each
            engagement directly rather than publish a static price sheet.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <PathCard
              title="Single role"
              body="A focused engagement to fill one open position. Best for teams testing the model or hiring a single critical role."
              cta="Scope this role"
            />
            <PathCard
              highlight
              title="Multi-role"
              body="A handful of roles running in parallel. Shared intake, one workspace, one recruiter pod across every search."
              cta="Scope multiple roles"
            />
            <PathCard
              title="Ongoing / Enterprise"
              body="Continuous hiring across teams, geographies, or business units. Dedicated capacity, account structure, tailored billing and reporting."
              cta="Talk to enterprise"
              ctaTo="/enterprise"
            />
          </div>
          <p className="mt-6 text-xs text-[color:var(--brand-navy)]/55">
            Published price points are being reviewed for the current plan year. Contact
            Sales for an exact quote scoped to your roles.
          </p>
        </PublicPage>
      </PublicSection>

      {/* ── Included / Excluded ──────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                What is included
              </h2>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                Every engagement, at every tier.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-[color:var(--brand-navy)]/85">
                {INCLUDED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] p-6 text-white sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                What is not included
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Charges you will never see on a TaaSFlow invoice.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-white/90">
                {EXCLUDED.map((x) => (
                  <li key={x} className="flex gap-2">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-white/80" aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-white/60">
                Delivery windows, cancellation terms, and specific line-item pricing are
                confirmed on your scoped quote.
              </p>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── How Engagement Starts ────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            How the engagement starts
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            From intake to a live workspace.
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-4">
            <StartStep
              step="01"
              icon={<ClipboardList className="h-5 w-5" aria-hidden />}
              title="Submit the role"
              body="Complete the guided intake or book a short consultation. We confirm scope and the search plan."
            />
            <StartStep
              step="02"
              icon={<Search className="h-5 w-5" aria-hidden />}
              title="Sourcing begins"
              body="Your recruiter pod sources across channels using role-specific criteria you approved at intake."
            />
            <StartStep
              step="03"
              icon={<ListChecks className="h-5 w-5" aria-hidden />}
              title="Ranked delivery"
              body="Candidates arrive in the Client workspace, ranked with evidence per requirement — not a résumé dump."
            />
            <StartStep
              step="04"
              icon={<Handshake className="h-5 w-5" aria-hidden />}
              title="Direct handover"
              body="You take control after shortlist: interview, offer, and hire directly, with the workspace as the shared record."
            />
          </ol>
        </PublicPage>
      </PublicSection>

      {/* ── Pilot ───────────────────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] p-6 sm:p-10">
            <div className="flex flex-wrap items-start gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-navy)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--brand-navy)]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Pilot engagement
              </span>
            </div>
            <h2 className="mt-4 max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
              Try the model on a single role.
            </h2>
            <p className="mt-4 max-w-2xl text-[color:var(--brand-navy)]/75">
              A time-boxed engagement scoped to one active position. You experience the full
              workflow — intake, sourcing, ranked delivery, evidence, and direct handover —
              before committing to a broader subscription.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-[color:var(--brand-navy)]/80 sm:grid-cols-2">
              {[
                "One active position",
                "Ranked shortlist with fit evidence",
                "Same Client workspace as full engagements",
                "Direct handover after shortlist",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" aria-hidden />
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Ask about the pilot
              </Link>
              <Link
                to="/intake"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
              >
                Submit the role
              </Link>
            </div>
            <p className="mt-5 text-xs text-[color:var(--brand-navy)]/55">
              Pilot pricing and delivery windows are confirmed on your scoped quote.
            </p>
          </div>
        </PublicPage>
      </PublicSection>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <PublicSection className="py-10">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            Pricing FAQ
          </p>
          <h2 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
            The questions we get before a first engagement.
          </h2>
          <dl className="mt-8 grid gap-6 md:grid-cols-2">
            {FAQ.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <dt className="font-semibold text-[color:var(--brand-navy)]">{f.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </PublicPage>
      </PublicSection>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <CtaSection
        eyebrow="Get a scoped quote"
        title="Tell us about the role. We come back with an exact price."
        description="Complete the guided intake or book a short call — no obligation, no placement fees, no lock-in on the conversation."
        primary={{ to: "/intake", label: "Start Hiring" }}
        secondary={{ to: "/contact", label: "Contact Sales" }}
      />
    </>
  );
}

// ── Section building blocks ─────────────────────────────────────

function ModelPillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]">
        {icon}
      </div>
      <h3 className="mt-4 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{body}</p>
    </div>
  );
}

function PathCard({
  title,
  body,
  cta,
  ctaTo = "/intake",
  highlight,
}: {
  title: string;
  body: string;
  cta: string;
  ctaTo?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col rounded-2xl border p-6 sm:p-7 " +
        (highlight
          ? "border-[color:var(--brand-navy)] bg-white shadow-sm ring-1 ring-[color:var(--brand-navy)]/10"
          : "border-[color:var(--brand-navy)]/10 bg-white")
      }
    >
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-[color:var(--brand-navy)]/70" aria-hidden />
        <h3 className="font-[family-name:var(--brand-font-display)] text-xl font-semibold">
          {title}
        </h3>
        {highlight ? (
          <span className="ml-auto rounded-full bg-[color:var(--brand-navy)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Most common
          </span>
        ) : null}
      </div>
      <p className="mt-3 flex-1 text-sm text-[color:var(--brand-navy)]/75">{body}</p>
      <p className="mt-4 text-xs text-[color:var(--brand-navy)]/55">
        Price scoped on quote
      </p>
      <Link
        to={ctaTo}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}

function StartStep({
  step,
  icon,
  title,
  body,
}: {
  step: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="relative rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)]">
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/50">
          {step}
        </span>
      </div>
      <h3 className="mt-4 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
        {title}
      </h3>
      <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">{body}</p>
    </li>
  );
}

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does subscription recruiting differ from an agency?",
    a: "You pay for the work of finding and ranking candidates, not a percentage of the hire's salary. The same recruiter pod stays on your roles, delivers into the Client workspace, and hands over after shortlist — you run the interview and offer.",
  },
  {
    q: "Are there placement fees or salary-percentage commissions?",
    a: "No. TaaSFlow does not charge a placement fee or take a percentage of salary at any point. Every engagement is a flat, scoped fee.",
  },
  {
    q: "Why aren't specific prices published on the page?",
    a: "Every search has a different scope, seniority, and volume. We quote each engagement directly so the price matches the actual work — not an average that fits nobody.",
  },
  {
    q: "How is delivery scoped and paced?",
    a: "Cadence and delivery windows are defined in your scoped quote and confirmed at intake, so you know exactly when ranked candidates will land in the workspace.",
  },
  {
    q: "What happens after the engagement ends?",
    a: "You keep every candidate profile, ranking, and piece of evidence in the Client workspace. There is no lock-in on the people you have already reviewed.",
  },
  {
    q: "Can I run a small engagement before committing?",
    a: "Yes. The pilot engagement scopes a single role so your team can experience the full workflow — intake, sourcing, ranked delivery, evidence, and handover — before expanding.",
  },
];
