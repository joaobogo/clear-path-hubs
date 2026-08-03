import { canonicalUrl } from "@/lib/canonical-origin";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  SiteShell,
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";

const CANONICAL = canonicalUrl("/talent-marketplace");
const TITLE = "Talent Marketplace — where briefs meet vetted specialists | TaaSFlow";
const DESC =
  "The TaaSFlow Talent Marketplace connects live employer briefs with vetted, evidence-scored candidates. Curated, private and role-specific — not a job board.";

export const Route = createFileRoute("/talent-marketplace")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: TalentMarketplacePage,
});

const HOW = [
  {
    step: "01",
    title: "Employer publishes a brief",
    body:
      "Structured intake captures role, seniority, requirements, working model and eligibility before the search opens.",
  },
  {
    step: "02",
    title: "Candidates opt in",
    body:
      "Members apply to briefs that fit, or are surfaced privately when their profile matches. Consent is always explicit.",
  },
  {
    step: "03",
    title: "Evidence-based ranking",
    body:
      "Each application is scored requirement-by-requirement, with cited evidence from the CV.",
  },
  {
    step: "04",
    title: "Client review in workspace",
    body:
      "The employer receives a ranked shortlist with side-by-side evidence, not a raw CV pile.",
  },
];

const FOR_CANDIDATES = [
  "Only briefs matching your captured direction, seniority and region.",
  "Structured status in your dashboard: submitted, review, shortlist, interview, decision.",
  "Downloadable score evidence on briefs you consent to.",
  "Never public, never sold — introductions are per-brief and per-client.",
];

const FOR_EMPLOYERS = [
  "Ranked shortlists in your workspace within days, not weeks.",
  "Evidence side-by-side with each requirement — no keyword guesses.",
  "Kanban pipeline, direct messaging and structured decision capture.",
  "One canonical intake per role — no re-briefing between rounds.",
];

const NOT = [
  { label: "Public job board with mass listings" },
  { label: "Freelance bidding or hourly auctions" },
  { label: "Anonymous CV database sold to recruiters" },
  { label: "Volume outreach or spam" },
];

function TalentMarketplacePage() {
  return (
    <SiteShell>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Talent Marketplace" }]} />

      <PublicSection className="pb-8 pt-10 sm:pt-14">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            The marketplace
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            A curated marketplace, not a job board.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            TaaSFlow connects real employer briefs to vetted, evidence-scored candidates. Ranked
            shortlists arrive in a shared workspace — private to the client, transparent to the
            candidate.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/jobs"
              className="inline-flex items-center rounded-lg bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Browse open briefs
            </Link>
            <Link
              to="/intake"
              className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]"
            >
              Post a brief
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)] underline underline-offset-4"
            >
              Candidate sign in
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
            How the marketplace works
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {HOW.map((h) => (
              <div key={h.step} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                  {h.step}
                </p>
                <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {h.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{h.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
                For candidates
              </h2>
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                {FOR_CANDIDATES.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/jobs"
                  className="inline-flex items-center rounded-lg bg-[color:var(--brand-navy)] px-4 py-2 text-sm font-medium text-white"
                >
                  Browse briefs
                </Link>
                <Link
                  to="/talent-network"
                  className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-4 py-2 text-sm font-medium text-[color:var(--brand-navy)]"
                >
                  About the network
                </Link>
              </div>
            </div>
            <div>
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
                For employers
              </h2>
              <ul className="mt-5 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
                {FOR_EMPLOYERS.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]" />
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/intake"
                  className="inline-flex items-center rounded-lg bg-[color:var(--brand-navy)] px-4 py-2 text-sm font-medium text-white"
                >
                  Post a brief
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-4 py-2 text-sm font-medium text-[color:var(--brand-navy)]"
                >
                  How it works
                </Link>
              </div>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-10">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold sm:text-3xl">
              What the marketplace is not
            </h2>
            <ul className="mt-5 grid gap-2 text-sm text-[color:var(--brand-navy)]/80 sm:grid-cols-2">
              {NOT.map((n) => (
                <li key={n.label} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]/40" />
                  {n.label}
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow="The marketplace"
        title="Meet the shortlist, not the pile."
        description="Candidates: apply to a brief that fits. Employers: publish a brief and get a ranked shortlist with evidence."
        primary={{ to: "/jobs", label: "Browse briefs" }}
        secondary={{ to: "/intake", label: "Post a brief" }}
      />
    </SiteShell>
  );
}
