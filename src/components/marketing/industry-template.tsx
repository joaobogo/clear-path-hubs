import { Link } from "@tanstack/react-router";
import {
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";
import type { IndustryEntry } from "@/content/industries-v2";

/**
 * Reusable industry detail template. All industry pages render through this
 * component with structured data from `src/content/industries-v2.ts`.
 *
 * Every section renders only when its data is present on the entry; a
 * partially populated industry silently hides sections it lacks.
 */
export function IndustryTemplate({ entry }: { entry: IndustryEntry }) {
  const jsonLd = entry.faqs
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: entry.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Industries", to: "/industries" },
          { label: entry.name },
        ]}
      />

      {/* 1. Industry-specific hero */}
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

      {/* 2. Industry hiring challenges */}
      <PublicSection className="py-8">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            {entry.name} hiring challenges
          </h2>
          <p className="mt-2 max-w-2xl text-[color:var(--brand-navy)]/70">
            What we hear from {entry.name} teams before they switch to a
            structured, evidence-based workflow.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {entry.challenges.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {c.title}
                </h3>
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>

      {/* 3. How TaaSFlow supports the industry */}
      {entry.solutions && entry.solutions.length > 0 ? (
        <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-12">
          <PublicPage>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              How TaaSFlow supports {entry.name}
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {entry.solutions.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
                >
                  <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </PublicPage>
        </PublicSection>
      ) : null}

      {/* 4. Common role families */}
      {entry.roleFamilies && entry.roleFamilies.length > 0 ? (
        <PublicSection className="py-12">
          <PublicPage>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              Common role families in {entry.name}
            </h2>
            <p className="mt-2 max-w-2xl text-[color:var(--brand-navy)]/70">
              Grouped by specialisation. Each family has its own scoring rubric.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {entry.roleFamilies.map((fam) => (
                <div
                  key={fam.name}
                  className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
                >
                  <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                    {fam.name}
                  </h3>
                  {fam.blurb ? (
                    <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                      {fam.blurb}
                    </p>
                  ) : null}
                  <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--brand-navy)]/85">
                    {fam.roles.map((r) => (
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
              ))}
            </div>
          </PublicPage>
        </PublicSection>
      ) : (
        // Fallback: flat roles list
        <PublicSection className="py-8">
          <PublicPage>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
              <h2 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold">
                Roles we source in {entry.name}
              </h2>
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
      )}

      {/* 5. Candidate signals evaluated */}
      {entry.candidateSignals && entry.candidateSignals.length > 0 ? (
        <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-12">
          <PublicPage>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              Candidate signals we evaluate
            </h2>
            <p className="mt-2 max-w-2xl text-[color:var(--brand-navy)]/70">
              Every point of the score maps to a specific evidence quote from
              the CV — no keyword matching.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {entry.candidateSignals.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
                >
                  <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </PublicPage>
        </PublicSection>
      ) : null}

      {/* 6. Skills, tools, certifications */}
      {entry.skills || entry.tools || entry.certifications || entry.regulatedRequirements ? (
        <PublicSection className="py-12">
          <PublicPage>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              Skills, tools and certifications
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {entry.skills && entry.skills.length > 0 ? (
                <SkillBlock title="Skills" items={entry.skills} />
              ) : null}
              {entry.tools && entry.tools.length > 0 ? (
                <SkillBlock title="Tools & platforms" items={entry.tools} />
              ) : null}
              {entry.certifications && entry.certifications.length > 0 ? (
                <SkillBlock title="Certifications" items={entry.certifications} />
              ) : null}
              {entry.regulatedRequirements && entry.regulatedRequirements.length > 0 ? (
                <SkillBlock title="Regulated requirements" items={entry.regulatedRequirements} />
              ) : null}
            </div>
          </PublicPage>
        </PublicSection>
      ) : null}

      {/* 7. Candidate-delivery product visual */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] py-12">
        <PublicPage>
          <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                In your workspace
              </p>
              <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
                What a {entry.name} shortlist looks like
              </h2>
              <p className="mt-3 max-w-xl text-[color:var(--brand-navy)]/70">
                Ranked candidates with a fit score, requirement coverage,
                evidence quotes, strengths, and validation areas — reviewed
                before it reaches you.
              </p>
            </div>
            <DeliveryVisual industryName={entry.name} />
          </div>
        </PublicPage>
      </PublicSection>

      {/* 8. TaaSFlow process for the industry */}
      <PublicSection className="py-12">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            The {entry.name} hiring process
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Submit the role",
                body: `A guided intake captures everything the ${entry.name} search needs, in one flow.`,
              },
              {
                n: "02",
                title: "We source and score",
                body: "Multi-channel sourcing, role-specific rubric, evidence extracted from every CV.",
              },
              {
                n: "03",
                title: "Review in your workspace",
                body: "Ranked shortlist, evidence side-by-side, Kanban pipeline, direct messaging.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                  {s.n}
                </p>
                <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                  {s.body}
                </p>
              </div>
            ))}
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

      {/* 9. Related industries */}
      {entry.relatedIndustries && entry.relatedIndustries.length > 0 ? (
        <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-12">
          <PublicPage>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              Related industries
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {entry.relatedIndustries.map((r) => (
                <Link
                  key={r.slug}
                  to="/industries/$slug"
                  params={{ slug: r.slug }}
                  className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-colors hover:border-[color:var(--brand-ocean)]/50"
                >
                  <h3 className="text-lg font-semibold text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean)]">
                    {r.name}
                  </h3>
                  {r.blurb ? (
                    <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                      {r.blurb}
                    </p>
                  ) : null}
                  <span className="mt-4 inline-flex text-sm font-semibold text-[color:var(--brand-ocean)]">
                    Explore →
                  </span>
                </Link>
              ))}
            </div>
          </PublicPage>
        </PublicSection>
      ) : null}

      {/* 10. Related resources */}
      {entry.resources && entry.resources.length > 0 ? (
        <PublicSection className="py-12">
          <PublicPage>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              Related resources
            </h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {entry.resources.map((r) => (
                <Link
                  key={r.to}
                  to={r.to}
                  className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-colors hover:border-[color:var(--brand-ocean)]/50"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                    {r.kind}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean)]">
                    {r.title}
                  </h3>
                  {r.description ? (
                    <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
                      {r.description}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </PublicPage>
        </PublicSection>
      ) : null}

      {/* 11. Industry FAQ */}
      {entry.faqs && entry.faqs.length > 0 ? (
        <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-12">
          <PublicPage>
            <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              {entry.name} hiring FAQ
            </h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {entry.faqs.map((f) => (
                <div
                  key={f.q}
                  className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
                >
                  <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                    {f.q}
                  </h3>
                  <p className="mt-2 text-sm text-[color:var(--brand-navy)]/75">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
            {jsonLd ? (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
              />
            ) : null}
          </PublicPage>
        </PublicSection>
      ) : null}

      {/* 12. Final CTA */}
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

function SkillBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/60">
        {title}
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((it) => (
          <li
            key={it}
            className="rounded-full bg-[color:var(--brand-navy)]/5 px-3 py-1 text-xs font-medium text-[color:var(--brand-navy)]/85"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeliveryVisual({ industryName }: { industryName: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/55">
            {industryName} shortlist
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">
            Candidate #A-1042 · Alex R.
          </p>
        </div>
        <div className="rounded-full bg-[color:var(--brand-ocean)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--brand-ocean)]">
          Fit 94
        </div>
      </div>
      <div className="mt-4 space-y-2 text-xs text-[color:var(--brand-navy)]/80">
        <RequirementBar label="Stack fit" pct={96} />
        <RequirementBar label="Scope & scale" pct={91} />
        <RequirementBar label="Delivery evidence" pct={88} />
        <RequirementBar label="Communication" pct={82} />
      </div>
      <div className="mt-4 rounded-lg bg-[color:var(--brand-mist)]/60 p-3 text-xs text-[color:var(--brand-navy)]/80">
        <p className="font-semibold text-[color:var(--brand-navy)]">
          Recommended: shortlist
        </p>
        <p className="mt-1">
          Evidence quoted from the CV supports each score. Strengths and
          validation areas listed in the workspace.
        </p>
      </div>
    </div>
  );
}

function RequirementBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-semibold text-[color:var(--brand-navy)]">
          {pct}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-[color:var(--brand-navy)]/10">
        <div
          className="h-full rounded-full bg-[color:var(--brand-ocean)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
