import { Link } from "@tanstack/react-router";
import {
  PublicPage,
  PublicSection,
  CtaSection,
  Breadcrumbs,
} from "@/components/marketing/site-shell";
import type { IndustryEntry } from "@/content/industries-v2";
import { getIndustryHeroImage } from "@/content/industry-hero-images";
import { IndustryRoleExplorer } from "@/components/marketing/industry-role-explorer";
import { IndustrySignalExplorer } from "@/components/marketing/industry-signal-explorer";
import { IndustryHeroBackdrop } from "@/components/marketing/industry-hero-backdrop";
import { IndustryInsights } from "@/components/marketing/industry-insights";
import { getIndustryVisualIdentity } from "@/content/industry-visual-identity";
import { SubtleCta } from "@/components/marketing/subtle-cta";
import { getIndustryRelationships } from "@/lib/marketing/industry-relationships";


/**
 * Reusable industry detail template. All industry pages render through this
 * component with structured data from `src/content/industries-v2.ts`.
 *
 * Every section renders only when its data is present on the entry; a
 * partially populated industry silently hides sections it lacks.
 */
export function IndustryTemplate({ entry }: { entry: IndustryEntry }) {
  const heroImage = getIndustryHeroImage(entry.slug);
  const identity = getIndustryVisualIdentity(entry.slug);
  const relationships = getIndustryRelationships(entry);
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

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
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
                <a
                  href="#role-explorer"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
                >
                  Explore roles
                </a>
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
            </div>
            {heroImage ? (
              <figure
                data-industry-motif={entry.slug}
                className="relative overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 shadow-sm motion-safe:animate-[taas-reveal-up_520ms_var(--taas-ease-emphasized)_both]"
              >
                <img
                  src={heroImage.src}
                  alt={heroImage.alt}
                  width={heroImage.width}
                  height={heroImage.height}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  style={{ objectPosition: heroImage.focal ?? "50% 40%" }}
                  className="relative z-0 aspect-[4/3] h-auto w-full object-cover sm:aspect-[16/10] lg:aspect-[16/9]"
                />
              </figure>
            ) : (
              <IndustryHeroBackdrop
                gradient={identity.gradient}
                accent={identity.accent}
                pattern={identity.pattern}
                label={entry.name}
                eyebrow={entry.eyebrow}
              />
            )}
          </div>
        </PublicPage>
      </PublicSection>

      {/* 1b. Keyword-anchored intro links — SEO internal-link density */}
      <PublicSection className="py-4">
        <PublicPage>
          <p className="max-w-3xl text-sm leading-relaxed text-[color:var(--brand-navy)]/70">
            Hiring in <span className="font-semibold text-[color:var(--brand-navy)]">{entry.name}</span>?
            See how{" "}
            <Link to="/" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
              TaaSFlow
            </Link>{" "}
            delivers ranked candidates weekly for{" "}
            <Link to="/solutions" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
              Series A–C operators
            </Link>{" "}
            and{" "}
            <Link to="/enterprise" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
              50–5,000-employee businesses
            </Link>
            . Explore{" "}
            <Link to="/how-it-works" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
              how it works
            </Link>
            , see{" "}
            <Link to="/pricing" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
              pricing
            </Link>
            , or{" "}
            <Link to="/case-studies" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
              read the case studies
            </Link>
            .
          </p>
          <SubtleCta variant="hire" headline={`Hiring for ${entry.name}? Get ranked ${entry.name} candidates every week.`} className="mt-6" />
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

      {/* 4. Interactive role explorer */}
      <PublicSection className="py-12">
        <span id="role-explorer" className="sr-only" aria-hidden />

        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
              Role explorer
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              Explore {entry.name} roles TaaSFlow sources
            </h2>
            <p className="mt-2 text-[color:var(--brand-navy)]/70">
              Select a family to see typical roles, common requirements, the
              signals we evaluate, and a sample of the evidence we quote back.
            </p>
          </div>
          <div className="mt-8">
            <IndustryRoleExplorer entry={entry} />
          </div>
        </PublicPage>
      </PublicSection>

      {/* 5. Interactive candidate-signal explorer */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-12">
        <PublicPage>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
              Candidate signals
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              What TaaSFlow evaluates for {entry.name}
            </h2>
            <p className="mt-2 text-[color:var(--brand-navy)]/70">
              Every point of the score maps to a specific evidence quote from
              the CV. Tap a signal to see what it means and how we validate it.
            </p>
          </div>
          <div className="mt-8">
            <IndustrySignalExplorer entry={entry} />
          </div>
        </PublicPage>
      </PublicSection>



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
            <DeliveryVisual entry={entry} />
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

      {/* 9. Related industries — engine-driven, guaranteed 3–5 meaningful links */}
      <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-12">
        <PublicPage>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
                Adjacent hiring
              </p>
              <h2 className="mt-1 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
                Related industries
              </h2>
            </div>
            <Link
              to="/industries"
              className="hidden text-sm font-semibold text-[color:var(--brand-ocean)] underline-offset-4 hover:underline sm:inline-flex"
            >
              See all industries →
            </Link>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {relationships.related.map((r, i) => (
              <Link
                key={r.slug}
                to="/industries/$slug"
                params={{ slug: r.slug }}
                style={{ animationDelay: `${i * 60}ms` }}
                className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-ocean)]/50 hover:shadow-md motion-safe:animate-[fade-in_320ms_ease-out_both]"
              >
                <h3 className="text-lg font-semibold text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean)]">
                  {r.name}
                </h3>
                {r.blurb ? (
                  <p className="mt-2 line-clamp-3 text-sm text-[color:var(--brand-navy)]/70">
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

      {/* 9a. Industry link web — commercial + audience + Start hiring */}
      <PublicSection className="py-10">
        <PublicPage>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              to={relationships.commercial.to}
              className="group flex items-center justify-between rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-colors hover:border-[color:var(--brand-ocean)]/50"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">Commercial</p>
                <p className="mt-1 font-semibold text-[color:var(--brand-navy)]">{relationships.commercial.label}</p>
                <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">Subscription pricing — no placement fees.</p>
              </div>
              <span className="text-lg text-[color:var(--brand-ocean)] transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              to={relationships.audience.to}
              className="group flex items-center justify-between rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-colors hover:border-[color:var(--brand-ocean)]/50"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">Audience</p>
                <p className="mt-1 font-semibold text-[color:var(--brand-navy)]">{relationships.audience.label}</p>
                <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">{relationships.audience.blurb}</p>
              </div>
              <span className="text-lg text-[color:var(--brand-ocean)] transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              to="/intake"
              className="group flex items-center justify-between rounded-2xl border border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] p-6 text-white transition-opacity hover:opacity-95"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Next step</p>
                <p className="mt-1 font-semibold">Start hiring for {entry.name}</p>
                <p className="mt-1 text-sm text-white/80">Guided intake — draft saving, no login required.</p>
              </div>
              <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </PublicPage>
      </PublicSection>

      {/* 9b. Industry-specific blog insights */}
      <IndustryInsights industrySlug={entry.slug} industryName={entry.name} />

      {/* 10. Related resources — 2 guides + pricing + process + category article */}
      <PublicSection className="py-12">
        <PublicPage>
          <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
            {entry.name} hiring resources
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--brand-navy)]/70">
            Two hiring guides, a commercial explainer, the process breakdown, and a category-relevant read — everything a
            hiring lead in {entry.name} typically needs before intake.
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {relationships.resources.map((r, i) => (
              <Link
                key={`${r.to}-${i}`}
                to={r.to}
                style={{ animationDelay: `${i * 50}ms` }}
                className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-ocean)]/50 hover:shadow-md motion-safe:animate-[fade-in_320ms_ease-out_both]"
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

function DeliveryVisual({ entry }: { entry: IndustryEntry }) {
  // Fully fictional candidate — no production data.
  const primaryRole = entry.roleFamilies?.[0]?.roles?.[0] ?? entry.roles[0] ?? `${entry.name} specialist`;
  const skillChips = (entry.skills ?? entry.tools ?? entry.signals).slice(0, 3);
  const evidenceLine =
    entry.candidateSignals?.[0]?.body ??
    `Delivered a ${entry.name.toLowerCase()} programme with measurable outcomes — scope and stakeholders documented on the CV.`;
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 shadow-sm motion-safe:animate-[fade-in_400ms_ease-out]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-navy)]/55">
            {entry.name} shortlist · Fictional
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">
            Candidate #A-1042 · Alex R.
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/70">
            Applying as: {primaryRole}
          </p>
        </div>
        <div className="rounded-full bg-[color:var(--brand-ocean)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--brand-ocean)]">
          Fit 94
        </div>
      </div>
      {skillChips.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {skillChips.map((s) => (
            <li
              key={s}
              className="rounded-full bg-[color:var(--brand-navy)]/5 px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--brand-navy)]/80"
            >
              {s}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 space-y-2 text-xs text-[color:var(--brand-navy)]/80">
        <RequirementBar label="Role fit" pct={96} />
        <RequirementBar label="Scope & scale" pct={91} />
        <RequirementBar label="Delivery evidence" pct={88} />
        <RequirementBar label="Communication" pct={82} />
      </div>
      <div className="mt-4 rounded-lg bg-[color:var(--brand-mist)]/60 p-3 text-xs text-[color:var(--brand-navy)]/80">
        <p className="font-semibold text-[color:var(--brand-navy)]">
          Recommended: shortlist
        </p>
        <p className="mt-1 line-clamp-3">
          “{evidenceLine}”
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
          Fictional example — no production candidate data.
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
