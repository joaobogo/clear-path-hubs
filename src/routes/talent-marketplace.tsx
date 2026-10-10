import { CTA_PRIMARY } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING_SHORT } from "@/config/offer-facts";
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
const TITLE = "Curated job board for employers and candidates | TaaSFlow";
const DESC =
  "The TaaSFlow job board is curated and role-specific: live employer roles, with every application scored against what the role asks for."; // job board: one name site-wide

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
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
  }),
  component: TalentMarketplacePage,
});

const HOW = [
  {
    step: "01",
    title: "Employer shares a role",
    body:
      "The intake captures role, seniority, requirements, working model and eligibility before the search opens.",
  },
  {
    step: "02",
    title: "Candidates apply",
    body:
      "Candidates apply to roles that fit, and consent is always explicit.",
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
  "Roles that match your direction, seniority and region.",
  "Structured status in your dashboard: submitted, review, shortlist, interview, decision.",
  "The evidence behind your score on roles you apply to.",
  "Never sold. Introductions are per role and per client.",
];

const FOR_EMPLOYERS = [
  `Ranked shortlists in your workspace. ${FIRST_SHORTLIST_TIMING_SHORT}.`,
  "Evidence side-by-side with each requirement — no keyword guesses.",
  "Kanban pipeline, direct messaging and structured decision capture.",
  "One intake per role, with no re-briefing between rounds.",
];

const NOT = [
  { label: "A mass-listing aggregator" },
  { label: "Freelance bidding or hourly auctions" },
  { label: "Anonymous CV database sold to recruiters" },
];

function TalentMarketplacePage() {
  return (
    <SiteShell>
      <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Job board" }]} />

      <PublicSection className="pb-8 pt-10 sm:pt-14">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            The job board
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            A curated job board, scored on evidence.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            TaaSFlow connects real employer roles to candidates who are scored against what each
            role asks for. Ranked shortlists arrive in a shared workspace, private to the client
            and transparent to the candidate.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/jobs"
              className="inline-flex items-center rounded-lg bg-[color:var(--blue-600)] px-5 py-2.5 text-sm font-medium text-white"
            >
              Browse open roles
            </Link>
            <Link
              to={CTA_PRIMARY.to}
              className="inline-flex items-center rounded-lg border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-medium text-[color:var(--brand-navy)]"
            >
              {CTA_PRIMARY.label}
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
            How the job board works
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
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--blue-600)]" />
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/jobs"
                  className="inline-flex items-center rounded-lg bg-[color:var(--blue-600)] px-4 py-2 text-sm font-medium text-white"
                >
                  Browse open roles
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
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--blue-600)]" />
                    {c}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to={CTA_PRIMARY.to}
                  className="inline-flex items-center rounded-lg bg-[color:var(--blue-600)] px-4 py-2 text-sm font-medium text-white"
                >
                  {CTA_PRIMARY.label}
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
              What the job board is not
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
        eyebrow="The job board"
        title="Meet the shortlist, not the pile."
        description="Candidates: apply to a role that fits. Employers: share a role and get a ranked shortlist with evidence."
        primary={{ to: "/jobs", label: "Browse open roles" }}
        secondary={CTA_PRIMARY}
      />
    </SiteShell>
  );
}
