/**
 * IndustryPage — composable orchestrator for public industry pages.
 *
 * Reads an archetype from `industry-archetypes.ts` and renders sections in
 * the order that archetype prescribes. Replaces the single cloned
 * `industry-template.tsx` layout without deleting substantive content —
 * every entry field from `industries-v2.ts` still lands somewhere.
 *
 * Six hero variants live at the bottom of this file. None of them use the
 * legacy split-hero pattern with the "Sourcing live" chip or decorative
 * "Fit 92" badge; those visuals are retired from the new design system.
 */

import { Link } from "@tanstack/react-router";
import { CalendarDays, MessageSquare, ArrowRight } from "lucide-react";
import type { IndustryEntry } from "@/content/industries-v2";
import {
  getArchetypeForSlug,
  type ArchetypeSpec,
  type IndustrySectionKey,
} from "@/content/industry-archetypes";
import { getIndustryHeroImage } from "@/content/industry-hero-images";
import { getIndustryVisualIdentity } from "@/content/industry-visual-identity";
import { getIndustryRelationships } from "@/lib/marketing/industry-relationships";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";
import {
  PublicPage,
  PublicSection,
  Breadcrumbs,
  SiteShell,
} from "@/components/marketing/site-shell";
import { IndustryRoleExplorer } from "@/components/marketing/industry-role-explorer";
import { IndustrySignalExplorer } from "@/components/marketing/industry-signal-explorer";
import { IndustryInsights } from "@/components/marketing/industry-insights";
import { IndustryHeroBackdrop } from "@/components/marketing/industry-hero-backdrop";
import {
  BookACallDialog,
  BookACallSection,
} from "@/components/marketing/book-a-call";
import { SubtleCta } from "@/components/marketing/subtle-cta";

/* ==========================================================================
 *  ORCHESTRATOR
 * ========================================================================== */

export function IndustryPage({ entry }: { entry: IndustryEntry }) {
  const spec = getArchetypeForSlug(entry.slug);
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

  const ctx = { entry, spec, relationships } as const;

  return (
    <SiteShell>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Industries", to: "/industries" },
          { label: entry.name },
        ]}
      />
      {spec.sections.map((key) => (
        <SectionRenderer key={key} sectionKey={key} ctx={ctx} />
      ))}
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </SiteShell>
  );
}

type Ctx = {
  entry: IndustryEntry;
  spec: ArchetypeSpec;
  relationships: ReturnType<typeof getIndustryRelationships>;
};

function SectionRenderer({
  sectionKey,
  ctx,
}: {
  sectionKey: IndustrySectionKey;
  ctx: Ctx;
}) {
  switch (sectionKey) {
    case "hero":
      return <HeroSwitch ctx={ctx} />;
    case "key-tiles":
      return ctx.spec.showKeyTiles ? <SectionKeyTiles ctx={ctx} /> : null;
    case "challenges":
      return <SectionChallenges ctx={ctx} />;
    case "solutions":
      return ctx.entry.solutions?.length ? <SectionSolutions ctx={ctx} /> : null;
    case "role-explorer":
      return <SectionRoleExplorer ctx={ctx} />;
    case "signal-explorer":
      return <SectionSignalExplorer ctx={ctx} />;
    case "skills-tools":
      return hasSkillsBlock(ctx.entry) ? <SectionSkillsTools ctx={ctx} /> : null;
    case "delivery-preview":
      return ctx.spec.showDeliveryPreview ? <SectionDeliveryPreview ctx={ctx} /> : null;
    case "process":
      return <SectionProcess ctx={ctx} />;
    case "keyword-links":
      return <SectionKeywordLinks ctx={ctx} />;
    case "related":
      return <SectionRelated ctx={ctx} />;
    case "insights":
      return (
        <IndustryInsights
          industrySlug={ctx.entry.slug}
          industryName={ctx.entry.name}
        />
      );
    case "faq":
      return ctx.entry.faqs?.length ? <SectionFaq ctx={ctx} /> : null;
    case "cta":
      return <SectionCta ctx={ctx} />;
    default:
      return null;
  }
}

function hasSkillsBlock(e: IndustryEntry) {
  return Boolean(
    e.skills?.length ||
      e.tools?.length ||
      e.certifications?.length ||
      e.regulatedRequirements?.length,
  );
}

/* ==========================================================================
 *  SHARED PRIMITIVES
 * ========================================================================== */

function HeroActions({ entry }: { entry: IndustryEntry }) {
  return (
    <div className="flex flex-wrap gap-3">
      <BookACallDialog
        industrySlug={entry.slug}
        industryName={entry.name}
        trigger={
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90">
            <CalendarDays className="h-4 w-4" />
            Book a {entry.name} call
          </button>
        }
      />
      <BookACallDialog
        industrySlug={entry.slug}
        industryName={entry.name}
        defaultTab="message"
        trigger={
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[color:var(--brand-navy)]/20 px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5">
            <MessageSquare className="h-4 w-4" />
            Send a message
          </button>
        }
      />
      <a
        href="#role-explorer"
        className="inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)]/70 hover:text-[color:var(--brand-navy)]"
      >
        Explore roles →
      </a>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto max-w-2xl text-center"
          : "max-w-3xl"
      }
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-[2.15rem]">
        {title}
      </h2>
      {intro ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--brand-navy)]/70">
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 *  HERO VARIANTS  (6 distinct compositions)
 * ========================================================================== */

function HeroSwitch({ ctx }: { ctx: Ctx }) {
  switch (ctx.spec.heroVariant) {
    case "cinematic":
      return <HeroCinematic ctx={ctx} />;
    case "field-report":
      return <HeroFieldReport ctx={ctx} />;
    case "data-dense":
      return <HeroDataDense ctx={ctx} />;
    case "regulated-serif":
      return <HeroRegulatedSerif ctx={ctx} />;
    case "human-portrait":
      return <HeroHumanPortrait ctx={ctx} />;
    case "commercial-momentum":
      return <HeroCommercialMomentum ctx={ctx} />;
  }
}

/** 1. Cinematic — full-bleed photo, headline anchored bottom-left. */
function HeroCinematic({ ctx }: { ctx: Ctx }) {
  const { entry, spec } = ctx;
  const heroImage = getIndustryHeroImage(entry.slug);
  const identity = getIndustryVisualIdentity(entry.slug);
  return (
    <PublicSection className="pb-6 pt-6 sm:pt-8">
      <PublicPage>
        <figure className="relative overflow-hidden rounded-3xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 shadow-[0_40px_120px_-40px_rgba(10,20,50,0.55)]">
          <div className="relative aspect-[16/10] w-full sm:aspect-[21/9]">
            {heroImage ? (
              <img
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                style={{ objectPosition: heroImage.focal ?? "50% 40%" }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <IndustryHeroBackdrop
                gradient={identity.gradient}
                accent={identity.accent}
                pattern={identity.pattern}
                label={entry.name}
                eyebrow={entry.eyebrow}
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color:var(--brand-navy)]/85 via-[color:var(--brand-navy)]/25 to-transparent" />
          </div>
          <figcaption className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/75">
              {entry.eyebrow} · {spec.toneLabel}
            </p>
            <h1 className="mt-3 max-w-3xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              {entry.hero.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
              {entry.hero.subtitle}
            </p>
            <div className="mt-6">
              <HeroActions entry={entry} />
            </div>
          </figcaption>
        </figure>
      </PublicPage>
    </PublicSection>
  );
}

/** 2. Field report — split with meta-panel; document-like KPI rows. */
function HeroFieldReport({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  const heroImage = getIndustryHeroImage(entry.slug);
  const identity = getIndustryVisualIdentity(entry.slug);
  return (
    <PublicSection className="pb-8 pt-10 sm:pt-14">
      <PublicPage>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-stretch">
          <div className="relative overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] text-white">
            <div className="absolute inset-0 opacity-40">
              {heroImage ? (
                <img
                  src={heroImage.src}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover"
                  style={{ objectPosition: heroImage.focal ?? "50% 45%" }}
                />
              ) : (
                <IndustryHeroBackdrop
                  gradient={identity.gradient}
                  accent={identity.accent}
                  pattern={identity.pattern}
                  label=""
                  eyebrow=""
                />
              )}
            </div>
            <div className="relative p-8 sm:p-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Field report — {entry.name}
              </p>
              <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
                {entry.hero.title}
              </h1>
              <p className="mt-4 max-w-lg text-sm text-white/85 sm:text-base">
                {entry.hero.subtitle}
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-6 text-xs">
                {entry.signals.slice(0, 4).map((s) => (
                  <div key={s} className="text-white/85">
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-white/50">
                      Signal
                    </span>
                    <span className="mt-1 block text-sm font-medium">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/60">
                {entry.eyebrow}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-[color:var(--brand-navy)]/80">
                Site-aware, certification-first sourcing. Every {entry.name.toLowerCase()} shortlist
                is reviewed against role, jurisdiction, and delivery evidence
                before it reaches you.
              </p>
              {entry.roleFamilies?.length ? (
                <ul className="mt-6 space-y-2 text-sm text-[color:var(--brand-navy)]/80">
                  {entry.roleFamilies.slice(0, 4).map((rf) => (
                    <li
                      key={rf.name}
                      className="flex items-start gap-2 border-b border-[color:var(--brand-navy)]/5 pb-2 last:border-none"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]" />
                      <span>
                        <span className="font-semibold text-[color:var(--brand-navy)]">
                          {rf.name}
                        </span>
                        {rf.blurb ? (
                          <span className="ml-1 text-[color:var(--brand-navy)]/60">
                            — {rf.blurb}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="mt-8">
              <HeroActions entry={entry} />
            </div>
          </div>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/** 3. Data-dense — typographic hero + dense signal grid. */
function HeroDataDense({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  return (
    <PublicSection className="pb-8 pt-14">
      <PublicPage>
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean)]">
            {entry.eyebrow}
          </p>
          <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            {entry.hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            {entry.hero.subtitle}
          </p>
          <div className="mt-8">
            <HeroActions entry={entry} />
          </div>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {entry.signals.slice(0, 4).map((s, i) => (
            <div
              key={s}
              className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/45">
                Signal {String(i + 1).padStart(2, "0")}
              </p>
              <p className="mt-2 text-sm font-medium text-[color:var(--brand-navy)]">
                {s}
              </p>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/** 4. Regulated serif — considered, portrait or library, columns tone. */
function HeroRegulatedSerif({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  const heroImage = getIndustryHeroImage(entry.slug);
  const identity = getIndustryVisualIdentity(entry.slug);
  return (
    <PublicSection className="pb-8 pt-14 sm:pt-20">
      <PublicPage>
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-navy)]/60">
              {entry.eyebrow}
            </p>
            <h1
              className="mt-6 max-w-2xl text-4xl font-normal leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-[3.4rem]"
              style={{ fontFamily: "var(--brand-font-serif, Georgia, serif)" }}
            >
              {entry.hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--brand-navy)]/75">
              {entry.hero.subtitle}
            </p>
            <div className="mt-8">
              <HeroActions entry={entry} />
            </div>
            {entry.regulatedRequirements?.length ? (
              <p className="mt-10 max-w-lg border-l-2 border-[color:var(--brand-ocean)] pl-4 text-xs uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/55">
                Regulated · {entry.regulatedRequirements.slice(0, 3).join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-[color:var(--brand-navy)]/10 shadow-[0_20px_60px_-25px_rgba(10,20,50,0.35)]">
            {heroImage ? (
              <img
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                style={{ objectPosition: heroImage.focal ?? "50% 30%" }}
                className="h-full w-full object-cover"
              />
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
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/** 5. Human portrait — warm, close-up, storytelling. */
function HeroHumanPortrait({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  const heroImage = getIndustryHeroImage(entry.slug);
  const identity = getIndustryVisualIdentity(entry.slug);
  return (
    <PublicSection className="pb-8 pt-10 sm:pt-14">
      <PublicPage>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 shadow-[0_30px_80px_-30px_rgba(10,20,50,0.35)]">
            {heroImage ? (
              <img
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                style={{ objectPosition: heroImage.focal ?? "50% 30%" }}
                className="h-full w-full object-cover"
              />
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
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean)]">
              {entry.eyebrow}
            </p>
            <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
              {entry.hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[color:var(--brand-navy)]/75">
              {entry.hero.subtitle}
            </p>
            <div className="mt-8">
              <HeroActions entry={entry} />
            </div>
            {entry.certifications?.length ? (
              <ul className="mt-8 flex flex-wrap gap-2">
                {entry.certifications.slice(0, 4).map((c) => (
                  <li
                    key={c}
                    className="rounded-full border border-[color:var(--brand-navy)]/15 bg-white px-3 py-1 text-xs font-medium text-[color:var(--brand-navy)]/80"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/** 6. Commercial momentum — big typographic hero + kinetic signal ribbon. */
function HeroCommercialMomentum({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  return (
    <PublicSection className="pb-6 pt-14 sm:pt-20">
      <PublicPage>
        <div className="max-w-5xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean)]">
            {entry.eyebrow} — Momentum
          </p>
          <h1 className="mt-4 font-[family-name:var(--brand-font-display)] text-4xl font-semibold leading-[0.98] tracking-tight sm:text-[4.5rem]">
            {entry.hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-[color:var(--brand-navy)]/70">
            {entry.hero.subtitle}
          </p>
          <div className="mt-8">
            <HeroActions entry={entry} />
          </div>
        </div>
        <div className="mt-10 overflow-hidden rounded-full border border-[color:var(--brand-navy)]/10 bg-white">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3 text-xs font-medium text-[color:var(--brand-navy)]/70">
            {entry.signals.map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ background: "var(--brand-ocean)" }}
                />
                <span>{s}</span>
                {i < entry.signals.length - 1 ? (
                  <span className="text-[color:var(--brand-navy)]/25">·</span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/* ==========================================================================
 *  SECTION PRIMITIVES
 * ========================================================================== */

function SectionKeyTiles({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  const items = [
    { label: "Role families", value: entry.roleFamilies?.length ?? 0, suffix: "" },
    { label: "Signals evaluated", value: entry.signals.length, suffix: "" },
    { label: "Delivery cadence", value: "Weekly", suffix: "" },
    { label: "Commercial model", value: "Subscription", suffix: "" },
  ];
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] py-8">
      <PublicPage>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((k) => (
            <div
              key={k.label}
              className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/50">
                {k.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--brand-navy)]">
                {k.value}
                {k.suffix}
              </p>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionChallenges({ ctx }: { ctx: Ctx }) {
  const { entry, spec } = ctx;
  const columns = spec.archetype === "data-dense" ? "lg:grid-cols-4" : "lg:grid-cols-3";
  return (
    <PublicSection className="py-12">
      <PublicPage>
        <SectionHeading
          eyebrow="Hiring reality"
          title={`${entry.name} hiring challenges`}
          intro={`What we hear from ${entry.name} teams before they switch to a structured, evidence-based workflow.`}
        />
        <div className={`mt-8 grid gap-5 md:grid-cols-2 ${columns}`}>
          {entry.challenges.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
            >
              <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                {c.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionSolutions({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  if (!entry.solutions?.length) return null;
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-14">
      <PublicPage>
        <SectionHeading
          eyebrow="What TaaSFlow does here"
          title={`How TaaSFlow supports ${entry.name}`}
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {entry.solutions.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
            >
              <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
                {s.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionRoleExplorer({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  return (
    <PublicSection className="py-14">
      <span id="role-explorer" className="sr-only" aria-hidden />
      <PublicPage>
        <SectionHeading
          eyebrow="Role explorer"
          title={`Explore ${entry.name} roles TaaSFlow sources`}
          intro="Select a family to see typical roles, common requirements, the signals we evaluate, and a sample of the evidence we quote back."
        />
        <div className="mt-8">
          <IndustryRoleExplorer entry={entry} />
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionSignalExplorer({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-14">
      <PublicPage>
        <SectionHeading
          eyebrow="Candidate signals"
          title={`What TaaSFlow evaluates for ${entry.name}`}
          intro="Every point of the score maps to a specific evidence quote from the CV. Tap a signal to see what it means and how we validate it."
        />
        <div className="mt-8">
          <IndustrySignalExplorer entry={entry} />
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionSkillsTools({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  const groups = [
    { title: "Skills", items: entry.skills ?? [] },
    { title: "Tools & platforms", items: entry.tools ?? [] },
    { title: "Certifications", items: entry.certifications ?? [] },
    { title: "Regulated requirements", items: entry.regulatedRequirements ?? [] },
  ].filter((g) => g.items.length);
  if (!groups.length) return null;
  return (
    <PublicSection className="py-12">
      <PublicPage>
        <SectionHeading
          eyebrow="Craft"
          title="Skills, tools and certifications"
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {groups.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
            >
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
                {g.title}
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {g.items.map((it) => (
                  <li
                    key={it}
                    className="rounded-full bg-[color:var(--brand-navy)]/5 px-3 py-1 text-xs font-medium text-[color:var(--brand-navy)]/85"
                  >
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionDeliveryPreview({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  const primaryRole =
    entry.roleFamilies?.[0]?.roles?.[0] ??
    entry.roles[0] ??
    `${entry.name} specialist`;
  const skillChips = (entry.skills ?? entry.tools ?? entry.signals).slice(0, 3);
  const evidenceLine =
    entry.candidateSignals?.[0]?.body ??
    `Delivered a ${entry.name.toLowerCase()} programme with measurable outcomes — scope and stakeholders documented on the CV.`;
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] py-14">
      <PublicPage>
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow="In your workspace"
              title={`What a ${entry.name} shortlist looks like`}
              intro="Ranked candidates with a fit score, requirement coverage, evidence quotes, strengths, and validation areas — reviewed before it reaches you."
            />
          </div>
          <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/55">
                  {entry.name} shortlist · Illustrative
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">
                  Candidate #A-1042 · Alex R.
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/70">
                  Applying as: {primaryRole}
                </p>
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
              <p className="mt-1 line-clamp-3">“{evidenceLine}”</p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/50">
                Illustrative — no production candidate data.
              </p>
            </div>
          </div>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function RequirementBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-semibold text-[color:var(--brand-navy)]">{pct}</span>
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

function SectionProcess({ ctx }: { ctx: Ctx }) {
  const { entry, spec } = ctx;
  const steps = [
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
  ];
  return (
    <PublicSection className="py-12">
      <PublicPage>
        <SectionHeading
          eyebrow="Process"
          title={`The ${entry.name} hiring process`}
        />
        {spec.processStyle === "numbered-cards" ? (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
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
        ) : spec.processStyle === "stepped-timeline" ? (
          <ol className="mt-8 space-y-6 border-l-2 border-[color:var(--brand-navy)]/10 pl-6">
            {steps.map((s) => (
              <li key={s.n} className="relative">
                <span className="absolute -left-[33px] top-0 grid h-6 w-6 place-items-center rounded-full bg-[color:var(--brand-navy)] text-[10px] font-semibold text-white">
                  {s.n}
                </span>
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="mt-1 text-sm text-[color:var(--brand-navy)]/75">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-8 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            {steps.map((s) => (
              <div
                key={s.n}
                className="grid grid-cols-[auto_1fr] gap-6 p-5 sm:grid-cols-[80px_1fr_2fr]"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/45">
                  {s.n}
                </span>
                <span className="font-semibold text-[color:var(--brand-navy)]">
                  {s.title}
                </span>
                <span className="col-span-2 text-sm text-[color:var(--brand-navy)]/75 sm:col-span-1">
                  {s.body}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm text-[color:var(--brand-navy)]/60">
          See the full process on{" "}
          <Link to="/how-it-works" className="underline underline-offset-4">
            how it works
          </Link>
          .
        </p>
      </PublicPage>
    </PublicSection>
  );
}

function SectionKeywordLinks({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  return (
    <PublicSection className="py-6">
      <PublicPage>
        <p className="max-w-3xl text-sm leading-relaxed text-[color:var(--brand-navy)]/70">
          Hiring in{" "}
          <span className="font-semibold text-[color:var(--brand-navy)]">
            {entry.name}
          </span>
          ? See how{" "}
          <Link to="/" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
            TaaSFlow
          </Link>{" "}
          delivers ranked candidates weekly for{" "}
          <Link to="/solutions" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
            scaling operators
          </Link>{" "}
          and{" "}
          <Link to="/enterprise" className="font-medium text-[color:var(--brand-navy)] underline underline-offset-4">
            enterprise teams
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
        <SubtleCta
          variant="hire"
          headline={`Hiring for ${entry.name}? Get ranked ${entry.name} candidates every week.`}
          className="mt-6"
        />
      </PublicPage>
    </PublicSection>
  );
}

function SectionRelated({ ctx }: { ctx: Ctx }) {
  const { relationships } = ctx;
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-14">
      <PublicPage>
        <div className="flex items-end justify-between gap-4">
          <SectionHeading eyebrow="Adjacent hiring" title="Related industries" />
          <Link
            to="/industries"
            className="hidden text-sm font-semibold text-[color:var(--brand-ocean)] underline-offset-4 hover:underline sm:inline-flex"
          >
            See all industries →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {relationships.related.map((r) => (
            <Link
              key={r.slug}
              to="/industries/$slug"
              params={{ slug: toPublicSlug(r.slug) }}
              className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-ocean)]/50 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean)]">
                {r.name}
              </h3>
              {r.blurb ? (
                <p className="mt-2 line-clamp-3 text-sm text-[color:var(--brand-navy)]/70">
                  {r.blurb}
                </p>
              ) : null}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)]">
                Explore <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionFaq({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  if (!entry.faqs?.length) return null;
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-14">
      <PublicPage>
        <SectionHeading
          eyebrow="Common questions"
          title={`${entry.name} hiring FAQ`}
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {entry.faqs.map((f) => (
            <div
              key={f.q}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
            >
              <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">
                {f.q}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function SectionCta({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  return (
    <BookACallSection
      industrySlug={entry.slug}
      industryName={entry.name}
      eyebrow={entry.eyebrow}
      title={entry.cta.title}
      description={entry.cta.description}
    />
  );
}
