import { createFileRoute, Link } from "@tanstack/react-router";
import { publishableMetrics } from "@/config/case-study-metrics";
import { Globe2, MapPin, TrendingUp, Users, Clock, Sparkles, Quote, Handshake, ShieldCheck } from "lucide-react";
import { HeroPicture } from "@/components/marketing/hero-picture";
import { getIndustryHeroImage } from "@/content/industry-hero-images";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PageConnections } from "@/components/marketing/page-connections";
import { LifecyclePreview } from "@/components/marketing/product-preview/lifecycle-preview";
import { CASE_STUDIES, EXAMPLE_ENGAGEMENT_LABEL, type CaseStudy } from "@/content/case-studies";
import { CTA_PRIMARY, CTA_MESSAGE, CTA_HOW_IT_WORKS } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING, TIMING_FINE_PRINT, WHO_RUNS_THE_SEARCH } from "@/config/offer-facts";

const entry = getPage("case-studies");

export const Route = createFileRoute("/case-studies")({
  head: () =>
    marketingHead(entry, "/case-studies", {
      title: "Example Engagements | TaaSFlow",
      description:
        "Examples of how a TaaSFlow engagement runs, using representative example data. Not reported client results.",
    }),
  component: CaseStudiesPage,
});

// -----------------------------------------------------------------------------
// Example engagements. Representative data, not client results. Named studies
// with written client approval are added individually.
// -----------------------------------------------------------------------------

const STUDY_INDUSTRIES: Record<string, string> = {
  "hospitality-luxury-group": "hospitality",
  "finance-mid-market-pe": "finance",
  "healthcare-clinical-network": "healthcare",
  "tech-series-c-platform": "tech",
  "consumer-dtc-scaleup": "retail",
  "industrial-energy-transition": "energy",
};
type Study = CaseStudy;
const STUDIES = CASE_STUDIES;

// --- Sections -----------------------------------------------------------------

const METRIC_ICONS = {
  users: Users,
  globe: Globe2,
  clock: Clock,
  trending: TrendingUp,
  shield: ShieldCheck,
  handshake: Handshake,
} as const;

/**
 * Every figure carries its source, or it is not published.
 *
 * These six numbers went out with one page-level hedge and no source against
 * any of them, on a domain whose Trust Center opens "stated only where we can
 * prove it" (audit 1 Sep, F23). Provenance is a required field on the config
 * now, and `publishableMetrics` withholds anything unattributed — so a number
 * cannot reach this page without saying where it came from.
 *
 * The strip disappears entirely while nothing is attributed. That is the
 * intended state: the page still has its engagements, verticals and narrative,
 * and gains the figures back one at a time as each source is written.
 */
function HeroMetrics() {
  const items = publishableMetrics();
  if (items.length === 0) return null;
  return (
    <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((m) => {
        const Icon = METRIC_ICONS[m.iconKey];
        return (
          <div key={m.label} className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
            <Icon className="h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden />
            <dt className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
              {m.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {m.value}
            </dd>
            <p className="mt-1.5 text-[10px] leading-snug text-[color:var(--brand-navy)]/65">
              {m.provenance}
            </p>
          </div>
        );
      })}
    </dl>
  );
}

function StudyCard({ study }: { study: Study }) {
  const photo = getIndustryHeroImage(STUDY_INDUSTRIES[study.slug] ?? "tech");
  return (
    <article id={study.slug} className="group relative scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card">
      {/* Visual header */}
      {photo ? <HeroPicture src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} className="aspect-[16/7] w-full object-cover" /> : null}
      <div className="relative p-6 text-[color:var(--ink)] sm:p-8">
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
                {study.industry}
              </div>
              {study.representative !== false && (
                <span className="inline-flex items-center rounded-full border border-[color:var(--ink)]/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-[color:var(--ink)]/90">
                  {EXAMPLE_ENGAGEMENT_LABEL}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs font-medium text-[color:var(--ink)]/90">{study.companyType}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--ink)]/80">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {study.region}
            </p>
          </div>

        </div>
        <h3 className="relative mt-8 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {study.headline}
        </h3>
      </div>

      {/* Scope of the example brief */}
      <div className="grid grid-cols-2 divide-x divide-border/60 border-b border-border/60 bg-background">
        {study.qualitySignal.map((m) => (
          <div key={m.label} className="p-5 text-center">
            <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{m.value}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">{m.label}</p>
            {m.sub && <p className="mt-0.5 text-[11px] text-[color:var(--brand-navy)]/80">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Key takeaway + roles needed */}
      <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
        <div className="border-l-4 border-primary pl-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">The takeaway</p>
          <p className="mt-2 font-display text-xl font-semibold leading-snug text-[color:var(--brand-navy)] sm:text-2xl">{study.outcomeHighlight}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">Roles needed</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {study.rolesNeeded.map((r) => (
              <li key={r} className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Timeline: always visible as a compact visual strip */}
      <div className="border-t border-border/60 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
          First shortlist: {study.timeToFirstShortlist}
        </p>
        <ol className="relative mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {study.timeline.map((t, i) => (
            <li key={i} className="relative">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-[color:var(--brand-ocean-text)]">
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">{t.day}</span>
              </div>
              <p className="mt-1.5 text-sm font-medium">{t.label}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Full story on demand; testimonial only when a real, approved quote exists */}
      <details className="border-t border-border/60 bg-muted/20 p-6 md:p-8">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold text-[color:var(--ink)]">
          Read the full example
        </summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">Situation</p>
            <p className="mt-2 text-sm leading-relaxed">{study.situation}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">What it shows</p>
            <p className="mt-2 text-sm leading-relaxed">{study.outcome}</p>
          </div>
        </div>
        {study.testimonial ? (
          <figure className="mt-5 rounded-2xl border border-border/60 bg-background p-5">
            <Quote className="h-5 w-5 text-[color:var(--brand-ocean-text)]" aria-hidden />
            <blockquote className="mt-2 text-sm italic leading-relaxed">
              "{study.testimonial.quote}"
            </blockquote>
            <figcaption className="mt-3 text-xs text-[color:var(--brand-navy)]/80">
              <span className="font-semibold text-foreground">{study.testimonial.author}</span>
              <br />
              {study.testimonial.role}
            </figcaption>
          </figure>
        ) : null}
      </details>

    </article>
  );
}

function MetricDefinitions() {
  return (
    <details className="mt-16 rounded-2xl border border-border/60 bg-background p-6 md:p-8">
      <summary className="min-h-11 cursor-pointer">
        <h2 id="metric-definitions" className="inline font-display text-2xl font-semibold tracking-tight">
          How we define metrics
        </h2>
      </summary>
      <dl className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <dt className="text-sm font-semibold">Offer acceptance rate</dt>
          <dd className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
            Accepted offers divided by offers extended.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">Shortlist-to-hire rate</dt>
          <dd className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
            A different ratio: hires divided by shortlisted candidates. It measures shortlist quality, not
            the strength of an offer, and it should not be compared with offer acceptance.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">Time to first shortlist</dt>
          <dd className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
            Business days from an approved role brief to the first ranked shortlist. {FIRST_SHORTLIST_TIMING}
          </dd>
        </div>
      </dl>
    </details>
  );
}

function ProgressionPreview() {
  return (
    <section className="mt-16">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">In the workspace</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How a role progresses.
        </h2>
        <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{WHO_RUNS_THE_SEARCH}</p>
      </div>
      <div className="mt-8 max-w-2xl">
        <LifecyclePreview />
      </div>
    </section>
  );
}

function CaseStudiesPage() {
  return (
    <SiteShell hideClosingBand>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Case studies
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            What an engagement looks like
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            Six industries. One path from brief to shortlist.
          </p>
          <p className="mt-3 max-w-2xl text-xs text-[color:var(--brand-navy)]/70">
            Representative examples. They are not reported client results.
          </p>
        </header>

        <HeroMetrics />
        <nav aria-label="Example industries" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-y border-[color:var(--rule)] py-4">
          {STUDIES.map((study) => <a key={study.slug} href={`#${study.slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--blue-600)] underline underline-offset-4">{study.industry}</a>)}
        </nav>

        {/* Studies */}
        <div className="mt-16 space-y-10">
          {STUDIES.map((s) => (
            <StudyCard key={s.slug} study={s} />
          ))}
        </div>

        <MetricDefinitions />

        <ProgressionPreview />

        {/* CTA */}
        <section className="mt-12 border-t border-border py-10">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            See how it would run for your role.
          </h2>
          <p className="mt-3 max-w-2xl text-[color:var(--brand-navy)]/80">
            {FIRST_SHORTLIST_TIMING} {TIMING_FINE_PRINT}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={CTA_PRIMARY.to} className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {CTA_PRIMARY.label}
            </Link>
            <Link to={CTA_MESSAGE.to} className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted">
              {CTA_MESSAGE.label}
            </Link>
            <Link to={CTA_HOW_IT_WORKS.to} className="rounded-md px-3 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)]/80 hover:text-[color:var(--brand-navy)]">
              {CTA_HOW_IT_WORKS.label}
            </Link>
          </div>
        </section>
      </section>
          <PageConnections
        commercial={{ to: "/pricing", label: "See pricing", desc: "The pilot and the package totals." }}
        explainer={{ to: "/how-it-works", label: "How it works", desc: "The four steps behind every engagement." }}
        resource={{ to: "/blog", label: "More on the blog", desc: "Deep dives on hiring economics and evaluation." }}
        audience={{ to: "/industries", label: "By industry", desc: "How TaaSFlow supports each sector." }}
      />
    </SiteShell>
  );
}
