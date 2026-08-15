import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { marketingHead } from "@/lib/marketing/head";
import { CheckCircle2, XCircle, Sparkles, ShieldCheck, LineChart, Users } from "lucide-react";
import {
  PRICE_PILOT_DISPLAY,
  PRICE_MULTI_DISPLAY,
  PRICE_SPRINT_DISPLAY,
  PRICE_ENTERPRISE_DISPLAY,
  PILOT_ROLES_LABEL,
  MULTI_ROLES_LABEL,
  SPRINT_ROLES_LABEL,
  ENTERPRISE_ROLES_LABEL,
} from "@/config/pricing-core";

/**
 * /pitch — approved public overview page.
 * Mirrors the Gamma presentation structure. Supports:
 *   ?share=1   → focus mode (hides nav/footer)
 *   ?print=1   → print-optimized (removes CTA + link hub, plain background)
 * Copy is production-approved; no draft language.
 */

// No `.default()` here: defaulting an absent search param makes the router
// rewrite /pitch to /pitch?share=false&print=false with a 307, which wastes
// crawl budget on a canonical content path.
const search = z.object({
  share: z.coerce.boolean().optional(),
  print: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/pitch")({
  validateSearch: search,
  head: () =>
    marketingHead(undefined, "/pitch", {
      title: "TaaSFlow — AI Hiring Intelligence you can audit",
      description:
        "Why placement-fee hiring fails, how the TaaSFlow platform replaces it, and what an AI Hiring Intelligence subscription costs.",
    }),
  component: PitchPage,
});

/* ─── Data ─────────────────────────────────────────────────────────────── */

const PLACEMENT_FAILS = [
  {
    title: "You pay for the last mile",
    body: "Placement fees compound with salary — a €120k hire runs €24–36k on top. You pay again for the next role, and the one after that.",
  },
  {
    title: "You get a resume, not a rubric",
    body: "Agencies deliver a shortlist. You get names, not the reasoning. No CV citations, no scoring, no way to compare candidates on the same axis.",
  },
  {
    title: "The pipeline isn't yours",
    body: "Every candidate the agency sourced belongs to the agency. Passing on today's #3 means you rebuild that pipeline from zero next quarter.",
  },
  {
    title: "Silence is the delivery mode",
    body: "Candidates hear nothing. Hiring managers hear nothing. The recruiter is a black box until an offer is on the table.",
  },
];

const ENGINE_STEPS = [
  {
    n: "01",
    title: "Intake in 12 minutes",
    body: "Guided brief captures role, must-haves, evidence rubric, and hiring context. No follow-up calls needed.",
  },
  {
    n: "02",
    title: "Sourced and scored, live",
    body: "Sourcing agents identify, the Scoring Engine scores every applicant against the rubric. Each score cites the CV quote it came from.",
  },
  {
    n: "03",
    title: "Ranked shortlist in days",
    body: "Top candidates delivered with evidence, interview guide, and fit narrative. Silver medalists stay in your workspace, not ours.",
  },
  {
    n: "04",
    title: "Hire, or rediscover",
    body: "Every candidate you saw stays searchable in the talent pool. Next role starts with 40+ warm profiles you already evaluated.",
  },
];

const CONTROL = [
  { label: "Same workspace, same evidence", body: "The screen your team sees is the screen the platform runs on." },
  { label: "Score the score", body: "Override any candidate rating. The system logs your reasoning next to ours." },
  { label: "Move the pipeline", body: "Drag candidates through stages. Reject with reason. Trigger interview outreach." },
  { label: "Share on your terms", body: "Send a stakeholder link with a 30-day expiry. Revoke anytime." },
];

const DASHBOARDS = [
  { label: "Client Overview", body: "One screen showing every active search, bottlenecks, and this-week decisions." },
  { label: "Executive Portfolio", body: "Regions, business units, time-in-stage, delivery velocity — for hiring leadership." },
  { label: "Weekly Operating Review", body: "Roles opened, delivered, interviewed, and next-week commitments — auto-generated." },
  { label: "Source Attribution", body: "Which channel converts. Application → shortlist → hire, by source, per role." },
];

const ECONOMICS: Array<{
  tier: string;
  price: string;
  unit: string;
  fits: string;
  line: string;
  highlight?: boolean;
}> = [
  {
    tier: "Pilot — Single Position",
    price: PRICE_PILOT_DISPLAY,
    unit: " one-time",
    fits: PILOT_ROLES_LABEL,
    line: "Test the model on one critical hire. 5-day turnaround.",
  },
  {
    tier: "Multi Position",
    price: PRICE_MULTI_DISPLAY,
    unit: " one-time",
    fits: MULTI_ROLES_LABEL,
    line: "Parallel searches with shared intake context. $420–$1,050 per role, depending on how many you run.",
    highlight: true,
  },
  {
    tier: "Hiring Sprint",
    price: PRICE_SPRINT_DISPLAY,
    unit: " one-time",
    fits: SPRINT_ROLES_LABEL,
    line: "Concurrent hiring across functions with priority support.",
  },
  {
    tier: "Custom Billing",
    price: PRICE_ENTERPRISE_DISPLAY,
    unit: "",
    fits: ENTERPRISE_ROLES_LABEL,
    line: "Continuous hiring across business units and geographies.",
  },
];

/* ─── Page ─────────────────────────────────────────────────────────────── */

function PitchPage() {
  const { share, print } = Route.useSearch();
  const focus = share === true || print === true;

  const body = (
    <div className={print ? "bg-white" : undefined}>
      {/* Section 1 — hero */}
      <PublicSection className="pt-16">
        <PublicPage className="max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
            Overview · 2026
          </p>
          <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            The recruiting engine you can see through.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            A subscription recruiting function delivered as product. Human
            recruiters, evidence-first scoring, and a workspace your team owns.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              Start hiring
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              See the model
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Section 2 — why placement fails */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              The problem
            </p>
            <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Placement hiring is priced like a cost of doing business — and it acts like one.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {PLACEMENT_FAILS.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <XCircle className="mt-1 h-5 w-5 flex-shrink-0 text-[color:var(--brand-navy)]/80" aria-hidden />
                <div>
                  <h3 className="font-semibold text-[color:var(--brand-navy)]">{f.title}</h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Section 3 — live hiring engine */}
      <PublicSection>
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              The engine
            </p>
            <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              A live hiring engine, not a batch delivery.
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/80">
              Every stage is visible. Every score cites its evidence. The engine
              runs continuously — you don't wait weeks to see progress.
            </p>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {ENGINE_STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <span className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-ocean-text)]/70">
                  {s.n}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-[color:var(--brand-navy)]">{s.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>

      {/* Section 4 — client control */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                Client control
              </p>
              <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                You run the pipeline. We do the work.
              </h2>
              <p className="mt-4 text-[color:var(--brand-navy)]/80">
                The workspace is the product. Not a monthly slide deck, not a
                spreadsheet dropped in your inbox — a live surface where the
                shortlist, the reasoning, and the next decision all live in one place.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-[color:var(--brand-navy)]/80">
                <ShieldCheck className="h-4 w-4 text-[color:var(--brand-ocean-text)]" aria-hidden />
                Your pipeline stays yours — even when a role closes.
              </div>
            </div>
            <ul className="space-y-3">
              {CONTROL.map((c) => (
                <li key={c.label} className="flex gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--brand-ocean-text)]" aria-hidden />
                  <div>
                    <p className="font-semibold text-[color:var(--brand-navy)]">{c.label}</p>
                    <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">{c.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      {/* Section 5 — ranked shortlist visual */}
      <PublicSection>
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              The shortlist
            </p>
            <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Every candidate arrives with the reasoning attached.
            </h2>
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            <div className="border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Head of Growth — top 3 delivered
            </div>
            {[
              { rank: 1, name: "Candidate A · Strong Fit", score: 92, evidence: "Scaled paid + lifecycle at two B2B SaaS Series B firms." },
              { rank: 2, name: "Candidate B · Strong Fit", score: 88, evidence: "Ran EMEA GTM, closed hire-to-signal in <30d twice." },
              { rank: 3, name: "Candidate C · Good Fit", score: 81, evidence: "Head of growth at bootstrapped $10M ARR company." },
            ].map((c) => (
              <div key={c.rank} className="flex items-center gap-6 border-b border-[color:var(--brand-navy)]/5 px-6 py-5 last:border-b-0">
                <span className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]/80">
                  #{c.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[color:var(--brand-navy)]">{c.name}</p>
                  <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">"{c.evidence}"</p>
                </div>
                <div className="text-right">
                  <p className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-ocean-text)]">
                    {c.score}
                  </p>
                  <p className="text-xs text-[color:var(--brand-navy)]/80">fit score</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[color:var(--brand-navy)]/80">
            Illustrative example. Real shortlists include CV citations, interview guides, and stage history.
          </p>
        </PublicPage>
      </PublicSection>

      {/* Section 6 — dashboard visibility */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Dashboards
            </p>
            <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Visibility at every altitude.
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/80">
              From the daily standup to the board meeting — the same evidence
              scaled to the right level of detail.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {DASHBOARDS.map((d, i) => (
              <div key={d.label} className="flex gap-4 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                {i === 0 ? <Users className="mt-1 h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden /> : null}
                {i === 1 ? <LineChart className="mt-1 h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden /> : null}
                {i === 2 ? <Sparkles className="mt-1 h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden /> : null}
                {i === 3 ? <ShieldCheck className="mt-1 h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden /> : null}
                <div>
                  <h3 className="font-semibold text-[color:var(--brand-navy)]">{d.label}</h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{d.body}</p>
                </div>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* Section 7 — subscription economics */}
      <PublicSection>
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              Economics
            </p>
            <h2 className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Priced like software. Delivered by people.
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/80">
            A flat one-time fee per package — no salary percentages, no placement
            fees, ever. Move to a custom continuous plan when volume warrants it.
          </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {ECONOMICS.map((t) => (
              <div
                key={t.tier}
                className={`rounded-2xl border p-6 ${
                  t.highlight
                    ? "border-[color:var(--brand-ocean)] bg-white ring-2 ring-[color:var(--brand-ocean)]/20"
                    : "border-[color:var(--brand-navy)]/10 bg-white"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                  {t.tier}
                </p>
                <p className="mt-3 font-[family-name:var(--brand-font-display)] text-3xl font-semibold text-[color:var(--brand-navy)]">
                  {t.price}
                  <span className="text-base font-normal text-[color:var(--brand-navy)]/80">{t.unit}</span>
                </p>
                <p className="mt-3 text-sm font-medium text-[color:var(--brand-navy)]">{t.fits}</p>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{t.line}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-[color:var(--brand-navy)]/80">
            Compare to placement: a single €120k hire at a 20% fee equals more than five Hiring Sprints.
          </p>
        </PublicPage>
      </PublicSection>

      {!focus ? (
        <CtaSection
          eyebrow="Start with TaaSFlow"
          title="See the workspace on your own role."
          description="Submit a role in the guided intake — your workspace is ready as soon as you finish."
          primary={{ to: "/intake", label: "Start hiring" }}
          secondary={{ to: "/how-it-works", label: "See how it works" }}
        />
      ) : null}
    </div>
  );

  if (focus) {
    return (
      <div className="min-h-dvh bg-[color:var(--brand-paper)] text-[color:var(--brand-navy)]">
        <main id="main" tabIndex={-1} className="focus:outline-none">
          {body}
        </main>
        {print ? (
          <style>{`
            @media print {
              @page { size: A4; margin: 12mm }
              body { background: #fff }
              section { break-inside: avoid; page-break-inside: avoid }
              a { text-decoration: none; color: inherit }
            }
          `}</style>
        ) : null}
      </div>
    );
  }

  return <SiteShell hideLinkHub>{body}</SiteShell>;
}
