import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
} from "@/components/marketing/site-shell";
import { noindexMarketingHead } from "@/lib/marketing/noindex-head";
import { CTA_PRIMARY, CTA_HOW_IT_WORKS, CTA_MESSAGE } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING_SHORT, TIMING_FINE_PRINT, WHO_RUNS_THE_SEARCH } from "@/config/offer-facts";
import { INTAKE_TOTAL_MINUTES } from "@/lib/express-intake-schema";
import { CheckCircle2, XCircle, Sparkles, ShieldCheck, LineChart, Users } from "lucide-react";
import {
  PRICE_PILOT_DISPLAY,
  PACKAGE_10,
  PACKAGE_20,
  PACKAGE_30,
  PACKAGE_40,
  PACKAGE_100,
  ABOVE_MAX_DISPLAY,
  PILOT_ROLES_LABEL,
  ABOVE_MAX_ROLES_LABEL,
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
    noindexMarketingHead(undefined, "/pitch", {
      title: "TaaSFlow overview | Recruiting with managed execution",
      description:
        "Why placement-fee hiring frustrates buyers, how TaaSFlow works instead, and what a one-time package costs.",
    }),
  component: PitchPage,
});

/* ─── Data ─────────────────────────────────────────────────────────────── */

const PLACEMENT_FAILS = [
  {
    title: "You pay for the last mile",
    body: "Placement fees scale with the salary of the hire. You pay again for the next role, and the one after that.",
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
    title: `Intake in about ${INTAKE_TOTAL_MINUTES} minutes`,
    body: "A guided brief captures the role, must-haves and hiring context. We confirm the scope with you before sourcing starts.",
  },
  {
    n: "02",
    title: "Sourced and scored",
    body: "Agents source and score candidates against your criteria. Each score cites the CV passage it came from.",
  },
  {
    n: "03",
    title: "Ranked shortlist",
    body: `Top candidates arrive with the evidence behind each score. A recruiter reviews the shortlist before you see it. ${FIRST_SHORTLIST_TIMING_SHORT}.`,
  },
  {
    n: "04",
    title: "Hire, or revisit",
    body: "Candidates you have already reviewed stay in your workspace, so the next role does not start from zero.",
  },
];

const CONTROL = [
  { label: "Same workspace, same evidence", body: "The screen your team sees is the screen the platform runs on." },
  { label: "Score the score", body: "Override any candidate rating. The system logs your reasoning next to ours." },
  { label: "Move the pipeline", body: "Drag candidates through stages. Reject with reason. Trigger interview outreach." },
  { label: "Share on your terms", body: "Send a stakeholder link that expires. Revoke it anytime." },
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
    unit: " flat, one position",
    fits: PILOT_ROLES_LABEL,
    line: `Test the model on one critical hire. ${FIRST_SHORTLIST_TIMING_SHORT}.`,
  },
  {
    tier: PACKAGE_10.capacityLabel,
    price: PACKAGE_10.totalDisplay,
    unit: "",
    fits: PACKAGE_10.capacityLabel,
    line: "Parallel searches with shared intake context.",
    highlight: true,
  },
  {
    tier: PACKAGE_20.capacityLabel,
    price: PACKAGE_20.totalDisplay,
    unit: "",
    fits: PACKAGE_20.capacityLabel,
    line: "Concurrent hiring across functions with priority support.",
  },
  {
    tier: PACKAGE_30.capacityLabel,
    price: PACKAGE_30.totalDisplay,
    unit: "",
    fits: PACKAGE_30.capacityLabel,
    line: "Portfolio hiring across teams in one package.",
  },
  // Same omission as /enterprise and /trust: the ladder grew and this page did
  // not (audit 17 Sep, item 4). Lines are the approved `bestFor` copy.
  {
    tier: PACKAGE_40.capacityLabel,
    price: PACKAGE_40.totalDisplay,
    unit: "",
    fits: PACKAGE_40.capacityLabel,
    line: "Portfolio hiring across business units.",
  },
  {
    tier: PACKAGE_100.capacityLabel,
    price: PACKAGE_100.totalDisplay,
    unit: "",
    fits: PACKAGE_100.capacityLabel,
    line: "A continuous hiring programme run as one package.",
  },

  {
    tier: ABOVE_MAX_ROLES_LABEL,
    price: ABOVE_MAX_DISPLAY,
    unit: "",
    fits: ABOVE_MAX_ROLES_LABEL,
    line: "Above the maximum we scope it with you.",
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
            Overview
          </p>
          <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Recruiting you can see through.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            A recruiting platform with managed execution. {WHO_RUNS_THE_SEARCH}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={CTA_PRIMARY.to}
              className="inline-flex min-h-11 items-center rounded-md bg-[color:var(--brand-navy)] px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              {CTA_PRIMARY.label}
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex min-h-11 items-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              {CTA_HOW_IT_WORKS.label}
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
              Every step is visible.
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/80">
              Every score cites its evidence, and you can see progress in your workspace.
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
              Fixed prices. Delivered with people in the loop.
            </h2>
            <p className="mt-4 text-[color:var(--brand-navy)]/80">
            A flat one-time fee per package, with no salary percentages and no placement fees. Above 100 positions we scope it with you.
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
            {TIMING_FINE_PRINT}
          </p>
        </PublicPage>
      </PublicSection>

      {!focus ? (
        <CtaSection
          eyebrow="Next step"
          title="See the process on your own role."
          description="Request the pilot for one role, or send us a message to talk it through first."
          primary={CTA_PRIMARY}
          secondary={CTA_MESSAGE}
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
