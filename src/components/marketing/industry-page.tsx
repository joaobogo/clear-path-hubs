/**
 * IndustryPage — composable orchestrator for public industry pages.
 *
 * Reads the archetype from `industry-archetypes.ts` and the derived page
 * config from `industry-config.ts`, then renders sections in the archetype's
 * declared order. Six distinct hero systems live at the bottom of this file.
 *
 * Design invariants
 *  - Primary hero CTA is always "Discuss your hiring needs" — no
 *    industry-name-baked "Book a X call" labels.
 *  - No "Sourcing live" pill, no decorative "Fit 92" overlay, no dark metric
 *    strip below the hero, no repeated three-chip strip below CTAs.
 *  - H1 uses `text-balance` and a bounded `max-w` so no line ends with a
 *    single orphaned word from 320px through desktop.
 *  - The delivery-preview card, when shown, is clearly labelled
 *    "Product demonstration — example data" — never presented as live.
 *  - Sections whose backing data is empty return `null` (never a placeholder).
 */

import { HeroPicture } from "@/components/marketing/hero-picture";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { IndustryEntry } from "@/content/industries-v2";
import { type IndustrySectionKey } from "@/content/industry-archetypes";
import {
  getIndustryConfig,
  type IndustryConfig,
} from "@/content/industry-config";
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
  const config = getIndustryConfig(entry);
  const relationships = getIndustryRelationships(entry);
  const jsonLd = entry.faqs?.length
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

  const ctx: Ctx = { entry, config, relationships };

  return (
    <SiteShell>
      <Breadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: "Industries", to: "/industries" },
          { label: entry.name },
        ]}
      />
      {config.spec.sections.map((key) => (
        <Fragment key={key}>
          <SectionRenderer sectionKey={key} ctx={ctx} />
          {key === configAnchor ? (
            <VerticalConfigurationSection slug={entry.slug} industryName={entry.name} />
          ) : null}
        </Fragment>
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
  config: IndustryConfig;
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
    case "challenges":
      return ctx.entry.challenges?.length ? <SectionChallenges ctx={ctx} /> : null;
    case "solutions":
      return ctx.entry.solutions?.length ? <SectionSolutions ctx={ctx} /> : null;
    case "role-explorer":
      return <SectionRoleExplorer ctx={ctx} />;
    case "signal-explorer":
      // Legacy alias — the scoring slot is the canonical placement.
      return <SectionScoring ctx={ctx} />;
    case "scoring":
      return <SectionScoring ctx={ctx} />;
    case "skills-tools":
      return hasSkillsBlock(ctx.entry) ? <SectionSkillsTools ctx={ctx} /> : null;
    case "delivery-preview":
      return ctx.config.spec.showDeliveryPreview ? <SectionDeliveryPreview ctx={ctx} /> : null;
    case "proof":
      return <SectionProof ctx={ctx} />;
    case "process":
      return <SectionProcess ctx={ctx} />;
    case "keyword-links":
      return <SectionKeywordLinks ctx={ctx} />;
    case "related":
      return relationships(ctx).length ? <SectionRelated ctx={ctx} /> : null;
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

function relationships(ctx: Ctx) {
  return ctx.relationships.related ?? [];
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

function HeroActions({
  entry,
  config,
  tone = "light",
}: {
  entry: IndustryEntry;
  config: IndustryConfig;
  tone?: "light" | "dark";
}) {
  const secondaryIsAnchor = config.secondaryCta.to.startsWith("#");
  const secondaryCls =
    tone === "dark"
      ? "text-white/85 hover:text-white"
      : "text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BookACallDialog
        industrySlug={entry.slug}
        industryName={entry.name}
        trigger={
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            {config.primaryCta.label}
          </button>
        }
      />
      {secondaryIsAnchor ? (
        <a
          href={config.secondaryCta.to}
          className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-3 py-2.5 text-sm font-semibold ${secondaryCls}`}
        >
          {config.secondaryCta.label} <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      ) : (
        <Link
          to={config.secondaryCta.to}
          className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-md px-3 py-2.5 text-sm font-semibold ${secondaryCls}`}
        >
          {config.secondaryCta.label} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function HeroCredibility({ text, tone = "light" }: { text: string; tone?: "light" | "dark" }) {
  const cls =
    tone === "dark"
      ? "text-white/70"
      : "text-[color:var(--brand-navy)]/80";
  return (
    <p className={`mt-6 max-w-xl text-xs uppercase tracking-[0.14em] ${cls}`}>
      {text}
    </p>
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
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-3xl"
      }
    >
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-ocean-text)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight sm:text-[2.15rem]">
        {title}
      </h2>
      {intro ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--brand-navy)]/80">
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/* ==========================================================================
 *  HERO VARIANTS  (six distinct compositions)
 * ========================================================================== */

function HeroSwitch({ ctx }: { ctx: Ctx }) {
  switch (ctx.config.spec.heroVariant) {
    case "systems-capability":
      return <HeroSystemsCapability ctx={ctx} />;
    case "trust-compliance":
      return <HeroTrustCompliance ctx={ctx} />;
    case "risk-judgment":
      return <HeroRiskJudgment ctx={ctx} />;
    case "operations-delivery":
      return <HeroOperationsDelivery ctx={ctx} />;
    case "service-experience":
      return <HeroServiceExperience ctx={ctx} />;
    case "expertise-growth":
      return <HeroExpertiseGrowth ctx={ctx} />;
  }
}

/** Shared H1 — bounded width + text-balance to prevent orphaned last word. */
function HeroH1({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={`font-[family-name:var(--brand-font-display)] text-3xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-4xl md:text-5xl ${className}`}
    >
      {children}
    </h1>
  );
}

/** 1. Systems & Capability — asymmetric technical field with a capability map. */
function HeroSystemsCapability({ ctx }: { ctx: Ctx }) {
  const { entry, config } = ctx;
  const capabilities = [
    { label: "Skills", items: (entry.skills ?? []).slice(0, 4) },
    { label: "Stack", items: (entry.tools ?? []).slice(0, 4) },
    { label: "Signals", items: (entry.signals ?? []).slice(0, 4) },
    { label: "Credentials", items: (entry.certifications ?? []).slice(0, 3) },
  ].filter((c) => c.items.length);

  return (
    <PublicSection className="relative overflow-hidden pb-8 pt-10 sm:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          color: "var(--brand-navy)",
        }}
      />
      <PublicPage className="relative">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">
              {entry.eyebrow} · {config.familyLabel}
            </p>
            <HeroH1 className="mt-5 max-w-[22ch]">{entry.hero.title}</HeroH1>
            <p className="mt-5 max-w-xl text-base text-[color:var(--brand-navy)]/80 sm:text-lg">
              {config.valueProp}
            </p>
            <div className="mt-8">
              <HeroActions entry={entry} config={config} />
            </div>
            <HeroCredibility text={config.credibility} />
          </div>
          {capabilities.length ? (
            <aside
              aria-label="Capability map"
              className="grid grid-cols-2 gap-3 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white/90 p-4 shadow-sm backdrop-blur"
            >
              {capabilities.map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl bg-[color:var(--brand-paper)] p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
                    {c.label}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs font-medium text-[color:var(--brand-navy)]/85">
                    {c.items.map((item) => (
                      <li key={item} className="line-clamp-1">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </aside>
          ) : null}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/** 2. Trust & Compliance — calm editorial hero with a credential/decision-gate pathway. */
function HeroTrustCompliance({ ctx }: { ctx: Ctx }) {
  const { entry, config } = ctx;
  const heroImage = getIndustryHeroImage(entry.slug);
  const identity = getIndustryVisualIdentity(entry.slug);
  const gates = [
    { title: "Licence and credential", body: entry.certifications?.[0] ?? "Verified against issuing bodies before shortlist." },
    { title: "Regulatory scope", body: entry.regulatedRequirements?.[0] ?? "Programme, jurisdiction and continuity checked against role." },
    { title: "Continuity of care", body: entry.candidateSignals?.[0]?.body ?? "Handover, documentation and stakeholder continuity evidenced on the CV." },
  ];

  return (
    <PublicSection className="pb-8 pt-10 sm:pt-14">
      <PublicPage>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-navy)]/80">
              {entry.eyebrow} · {config.familyLabel}
            </p>
            <HeroH1 className="mt-5 max-w-[24ch]">{entry.hero.title}</HeroH1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[color:var(--brand-navy)]/80">
              {config.valueProp}
            </p>
            <div className="mt-8">
              <HeroActions entry={entry} config={config} />
            </div>
            <HeroCredibility text={config.credibility} />
          </div>
          <aside
            aria-label="Decision gates"
            className="relative rounded-3xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/50 p-5"
          >
            {heroImage ? (
              <div className="mb-4 aspect-[16/9] overflow-hidden rounded-2xl">
                <HeroPicture
                  src={heroImage.src}
                  alt={heroImage.alt}
                  width={heroImage.width}
                  height={heroImage.height}
                  priority
                  style={{ objectPosition: heroImage.focal ?? "50% 40%" }}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="mb-4 aspect-[16/9] overflow-hidden rounded-2xl">
                <IndustryHeroBackdrop
                  gradient={identity.gradient}
                  accent={identity.accent}
                  pattern={identity.pattern}
                  label={entry.name}
                  eyebrow={entry.eyebrow}
                />
              </div>
            )}
            <ol className="space-y-3">
              {gates.map((g, i) => (
                <li
                  key={g.title}
                  className="flex items-start gap-3 rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-3"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[color:var(--brand-navy)] text-[10px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                      {g.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[color:var(--brand-navy)]/80">
                      {g.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/** 3. Risk & Judgment — document/case-file composition with compact risk matrix. */
function HeroRiskJudgment({ ctx }: { ctx: Ctx }) {
  const { entry, config } = ctx;
  const matrix = [
    { axis: "Regulatory scope", value: entry.regulatedRequirements?.[0] ?? "Jurisdiction verified" },
    { axis: "Judgment complexity", value: entry.signals?.[0] ?? "Reviewed at every stage" },
    { axis: "Precedent volume", value: entry.signals?.[1] ?? "Quoted from CV" },
    { axis: "Client stake", value: entry.roleFamilies?.[0]?.name ?? "Senior stakeholders" },
  ];

  return (
    <PublicSection className="bg-[color:var(--brand-paper)] pb-10 pt-12 sm:pt-16">
      <PublicPage>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-navy)]/80">
              {entry.eyebrow} · {config.familyLabel}
            </p>
            <h1
              className="mt-6 max-w-[22ch] text-4xl font-normal leading-[1.05] tracking-tight text-balance text-[color:var(--brand-navy)] sm:text-5xl md:text-[3.4rem]"
              style={{ fontFamily: "var(--brand-font-serif, Georgia, serif)" }}
            >
              {entry.hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--brand-navy)]/80">
              {config.valueProp}
            </p>
            <div className="mt-8">
              <HeroActions entry={entry} config={config} />
            </div>
            <HeroCredibility text={config.credibility} />
          </div>
          <aside
            aria-label="Risk and judgment matrix"
            className="rounded-2xl border border-[color:var(--brand-navy)]/15 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(10,20,50,0.25)]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
              Case-file scope · {entry.name}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {matrix.map((m) => (
                <div
                  key={m.axis}
                  className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-paper)] p-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                    {m.axis}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-[color:var(--brand-navy)]">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/** 4. Operations & Delivery — blueprint/process-map with role-to-outcome connections. */
function HeroOperationsDelivery({ ctx }: { ctx: Ctx }) {
  const { entry, config } = ctx;
  const flowRole =
    entry.roleFamilies?.[0]?.name ?? entry.roles[0] ?? `${entry.name} specialist`;
  const flowSignal = entry.signals?.[0] ?? "Site-aware evidence";
  const flowOutcome =
    entry.candidateSignals?.[0]?.title ?? "Delivered on scope, budget and safety";

  return (
    <PublicSection className="relative overflow-hidden pb-8 pt-10 sm:pt-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 40px)",
          color: "var(--brand-navy)",
        }}
      />
      <PublicPage className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">
          {entry.eyebrow} · {config.familyLabel}
        </p>
        <HeroH1 className="mt-5 max-w-[24ch]">{entry.hero.title}</HeroH1>
        <p className="mt-5 max-w-2xl text-base text-[color:var(--brand-navy)]/80 sm:text-lg">
          {config.valueProp}
        </p>
        <div className="mt-8">
          <HeroActions entry={entry} config={config} />
        </div>
        <HeroCredibility text={config.credibility} />

        <div className="mt-10 rounded-2xl border border-dashed border-[color:var(--brand-navy)]/20 bg-white/70 p-4 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
            Blueprint · role to outcome
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
            <FlowNode label="Role" value={flowRole} />
            <FlowArrow />
            <FlowNode label="Signal validated" value={flowSignal} />
            <FlowArrow />
            <FlowNode label="Outcome evidenced" value={flowOutcome} />
          </div>
        </div>
      </PublicPage>
    </PublicSection>
  );
}

function FlowNode({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
        {label}
      </p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-[color:var(--brand-navy)]">
        {value}
      </p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden md:flex justify-center text-[color:var(--brand-ocean-text)]" aria-hidden>
      <ArrowRight className="h-5 w-5" />
    </div>
  );
}

/** 5. Service & Experience — immersive editorial photo, service moment first. */
function HeroServiceExperience({ ctx }: { ctx: Ctx }) {
  const { entry, config } = ctx;
  const heroImage = getIndustryHeroImage(entry.slug);
  const identity = getIndustryVisualIdentity(entry.slug);
  return (
    <PublicSection className="pb-6 pt-6 sm:pt-8">
      <PublicPage>
        <figure className="relative overflow-hidden rounded-3xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 shadow-[0_40px_120px_-40px_rgba(10,20,50,0.55)]">
          <div className="relative aspect-[16/11] w-full sm:aspect-[21/9]">
            {heroImage ? (
              <HeroPicture
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                priority
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
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[color:var(--brand-navy)]/85 via-[color:var(--brand-navy)]/35 to-transparent" />
          </div>
          <figcaption className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
              {entry.eyebrow} · {config.familyLabel}
            </p>
            <HeroH1 className="mt-3 max-w-3xl text-white">{entry.hero.title}</HeroH1>
            <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
              {config.valueProp}
            </p>
            <div className="mt-6">
              <HeroActions entry={entry} config={config} tone="dark" />
            </div>
            <HeroCredibility text={config.credibility} tone="dark" />
          </figcaption>
        </figure>
      </PublicPage>
    </PublicSection>
  );
}

/** 6. Expertise & Growth — modular competency framework. */
function HeroExpertiseGrowth({ ctx }: { ctx: Ctx }) {
  const { entry, config } = ctx;
  const framework = [
    {
      tier: "Competencies",
      items: (entry.skills ?? entry.signals ?? []).slice(0, 3),
    },
    {
      tier: "Outcomes",
      items: (entry.candidateSignals?.map((s) => s.title) ?? entry.signals ?? []).slice(0, 3),
    },
    {
      tier: "Progression",
      items:
        entry.roleFamilies?.map((rf) => rf.name).slice(0, 3) ??
        entry.roles.slice(0, 3),
    },
  ].filter((f) => f.items.length);

  return (
    <PublicSection className="pb-8 pt-12 sm:pt-16">
      <PublicPage>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-ocean-text)]">
              {entry.eyebrow} · {config.familyLabel}
            </p>
            <HeroH1 className="mt-5 max-w-[22ch]">{entry.hero.title}</HeroH1>
            <p className="mt-5 max-w-xl text-base text-[color:var(--brand-navy)]/80 sm:text-lg">
              {config.valueProp}
            </p>
            <div className="mt-8">
              <HeroActions entry={entry} config={config} />
            </div>
            <HeroCredibility text={config.credibility} />
          </div>
          {framework.length ? (
            <aside
              aria-label="Competency framework"
              className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"
            >
              {framework.map((f) => (
                <div
                  key={f.tier}
                  className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-ocean-text)]">
                    {f.tier}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm font-medium text-[color:var(--brand-navy)]/85">
                    {f.items.map((it) => (
                      <li key={it} className="line-clamp-1">
                        · {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </aside>
          ) : null}
        </div>
      </PublicPage>
    </PublicSection>
  );
}

/* ==========================================================================
 *  SECTION PRIMITIVES
 * ========================================================================== */

function SectionChallenges({ ctx }: { ctx: Ctx }) {
  const { entry, config } = ctx;
  const signals = entry.signals ?? [];
  const evidenceFor = (i: number) => signals[i]?.replace(/^[A-Z]/, (c) => c.toLowerCase());

  const heading = (
    <SectionHeading
      eyebrow="Hiring reality"
      title={`${entry.name} hiring challenges`}
      intro={`What ${entry.name} teams tell us before switching to a structured, evidence-based workflow — and how TaaSFlow turns each risk into a scoring signal.`}
    />
  );

  // Shared eyebrow for the "evidence" line beneath each challenge body.
  const EvidenceLine = ({ text }: { text?: string }) =>
    text ? (
      <div className="mt-4 flex items-start gap-2 border-t border-current/10 pt-3 text-xs leading-relaxed opacity-80">
        <span aria-hidden className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-gold)]" />
        <span><span className="font-semibold uppercase tracking-wider">Signal captured · </span>{text}</span>
      </div>
    ) : null;

  // 1. SYSTEMS-CAPABILITY → dependency map (nodes joined by faint rails)
  if (config.archetype === "systems-capability") {
    return (
      <PublicSection className="bg-[color:var(--brand-mist)]/30 py-14">
        <PublicPage>
          {heading}
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {entry.challenges.map((c, i) => (
              <div key={c.title} className="relative">
                {i < entry.challenges.length - 1 && (
                  <span aria-hidden className="pointer-events-none absolute left-full top-8 hidden h-px w-4 -translate-y-1/2 bg-[color:var(--brand-navy)]/20 lg:block" />
                )}
                <div className="h-full rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 text-[color:var(--brand-navy)] shadow-[0_1px_0_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/80">
                    <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-[color:var(--brand-navy)] text-[10px] text-white">{i + 1}</span>
                    Node
                  </div>
                  <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-base font-semibold leading-snug">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{c.body}</p>
                  <EvidenceLine text={evidenceFor(i)} />
                </div>
              </div>
            ))}
          </div>
        </PublicPage>
      </PublicSection>
    );
  }

  // 2. RISK-JUDGMENT → decision gates: parchment cards on ink with a gate badge
  if (config.archetype === "risk-judgment") {
    return (
      <PublicSection className="bg-[color:var(--brand-navy)] py-16 text-[color:var(--brand-cream)]">
        <PublicPage>
          <div className="text-[color:var(--brand-cream)]">
            <SectionHeading
              eyebrow="Decision record"
              title={`${entry.name} hiring — where judgment is tested`}
              intro={`Each challenge maps to a gate we test explicitly, so aggregate fit never overrides a disqualifying regulatory or qualification requirement.`}
            />
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entry.challenges.map((c, i) => (
              <li key={c.title} className="rounded-2xl border border-[color:var(--brand-cream)]/15 bg-[color:var(--brand-cream)] p-6 text-[color:var(--brand-navy)]">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">
                  <span>Gate {String(i + 1).padStart(2, "0")}</span>
                  <span className="rounded-sm border border-current/25 px-1.5 py-0.5">Mandatory judgment</span>
                </div>
                <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-base font-semibold leading-snug">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{c.body}</p>
                <EvidenceLine text={evidenceFor(i)} />
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-[color:var(--brand-cream)]/70">
            TaaSFlow does not provide legal or regulatory advice. Jurisdiction, qualification and licence status appear as mandatory gates on the candidate record; downstream scoring only ranks candidates who clear them.
          </p>
        </PublicPage>
      </PublicSection>
    );
  }

  // 3. TRUST-COMPLIANCE → controls matrix (3 columns: check / why / evidence)
  if (config.archetype === "trust-compliance") {
    return (
      <PublicSection className="py-14">
        <PublicPage>
          {heading}
          <div className="mt-10 overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            <div className="hidden grid-cols-[1.5fr_2fr_1.2fr] gap-6 border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/80 md:grid">
              <span>Control</span>
              <span>Why it matters clinically</span>
              <span>Evidence captured</span>
            </div>
            <ul className="divide-y divide-[color:var(--brand-navy)]/10">
              {entry.challenges.map((c, i) => (
                <li key={c.title} className="grid gap-2 px-6 py-5 md:grid-cols-[1.5fr_2fr_1.2fr] md:gap-6">
                  <h3 className="font-[family-name:var(--brand-font-display)] text-sm font-semibold text-[color:var(--brand-navy)]">{c.title}</h3>
                  <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{c.body}</p>
                  <p className="text-xs leading-relaxed text-[color:var(--brand-navy)]/80">
                    <span className="mr-1 font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">Signal · </span>
                    {evidenceFor(i) ?? "Evidence quoted from the CV and verified before shortlist."}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </PublicPage>
      </PublicSection>
    );
  }

  // 4. OPERATIONS-DELIVERY → delivery stages ribbon
  if (config.archetype === "operations-delivery") {
    return (
      <PublicSection className="bg-[color:var(--brand-mist)]/40 py-14">
        <PublicPage>
          {heading}
          <div className="mt-10 relative">
            <span aria-hidden className="pointer-events-none absolute left-0 right-0 top-10 hidden h-px bg-gradient-to-r from-transparent via-[color:var(--brand-navy)]/25 to-transparent lg:block" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {entry.challenges.map((c, i) => (
                <div key={c.title} className="relative rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/80">
                    <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--brand-navy)]/30 bg-white text-[10px] text-[color:var(--brand-navy)]">{i + 1}</span>
                    Stage
                  </div>
                  <h3 className="mt-3 font-[family-name:var(--brand-font-display)] text-base font-semibold leading-snug text-[color:var(--brand-navy)]">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{c.body}</p>
                  <EvidenceLine text={evidenceFor(i)} />
                </div>
              ))}
            </div>
          </div>
        </PublicPage>
      </PublicSection>
    );
  }

  // 5. SERVICE-EXPERIENCE → guest / customer journey ribbon (warm palette)
  if (config.archetype === "service-experience") {
    return (
      <PublicSection className="bg-gradient-to-b from-[color:var(--brand-cream)] to-[color:var(--brand-paper)] py-14">
        <PublicPage>
          {heading}
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {entry.challenges.map((c, i) => (
              <li key={c.title} className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-gold)]">Moment {String(i + 1).padStart(2, "0")}</div>
                <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-base font-semibold leading-snug text-[color:var(--brand-navy)]">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{c.body}</p>
                <EvidenceLine text={evidenceFor(i)} />
              </li>
            ))}
          </ol>
        </PublicPage>
      </PublicSection>
    );
  }

  // 6. EXPERTISE-GROWTH → competency ladder (rows with rung numbering + accent)
  return (
    <PublicSection className="py-14">
      <PublicPage>
        {heading}
        <ul className="mt-10 space-y-3">
          {entry.challenges.map((c, i) => (
            <li key={c.title} className="grid gap-4 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 md:grid-cols-[auto_1fr_1fr] md:items-start md:gap-6">
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--brand-navy)] font-[family-name:var(--brand-font-display)] text-sm font-semibold text-white">{i + 1}</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/80">Rung</span>
              </div>
              <div>
                <h3 className="font-[family-name:var(--brand-font-display)] text-base font-semibold leading-snug text-[color:var(--brand-navy)]">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">{c.body}</p>
              </div>
              <div className="rounded-xl bg-[color:var(--brand-mist)]/50 p-4 text-xs leading-relaxed text-[color:var(--brand-navy)]/80">
                <span className="mr-1 font-semibold uppercase tracking-wider text-[color:var(--brand-gold)]">Evidence · </span>
                {evidenceFor(i) ?? "Portfolio, work samples, or measurable outcomes captured on the shortlist."}
              </div>
            </li>
          ))}
        </ul>
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
              <p className="mt-3 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
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

/**
 * Scoring section — Prompt 9 will replace this body with archetype-specific
 * scoring visuals (evidence map / decision gates / risk matrix / delivery
 * scorecard / service-journey score / competency framework). This
 * placeholder already meets the story-architecture contract: distinct
 * buyer question, reading-width intro, working link to the full
 * methodology, no decorative "Fit 92" number.
 */
function SectionScoring({ ctx }: { ctx: Ctx }) {
  const { entry } = ctx;
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-14">
      <span id="scoring" className="sr-only" aria-hidden />
      <PublicPage>
        <SectionHeading
          eyebrow="How TaaSFlow scores talent"
          title={`Scoring priorities for ${entry.name}`}
          intro="Every point of the score maps to an evidence quote from the CV. Dimensions, weights and critical requirements are shown alongside each candidate — the score supports judgment, it doesn't replace it."
        />
        <div className="mt-8">
          <IndustrySignalExplorer entry={entry} />
        </div>
        <p className="mt-6 max-w-[65ch] text-sm text-[color:var(--brand-navy)]/80">
          See the full methodology on{" "}
          <Link
            to="/how-it-works"
            hash="scoring"
            className="font-semibold underline underline-offset-4"
          >
            how scoring works
          </Link>
          .
        </p>
      </PublicPage>
    </PublicSection>
  );
}

/**
 * Proof section — Prompt 10 will replace this body with an approved-proof
 * router (verified / anonymized case / methodology fallback). Today it
 * shows the example-data shortlist card when the archetype opts in, and a
 * clearly-labelled "what you receive" methodology block otherwise.
 */
function SectionProof({ ctx }: { ctx: Ctx }) {
  if (ctx.config.spec.showDeliveryPreview) {
    return <SectionDeliveryPreview ctx={ctx} />;
  }
  const { entry } = ctx;
  const items = [
    { title: "Weekly ranked shortlist", body: `A partner-reviewed shortlist of ${entry.name} candidates with evidence quotes and requirement coverage — delivered on a weekly cadence.` },
    { title: "Evidence, not adjectives", body: "Every scored dimension links back to a line from the CV. No hidden precision, no invented numbers." },
    { title: "Structured comparison", body: "Candidates are shown side-by-side with the same rubric, so you can compare like-for-like and defend the decision." },
  ];
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-white py-14">
      <span id="proof" className="sr-only" aria-hidden />
      <PublicPage>
        <SectionHeading
          eyebrow="What you receive"
          title={`Proof of what a ${entry.name} search delivers`}
          intro="No fabricated logos, no unverified success rates. Here is the actual deliverable and the methodology behind it."
        />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 p-6"
            >
              <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold text-[color:var(--brand-navy)]">
                {it.title}
              </h3>
              <p className="mt-3 max-w-[52ch] text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                {it.body}
              </p>
            </div>
          ))}
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
        <SectionHeading eyebrow="Craft" title="Skills, tools and certifications" />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {groups.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
            >
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
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
              eyebrow="Product demonstration"
              title={`What a ${entry.name} shortlist looks like`}
              intro="Ranked candidates with a fit score, requirement coverage, evidence quotes, strengths and validation areas. Reviewed by a partner before it reaches you."
            />
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-navy)]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Example data — not a live candidate
            </p>
          </div>
          <div
            className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 shadow-sm"
            aria-label="Example shortlist card"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              {entry.name} shortlist · Example
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">
              Candidate #EXAMPLE · Alex R.
            </p>
            <p className="mt-0.5 text-xs text-[color:var(--brand-navy)]/80">
              Applying as: {primaryRole}
            </p>
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
              <RequirementBar label="Role fit" pct={92} />
              <RequirementBar label="Scope & scale" pct={88} />
              <RequirementBar label="Delivery evidence" pct={85} />
              <RequirementBar label="Communication" pct={80} />
            </div>
            <div className="mt-4 rounded-lg bg-[color:var(--brand-mist)]/60 p-3 text-xs text-[color:var(--brand-navy)]/80">
              <p className="font-semibold text-[color:var(--brand-navy)]">
                Recommended: shortlist
              </p>
              <p className="mt-1 line-clamp-3">“{evidenceLine}”</p>
              <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                Example data — no production candidate.
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
  const { entry, config } = ctx;
  const steps = [
    { n: "01", title: "Submit the role", body: `A guided intake captures everything the ${entry.name} search needs, in one flow.` },
    { n: "02", title: "Agents source and score", body: "Sourcing agents across talent signals, role-specific rubric, evidence extracted from every CV." },
    { n: "03", title: "Review in your workspace", body: "Ranked shortlist, evidence side-by-side, Kanban pipeline, direct messaging." },
  ];
  const style = config.spec.processStyle;
  return (
    <PublicSection className="py-12">
      <span id="process" className="sr-only" aria-hidden />
      <PublicPage>
        <SectionHeading eyebrow="Process" title={`The ${entry.name} hiring process`} />
        {style === "numbered-cards" ? (
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                  {s.n}
                </p>
                <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{s.body}</p>
              </div>
            ))}
          </div>
        ) : style === "stepped-timeline" ? (
          <ol className="mt-8 space-y-6 border-l-2 border-[color:var(--brand-navy)]/10 pl-6">
            {steps.map((s) => (
              <li key={s.n} className="relative">
                <span className="absolute -left-[33px] top-0 grid h-6 w-6 place-items-center rounded-full bg-[color:var(--brand-navy)] text-[10px] font-semibold text-white">
                  {s.n}
                </span>
                <h3 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold">
                  {s.title}
                </h3>
                <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">{s.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-8 divide-y divide-[color:var(--brand-navy)]/10 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
            {steps.map((s) => (
              <div key={s.n} className="grid grid-cols-[80px_1fr] gap-6 p-5 sm:grid-cols-[80px_1fr_2fr]">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/80">
                  {s.n}
                </span>
                <span className="font-semibold text-[color:var(--brand-navy)]">{s.title}</span>
                <span className="col-span-2 text-sm text-[color:var(--brand-navy)]/80 sm:col-span-1">
                  {s.body}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm text-[color:var(--brand-navy)]/80">
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
        <p className="max-w-3xl text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
          Hiring in{" "}
          <span className="font-semibold text-[color:var(--brand-navy)]">{entry.name}</span>? See how{" "}
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
      </PublicPage>
    </PublicSection>
  );
}

function SectionRelated({ ctx }: { ctx: Ctx }) {
  const { relationships } = ctx;
  const items = relationships.related ?? [];
  if (!items.length) return null;
  return (
    <PublicSection className="border-t border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 py-14">
      <PublicPage>
        <div className="flex items-end justify-between gap-4">
          <SectionHeading eyebrow="Adjacent hiring" title="Related industries" />
          <Link
            to="/industries"
            className="hidden text-sm font-semibold text-[color:var(--brand-ocean-text)] underline-offset-4 hover:underline sm:inline-flex"
          >
            See all industries →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {items.map((r) => (
            <Link
              key={r.slug}
              to="/industries/$slug"
              params={{ slug: toPublicSlug(r.slug) }}
              className="group rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-ocean)]/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
            >
              <h3 className="text-lg font-semibold text-[color:var(--brand-navy)] group-hover:text-[color:var(--brand-ocean-text)]">
                {r.name}
              </h3>
              {r.blurb ? (
                <p className="mt-2 line-clamp-3 text-sm text-[color:var(--brand-navy)]/80">
                  {r.blurb}
                </p>
              ) : null}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean-text)]">
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
        <SectionHeading eyebrow="Common questions" title={`${entry.name} hiring FAQ`} />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {entry.faqs.map((f) => (
            <div
              key={f.q}
              className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
            >
              <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
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
