import { createFileRoute, Link } from "@tanstack/react-router";
import { publishableMetrics } from "@/config/case-study-metrics";
import {
  Hotel,
  Landmark,
  HeartPulse,
  Cpu,
  ShoppingBag,
  Factory,
  Globe2,
  MapPin,
  TrendingUp,
  Users,
  Clock,
  Sparkles,
  ArrowUpRight,
  Quote,
  CheckCircle2,
  Target,
  Search,
  ListChecks,
  Handshake,
  ShieldCheck,
} from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";
import { PageConnections } from "@/components/marketing/page-connections";
import { LifecyclePreview } from "@/components/marketing/product-preview/lifecycle-preview";
import { CASE_STUDIES, EXAMPLE_ENGAGEMENT_LABEL, type CaseStudy } from "@/content/case-studies";
import { CTA_PRIMARY, CTA_BOOK, CTA_HOW_IT_WORKS } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING, PROCESS_STEPS, PROCESS_STEP_COUNT, TIMING_FINE_PRINT, WHO_RUNS_THE_SEARCH } from "@/config/offer-facts";

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

// --- Patterns -----------------------------------------------------------------

const HotelPattern = (
  <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.18]" viewBox="0 0 400 240" preserveAspectRatio="none">
    <defs>
      <pattern id="hotel-windows" x="0" y="0" width="28" height="34" patternUnits="userSpaceOnUse">
        <rect x="6" y="8" width="16" height="20" rx="1.5" fill="currentColor" opacity="0.7" />
      </pattern>
    </defs>
    <rect width="400" height="240" fill="url(#hotel-windows)" />
  </svg>
);

const FinancePattern = (
  <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.22]" viewBox="0 0 400 240" preserveAspectRatio="none">
    <polyline points="0,180 40,160 80,170 120,120 160,140 200,90 240,110 280,70 320,85 360,40 400,55" fill="none" stroke="currentColor" strokeWidth="2" />
    {Array.from({ length: 12 }).map((_, i) => (
      <rect key={i} x={i * 34 + 6} y={200 - (i % 4) * 12 - 8} width="14" height={(i % 4) * 12 + 8} fill="currentColor" opacity="0.35" />
    ))}
  </svg>
);

const HealthPattern = (
  <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.20]" viewBox="0 0 400 240" preserveAspectRatio="none">
    <path d="M0,140 L60,140 L75,110 L95,170 L115,90 L135,180 L155,130 L400,130" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M0,80 L400,80" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.6" />
    <path d="M0,200 L400,200" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.6" />
  </svg>
);

const TechPattern = (
  <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.20]" viewBox="0 0 400 240" preserveAspectRatio="none">
    {Array.from({ length: 8 }).map((_, r) =>
      Array.from({ length: 14 }).map((_, c) => (
        <circle key={`${r}-${c}`} cx={c * 30 + 15} cy={r * 30 + 15} r={((r + c) % 3) + 1} fill="currentColor" opacity={0.4} />
      ))
    )}
    <path d="M0,120 Q100,60 200,120 T400,120" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
  </svg>
);

const RetailPattern = (
  <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.20]" viewBox="0 0 400 240" preserveAspectRatio="none">
    <defs>
      <pattern id="retail-bags" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect x="10" y="14" width="20" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M14 14 Q14 8 20 8 Q26 8 26 14" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </pattern>
    </defs>
    <rect width="400" height="240" fill="url(#retail-bags)" />
  </svg>
);

const IndustrialPattern = (
  <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.20]" viewBox="0 0 400 240" preserveAspectRatio="none">
    {Array.from({ length: 6 }).map((_, i) => (
      <g key={i} transform={`translate(${i * 70 + 30},${120})`}>
        <circle r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle r="6" fill="currentColor" opacity="0.6" />
        {Array.from({ length: 8 }).map((_, j) => (
          <rect key={j} x="-2" y="-24" width="4" height="8" fill="currentColor" transform={`rotate(${j * 45})`} />
        ))}
      </g>
    ))}
  </svg>
);

type VisualMeta = {
  icon: typeof Hotel;
  gradient: string;
  accent: string;
  pattern: React.ReactNode;
};

// Visual treatment per engagement, keyed by slug. Text/data content lives in
// the shared @/content/case-studies module (single source of truth used by
// both this page and the CaseStudyPreviews component).
const VISUALS: Record<string, VisualMeta> = {
  "hospitality-luxury-group": {
    icon: Hotel,
    gradient: "from-[color:var(--sector-hospitality-1)] via-[color:var(--sector-hospitality-2)] to-[color:var(--sector-hospitality-3)]",
    accent: "text-[color:var(--sector-hospitality-accent)]",
    pattern: HotelPattern,
  },
  "finance-mid-market-pe": {
    icon: Landmark,
    gradient: "from-[color:var(--sector-finance-1)] via-[color:var(--sector-finance-2)] to-[color:var(--sector-finance-3)]",
    accent: "text-[color:var(--sector-finance-accent)]",
    pattern: FinancePattern,
  },
  "healthcare-clinical-network": {
    icon: HeartPulse,
    gradient: "from-[color:var(--sector-health-1)] via-[color:var(--sector-health-2)] to-[color:var(--sector-health-3)]",
    accent: "text-[color:var(--sector-health-accent)]",
    pattern: HealthPattern,
  },
  "tech-series-c-platform": {
    icon: Cpu,
    gradient: "from-[color:var(--sector-tech-1)] via-[color:var(--sector-tech-2)] to-[color:var(--sector-tech-3)]",
    accent: "text-[color:var(--sector-tech-accent)]",
    pattern: TechPattern,
  },
  "consumer-dtc-scaleup": {
    icon: ShoppingBag,
    gradient: "from-[color:var(--sector-consumer-1)] via-[color:var(--sector-consumer-2)] to-[color:var(--sector-consumer-3)]",
    accent: "text-[color:var(--sector-consumer-accent)]",
    pattern: RetailPattern,
  },
  "industrial-energy-transition": {
    icon: Factory,
    gradient: "from-[color:var(--sector-industrial-1)] via-[color:var(--sector-industrial-2)] to-[color:var(--sector-industrial-3)]",
    accent: "text-[color:var(--sector-industrial-accent)]",
    pattern: IndustrialPattern,
  },
};

type Study = CaseStudy & VisualMeta;

const STUDIES: Study[] = CASE_STUDIES.map((study) => ({
  ...study,
  ...VISUALS[study.slug],
}));

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

function ProcessStrip() {
  const icons = [Target, Search, ListChecks, Handshake];
  const steps = PROCESS_STEPS.map((step, i) => ({ icon: icons[i] ?? Target, label: step.title, sub: step.body }));
  return (
    <div className="mt-8 rounded-2xl border border-border/60 bg-background p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
        Every engagement runs the same {PROCESS_STEP_COUNT} steps
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[color:var(--brand-ocean-text)]">
              <s.icon className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
                Step {i + 1}
              </p>
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-[color:var(--brand-navy)]/80">{s.sub}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StudyCard({ study }: { study: Study }) {
  const Icon = study.icon;
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-xl">
      {/* Visual header */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${study.gradient} p-8 text-[color:var(--brand-on-dark)]`}>
        <div className={study.accent}>{study.pattern}</div>
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--brand-on-dark)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {study.industry}
              </div>
              {study.representative !== false && (
                <span className="inline-flex items-center rounded-full border border-[color:var(--brand-on-dark)]/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-[color:var(--brand-on-dark)]/90">
                  {EXAMPLE_ENGAGEMENT_LABEL}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs font-medium text-[color:var(--brand-on-dark)]/90">{study.companyType}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--brand-on-dark)]/80">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {study.region}
            </p>
          </div>
          <ArrowUpRight className="h-6 w-6 text-[color:var(--brand-on-dark)]/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
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

      {/* Situation + roles needed */}
      <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">Example situation</p>
          <p className="mt-2 text-sm leading-relaxed">{study.situation}</p>
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

      {/* Timeline to first shortlist */}
      <div className="border-t border-border/60 bg-muted/10 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
          How the engagement runs (first shortlist: {study.timeToFirstShortlist})
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

      {/* Outcome + testimonial (only rendered when a real, approved quote exists) */}
      <div className="grid gap-6 border-t border-border/60 bg-muted/20 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
            What this example shows
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--brand-navy)]">{study.outcomeHighlight}</p>
          <p className="mt-2 text-sm leading-relaxed">{study.outcome}</p>
        </div>
        {study.testimonial ? (
          <figure className="rounded-2xl border border-border/60 bg-background p-5">
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
        ) : (
          <figure className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-5">
            <Quote className="h-5 w-5 text-[color:var(--brand-navy)]/40" aria-hidden />
            <figcaption className="mt-2 text-xs leading-relaxed text-[color:var(--brand-navy)]/70">
              No quote is published for an example engagement. We publish a
              testimonial only when a client has written it and approved it for
              attribution.
            </figcaption>
          </figure>
        )}
      </div>

    </article>
  );
}

function MetricDefinitions() {
  return (
    <section className="mt-16 rounded-2xl border border-border/60 bg-background p-6 md:p-8" aria-labelledby="metric-definitions">
      <h2 id="metric-definitions" className="font-display text-2xl font-semibold tracking-tight">
        How we define metrics
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
        Hiring metrics are easy to mix up, so these are the definitions we use. When a figure is published on
        this site, it states where it comes from.
      </p>
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
    </section>
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
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Case studies
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            What an engagement looks like
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[color:var(--brand-navy)]/80">
            Six example engagements across hospitality, finance, healthcare, technology, consumer and
            industrial hiring. They show how a search runs from brief to shortlist.
          </p>
          <p className="mt-4 max-w-2xl text-sm text-[color:var(--brand-navy)]/80">
            These are examples built from representative data. They are not reported client results, and
            we publish no client name or testimonial without written approval.
          </p>
        </header>

        <HeroMetrics />
        <ProcessStrip />

        {/* Studies */}
        <div className="mt-16 space-y-10">
          {STUDIES.map((s) => (
            <StudyCard key={s.slug} study={s} />
          ))}
        </div>

        <MetricDefinitions />

        <ProgressionPreview />

        {/* CTA */}
        <section className="mt-12 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-12">
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
            <Link to={CTA_BOOK.to} className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted">
              {CTA_BOOK.label}
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
