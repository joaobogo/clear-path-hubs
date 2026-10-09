import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, FileSearch, LayoutDashboard, UserCheck } from "lucide-react";

import { RunHero } from "@/components/home/run-hero";
import { AgencyComparator } from "@/components/marketing/agency-comparator";
import { PublicPage, PublicSection, SiteShell } from "@/components/marketing/site-shell";
import { CTA_MESSAGE, CTA_HOW_IT_WORKS, CTA_PRICING, CTA_PRIMARY } from "@/config/cta";
import {
  OFFER_LAST_UPDATED_LABEL,
  PILOT_IS_PAID_NOTE,
  PROCESS_STEPS,
  SHORTLIST_LABEL,
  WHO_RUNS_THE_SEARCH,
} from "@/config/offer-facts";
import { MAX_POSITIONS, PRICE_PILOT_USD } from "@/config/pricing-core";
import { HOMEPAGE_FAQ } from "@/lib/homepage-faq";
import { faqScript, marketingHead } from "@/lib/marketing/head";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";
import { roleFromSearch } from "@/lib/marketing/role-input";

// Homepage metadata is authored inline. The content bundle is deliberately NOT
// imported here: importing it pulls every blog/industry markdown file into the
// homepage chunk (~890 KiB) and delays hydration.

const HOME_TITLE = "Recruiting Subscription & Candidate Sourcing | TaaSFlow";
const HOME_DESCRIPTION = `Find and evaluate candidates with TaaSFlow recruiting support and a shared workspace. Explore a $${PRICE_PILOT_USD}, one-role pilot for your team.`;

export const Route = createFileRoute("/")({
  /** The role typed into the hero. Every chapter below speaks about it. */
  validateSearch: (search: Record<string, unknown>): { role?: string } => {
    const role = roleFromSearch(search["role"]);
    return role ? { role } : {};
  },
  head: () =>
    marketingHead(
      undefined,
      "/",
      { title: HOME_TITLE, description: HOME_DESCRIPTION },
      {
        // The one FAQ on this page. The JSON-LD reads the same list the page
        // renders, so answer engines quote the visible text.
        scripts: [faqScript([...HOMEPAGE_FAQ])],
      },
    ),
  component: Home,
});

/* ------------------------------------------------------------------ content */

const WHAT_YOU_RECEIVE = [
  {
    icon: BarChart3,
    title: SHORTLIST_LABEL,
    body: "Ordered by how well each candidate meets the requirements you approved.",
  },
  {
    icon: FileSearch,
    title: "The evidence behind each score",
    body: "Each requirement points to the line in the CV or application that supports it, so you can check the reasoning.",
  },
  {
    icon: LayoutDashboard,
    title: "A shared workspace",
    body: "Your team reviews candidates, compares them and moves them forward in one place.",
  },
  {
    icon: UserCheck,
    title: "Human review",
    body: "A recruiter reviews every shortlist before it reaches you. Your team runs the interviews and decides who to hire.",
  },
] as const;

const WHO_IT_FITS = [
  {
    name: "Hospitality",
    slug: "hospitality",
    line: "Roles at hotels, restaurants, resorts and event venues.",
  },
  {
    name: "Healthcare",
    slug: "healthcare",
    line: "Clinical, administrative and leadership roles where credentials matter.",
  },
  {
    name: "High-volume and frontline hiring",
    slug: "retail",
    line: "Roles you fill in numbers, such as retail and store teams.",
  },
] as const;

/* ------------------------------------------------------------------ helpers */

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={
        "text-xs font-semibold uppercase tracking-[0.16em] " +
        (light ? "text-white/70" : "text-[color:var(--brand-ocean-text)]")
      }
    >
      {children}
    </p>
  );
}

function H2({ id, children, light = false }: { id?: string; children: React.ReactNode; light?: boolean }) {
  return (
    <h2
      id={id}
      className={
        "mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl " +
        (light ? "text-white" : "text-[color:var(--brand-navy)]")
      }
    >
      {children}
    </h2>
  );
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]";

const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--blue-600)] px-6 py-3 text-base font-semibold text-white shadow-[var(--brand-shadow-sm)] hover:bg-[color:var(--blue-700)] " +
  focusRing;

/* ------------------------------------------------------------------ page */

function Home() {
  const { role } = Route.useSearch();
  const navigate = useNavigate();
  // Running a role from the hero keeps the visitor here: the address gains
  // the role, the field redraws and every chapter speaks about it.
  const runRole = (next: string) =>
    void navigate({ to: "/", search: next ? { role: next } : {}, replace: true, resetScroll: false });
  return (
    <SiteShell hideLinkHub role={role}>
      {/* The cold open: headline, role input, top 10, the run bar. */}
      <RunHero role={role} onRun={runRole} />

      {/* 3 — WHAT YOU RECEIVE */}
      <PublicSection>
        <PublicPage>
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <div className="min-w-0">
              <Eyebrow>What you receive</Eyebrow>
              <H2>A shortlist you can check, not a stack of CVs.</H2>
              <p className="mt-4 text-[color:var(--brand-navy)]/80">{WHO_RUNS_THE_SEARCH}</p>
            </div>
            <ul className="grid min-w-0 gap-4 sm:grid-cols-2">
              {WHAT_YOU_RECEIVE.map((item) => (
                <li
                  key={item.title}
                  className="min-w-0 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 shadow-[var(--brand-shadow-sm)]"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean-text)]">
                    <item.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-[color:var(--brand-navy)]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 4 — FOUR STEPS */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <div className="max-w-2xl">
              <Eyebrow>How it works</Eyebrow>
              <H2>Four steps from role brief to shortlist.</H2>
            </div>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STEPS.map((step, i) => (
                <li key={step.title} className="min-w-0 border-t-2 border-[color:var(--brand-navy)] pt-4">
                  <span className="text-xs font-semibold tabular-nums text-[color:var(--brand-ocean-text)]">
                    Step {i + 1}
                  </span>
                  <h3 className="mt-1 text-base font-semibold text-[color:var(--brand-navy)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-8">
              <Link
                to={CTA_HOW_IT_WORKS.to}
                className={
                  "inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)] underline-offset-4 hover:text-[color:var(--brand-navy)] hover:underline " +
                  focusRing
                }
              >
                {CTA_HOW_IT_WORKS.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </p>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 5 — COST COMPARISON (one) */}
      <PublicSection id="cost">
        <PublicPage>
          <div className="mb-8 max-w-2xl">
            <Eyebrow>What it costs</Eyebrow>
            <H2>Compare the cost with agency fees.</H2>
            <p className="mt-3 text-[color:var(--brand-navy)]/80">
              Enter your own salary, agency fee and hiring volume. Every starting value is an
              editable example, not an industry average.
            </p>
          </div>
          <AgencyComparator />
        </PublicPage>
      </PublicSection>

      {/* 6 — WHO IT FITS */}
      <section className="border-y border-[color:var(--brand-navy)]/8 bg-white">
        <PublicSection>
          <PublicPage>
            <div className="max-w-2xl">
              <Eyebrow>Who it fits</Eyebrow>
              <H2>Teams that hire in these areas.</H2>
            </div>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {WHO_IT_FITS.map((t) => (
                <li key={t.slug} className="min-w-0">
                  <Link
                    to="/industries/$slug"
                    params={{ slug: toPublicSlug(t.slug) }}
                    className={
                      "group flex h-full flex-col rounded-2xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-paper)] p-6 transition-colors hover:border-[color:var(--brand-navy)]/30 " +
                      focusRing
                    }
                  >
                    <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">{t.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                      {t.line}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)] group-hover:text-[color:var(--brand-navy)]">
                      See industry page <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 7 — PILOT AND PRICING */}
      <PublicSection id="pilot">
        <PublicPage>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0 rounded-3xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-10">
              <Eyebrow>The pilot</Eyebrow>
              <H2>One role for ${PRICE_PILOT_USD}, one time.</H2>
              <p className="mt-3 text-[color:var(--brand-navy)]/80">
                The pilot runs one role from brief to shortlist. You receive{" "}
                {SHORTLIST_LABEL.charAt(0).toLowerCase() + SHORTLIST_LABEL.slice(1)}, the evidence
                behind each score, and access to the shared workspace. {PILOT_IS_PAID_NOTE}
              </p>
              <Link to={CTA_PRIMARY.to} className={primaryButton + " mt-6"}>
                {CTA_PRIMARY.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="min-w-0 rounded-3xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-6 sm:p-10">
              <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
                More than one role
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                Packages cover up to {MAX_POSITIONS} positions. There is no placement fee.
              </p>
              <Link
                to={CTA_PRICING.to}
                className={
                  "mt-5 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)] underline-offset-4 hover:text-[color:var(--brand-navy)] hover:underline " +
                  focusRing
                }
              >
                {CTA_PRICING.label} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 8 — FAQ (the only one) */}
      <section
        aria-labelledby="home-faq-heading"
        className="border-y border-[color:var(--brand-navy)]/8 bg-white"
      >
        <PublicSection>
          <PublicPage>
            <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14">
              <div className="min-w-0">
                <Eyebrow>Questions</Eyebrow>
                <H2 id="home-faq-heading">Before you start.</H2>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">
                  More answers are on the{" "}
                  <Link
                    to="/faq"
                    className={
                      "font-semibold text-[color:var(--brand-ocean-text)] underline underline-offset-4 hover:text-[color:var(--brand-navy)] " +
                      focusRing
                    }
                  >
                    FAQ page
                  </Link>
                  .
                </p>
                <p className="mt-3 text-xs text-[color:var(--brand-navy)]/70" data-testid="last-updated">
                  {OFFER_LAST_UPDATED_LABEL}
                </p>
              </div>
              <div className="min-w-0 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10">
                {HOMEPAGE_FAQ.map((item, i) => (
                  <details key={item.q} open={i === 0} className="group p-5">
                    <summary
                      className={
                        "flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-[color:var(--brand-navy)] [&::-webkit-details-marker]:hidden " +
                        focusRing
                      }
                    >
                      <span className="min-w-0">{item.q}</span>
                      <span
                        aria-hidden
                        className="shrink-0 text-xl leading-none text-[color:var(--brand-navy)]/60 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </PublicPage>
        </PublicSection>
      </section>

      {/* 9 — FINAL CTA */}
      <PublicSection>
        <PublicPage>
          <div className="rounded-2xl bg-[color:var(--blue-600)] px-6 py-12 text-center text-white sm:px-12 sm:py-14">
            <H2 light>Start with one role.</H2>
            <p className="mx-auto mt-3 max-w-xl text-base text-white/80">
              Request the ${PRICE_PILOT_USD} pilot or send us a message, and we
              will reply.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={CTA_PRIMARY.to}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {CTA_PRIMARY.label}
              </Link>
              <Link
                to={CTA_MESSAGE.to}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {CTA_MESSAGE.label}
              </Link>
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    </SiteShell>
  );
}
