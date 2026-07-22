import { Link } from "@tanstack/react-router";
import {
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";
import type { IndustryEntry } from "@/content/industries-v2";

/**
 * Reusable industry template. All industry pages render through this
 * component with structured data from `src/content/industries-v2.ts`.
 */
export function IndustryTemplate({ entry }: { entry: IndustryEntry }) {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Industries", to: "/industries" },
          { label: entry.name },
        ]}
      />

      <PublicSection className="pb-8 pt-10 sm:pt-14">
        <PublicPage>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
            {entry.eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
            {entry.hero.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            {entry.hero.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Start hiring
            </Link>
            <Link
              to="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
            >
              Talk to us
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2">
            {entry.signals.map((s) => (
              <li
                key={s}
                className="rounded-full bg-[color:var(--brand-navy)]/5 px-3 py-1 text-xs font-medium text-[color:var(--brand-navy)]/80"
              >
                {s}
              </li>
            ))}
          </ul>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            What we hear from {entry.name} teams
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {entry.challenges.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {c.title}
                </h3>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">{c.body}</p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
            <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
              Roles we source in {entry.name}
            </h2>
            <p className="mt-2 max-w-2xl text-[color:var(--brand-navy)]/70">
              We calibrate the rubric to the seniority and specialisation you actually need.
            </p>
            <ul className="mt-5 grid gap-2 text-sm text-[color:var(--brand-navy)]/85 sm:grid-cols-2 lg:grid-cols-3">
              {entry.roles.map((r) => (
                <li key={r} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                  />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>

      <PublicSection className="py-8">
        <PublicPage>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                01
              </p>
              <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                Submit the role
              </h3>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                A guided intake captures everything the search needs, in one flow.
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                02
              </p>
              <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                We source and score
              </h3>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                Multi-channel sourcing, role-specific rubric, evidence extracted from every CV.
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                03
              </p>
              <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                Review in your workspace
              </h3>
              <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                Ranked shortlist, evidence side-by-side, Kanban pipeline, direct messaging.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-[color:var(--brand-navy)]/60">
            See the full process on{" "}
            <Link to="/how-it-works" className="underline underline-offset-4">
              how it works
            </Link>
            .
          </p>
        </PublicPage>
      </PublicSection>

      <CtaSection
        eyebrow={entry.eyebrow}
        title={entry.cta.title}
        description={entry.cta.description}
        primary={{ to: "/intake", label: "Start intake" }}
        secondary={{ to: "/industries", label: "See other industries" }}
      />
    </>
  );
}
