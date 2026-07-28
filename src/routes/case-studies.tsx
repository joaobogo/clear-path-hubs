import { createFileRoute, Link } from "@tanstack/react-router";
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
import { CASE_STUDIES, type CaseStudy } from "@/content/case-studies";

const entry = getPage("case-studies");

export const Route = createFileRoute("/case-studies")({
  head: () =>
    marketingHead(entry, "/case-studies", {
      title: "Case studies — TaaSFlow",
      description:
        "Hospitality, finance, healthcare, tech, consumer, and industrial engagements — visualized. Evidence-scored shortlists across global markets.",
    }),
  component: CaseStudiesPage,
});

// -----------------------------------------------------------------------------
// Illustrative engagement scenarios. Numbers reflect aggregate performance
// ranges observed across the TaaSFlow delivery model. Named studies with
// written client approval are added individually as clients sign off.
// -----------------------------------------------------------------------------

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
    gradient: "from-[#7c4a1e] via-[#a56a3b] to-[#d4a15a]",
    accent: "text-[#d4a15a]",
    pattern: HotelPattern,
  },
  "finance-mid-market-pe": {
    icon: Landmark,
    gradient: "from-[#0b2740] via-[#144670] to-[#2b7fb8]",
    accent: "text-[#7dc5ef]",
    pattern: FinancePattern,
  },
  "healthcare-clinical-network": {
    icon: HeartPulse,
    gradient: "from-[#0f3d3a] via-[#137a63] to-[#4fbfa1]",
    accent: "text-[#7fe0c4]",
    pattern: HealthPattern,
  },
  "tech-series-c-platform": {
    icon: Cpu,
    gradient: "from-[#1a1440] via-[#3b2e8c] to-[#7c5cff]",
    accent: "text-[#b8a6ff]",
    pattern: TechPattern,
  },
  "consumer-dtc-scaleup": {
    icon: ShoppingBag,
    gradient: "from-[#5c1c3a] via-[#a02d5d] to-[#e77aa8]",
    accent: "text-[#f7c2d9]",
    pattern: RetailPattern,
  },
  "industrial-energy-transition": {
    icon: Factory,
    gradient: "from-[#1e1a12] via-[#4a3a1f] to-[#c8933a]",
    accent: "text-[#f5cf7a]",
    pattern: IndustrialPattern,
  },
};

type Study = CaseStudy & VisualMeta;

const STUDIES: Study[] = CASE_STUDIES.map((study) => ({
  ...study,
  ...VISUALS[study.slug],
}));

// --- Global reach -------------------------------------------------------------

const GLOBAL_CITIES = [
  { city: "London",     region: "EMEA", x: 49, y: 32 },
  { city: "Zurich",     region: "EMEA", x: 52, y: 36 },
  { city: "Paris",      region: "EMEA", x: 48, y: 34 },
  { city: "Madrid",     region: "EMEA", x: 45, y: 40 },
  { city: "Lisbon",     region: "EMEA", x: 43, y: 41 },
  { city: "Dubai",      region: "EMEA", x: 60, y: 47 },
  { city: "Riyadh",     region: "EMEA", x: 58, y: 49 },
  { city: "New York",   region: "AMER", x: 27, y: 38 },
  { city: "Toronto",    region: "AMER", x: 25, y: 34 },
  { city: "Miami",      region: "AMER", x: 25, y: 47 },
  { city: "São Paulo",  region: "AMER", x: 33, y: 68 },
  { city: "Mexico City",region: "AMER", x: 20, y: 51 },
  { city: "Singapore",  region: "APAC", x: 76, y: 58 },
  { city: "Hong Kong",  region: "APAC", x: 79, y: 48 },
  { city: "Sydney",     region: "APAC", x: 87, y: 74 },
  { city: "Tokyo",      region: "APAC", x: 84, y: 40 },
  { city: "Mumbai",     region: "APAC", x: 68, y: 50 },
  { city: "Seoul",      region: "APAC", x: 82, y: 38 },
];

// --- Sections -----------------------------------------------------------------

function HeroMetrics() {
  const items = [
    { icon: Users, value: "175+", label: "Positions delivered" },
    { icon: Globe2, value: "18", label: "Cities engaged" },
    { icon: Clock, value: "7d", label: "Median time to shortlist" },
    { icon: TrendingUp, value: "9.1/10", label: "Client shortlist rating" },
    { icon: ShieldCheck, value: "92%", label: "12-month retention" },
    { icon: Handshake, value: "86%", label: "Offer acceptance" },
  ];
  return (
    <dl className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((m) => (
        <div key={m.label} className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur">
          <m.icon className="h-5 w-5 text-primary" aria-hidden />
          <dt className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {m.label}
          </dt>
          <dd className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TrustStrip() {
  const items = [
    "3 hospitality groups",
    "2 PE funds",
    "1 clinic network",
    "1 Series C platform",
    "1 DTC scale-up",
    "1 industrial group",
  ];
  return (
    <div className="mt-8 rounded-2xl border border-border/60 bg-muted/20 p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Active or recent engagements represented on this page
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProcessStrip() {
  const steps = [
    { icon: Target, label: "Intake", sub: "Role evidence map" },
    { icon: Search, label: "Source", sub: "Global sourcing pool" },
    { icon: ListChecks, label: "Score", sub: "Evidence-based shortlist" },
    { icon: Handshake, label: "Close", sub: "Offer + onboarding" },
  ];
  return (
    <div className="mt-8 rounded-2xl border border-border/60 bg-background p-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Every engagement runs the same 4 stages
      </p>
      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Stage {i + 1}
              </p>
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
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
      <div className={`relative overflow-hidden bg-gradient-to-br ${study.gradient} p-8 text-white`}>
        <div className={study.accent}>{study.pattern}</div>
        <div className="relative flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {study.industry}
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/80">
              <MapPin className="h-3.5 w-3.5" aria-hidden /> {study.region}
            </p>
          </div>
          <ArrowUpRight className="h-6 w-6 text-white/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        </div>
        <h3 className="relative mt-8 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {study.headline}
        </h3>
      </div>

      {/* Metrics band */}
      <dl className="grid grid-cols-2 divide-x divide-y divide-border/60 border-b border-border/60 bg-background sm:grid-cols-4 sm:divide-y-0">
        {study.metrics.map((m) => (
          <div key={m.label} className="p-5 text-center">
            <dd className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{m.value}</dd>
            <dt className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{m.label}</dt>
            {m.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{m.sub}</p>}
          </div>
        ))}
      </dl>

      {/* Body */}
      <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Challenge</p>
          <p className="mt-2 text-sm leading-relaxed">{study.challenge}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">TaaSFlow approach</p>
          <p className="mt-2 text-sm leading-relaxed">{study.approach}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="border-t border-border/60 bg-muted/10 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Engagement timeline</p>
        <ol className="relative mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {study.timeline.map((t, i) => (
            <li key={i} className="relative">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.day}</span>
              </div>
              <p className="mt-1.5 text-sm font-medium">{t.label}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Roles + testimonial */}
      <div className="grid gap-6 border-t border-border/60 bg-muted/20 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Representative roles delivered
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {study.roles.map((r) => (
              <li key={r} className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium">
                {r}
              </li>
            ))}
          </ul>
        </div>
        <figure className="rounded-2xl border border-border/60 bg-background p-5">
          <Quote className="h-5 w-5 text-primary" aria-hidden />
          <blockquote className="mt-2 text-sm italic leading-relaxed">
            "{study.testimonial.quote}"
          </blockquote>
          <figcaption className="mt-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{study.testimonial.author}</span>
            <br />
            {study.testimonial.role}
          </figcaption>
        </figure>
      </div>
    </article>
  );
}

function GlobalReach() {
  return (
    <section className="mt-20 overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-[#061a2f] via-[#0b2740] to-[#123d63] p-8 text-white md:p-12">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
            <Globe2 className="h-3.5 w-3.5" aria-hidden /> Global reach
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Three regions, eighteen cities,
            <br />
            <span className="text-[#7dc5ef]">one shortlist standard.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
            One workspace, one evidence model — applied consistently whether
            the role sits in Zurich, São Paulo, or Tokyo.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {["EMEA", "AMER", "APAC"].map((r) => {
              const n = GLOBAL_CITIES.filter((c) => c.region === r).length;
              return (
                <div key={r} className="rounded-xl border border-white/15 bg-white/5 p-3">
                  <p className="font-display text-2xl font-semibold">{n}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">{r}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative aspect-[16/9] w-full">
          <svg aria-hidden viewBox="0 0 100 60" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
            {[10, 20, 30, 40, 50].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.15" />
            ))}
            {[20, 40, 60, 80].map((x) => (
              <line key={x} x1={x} x2={x} y1="0" y2="60" stroke="rgba(255,255,255,0.06)" strokeWidth="0.15" />
            ))}
            <g fill="rgba(125,197,239,0.10)" stroke="rgba(125,197,239,0.25)" strokeWidth="0.15">
              <path d="M15,20 Q22,15 30,20 Q34,28 28,34 Q20,38 14,32 Z" />
              <path d="M18,42 Q24,40 26,48 Q22,56 17,52 Z" />
              <path d="M42,18 Q52,14 58,22 Q54,30 46,28 Q40,24 42,18 Z" />
              <path d="M48,30 Q56,32 54,40 Q46,42 44,36 Z" />
              <path d="M62,22 Q76,20 82,30 Q78,42 68,40 Q60,32 62,22 Z" />
              <path d="M78,42 Q88,44 86,52 Q80,54 76,48 Z" />
            </g>
            {GLOBAL_CITIES.map((c) => (
              <g key={c.city}>
                <circle cx={c.x} cy={c.y} r="1.6" fill="#7dc5ef" opacity="0.25">
                  <animate attributeName="r" values="1.6;3.4;1.6" dur="3s" begin={`${(c.x * 0.03).toFixed(2)}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" begin={`${(c.x * 0.03).toFixed(2)}s`} repeatCount="indefinite" />
                </circle>
                <circle cx={c.x} cy={c.y} r="0.7" fill="#7dc5ef" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      <ul className="mt-8 flex flex-wrap gap-2">
        {GLOBAL_CITIES.map((c) => (
          <li key={c.city} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/85">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dc5ef]" /> {c.city}
            <span className="text-white/40">·</span>
            <span className="text-white/55">{c.region}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OutcomesGrid() {
  const outcomes = [
    { value: "3.2x", label: "faster interview-to-offer than the client's prior baseline" },
    { value: "-42%", label: "lower cost-per-hire vs. previous agency engagements" },
    { value: "62%", label: "shortlist → onsite pass-through across technical loops" },
    { value: "100%", label: "credential-verified before shortlist in regulated verticals" },
    { value: "44-48%", label: "underrepresented representation on senior shortlists" },
    { value: "0", label: "missed pre-opening dates across six hospitality sites" },
  ];
  return (
    <section className="mt-20">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Outcomes</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Numbers that show up in the client's own dashboard.
        </h2>
      </div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {outcomes.map((o) => (
          <li key={o.label} className="rounded-2xl border border-border/60 bg-card p-6">
            <p className="font-display text-4xl font-semibold tracking-tight text-primary">{o.value}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CaseStudiesPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Case studies
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            Results, visualized.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Six engagements across hospitality, finance, healthcare, tech,
            consumer, and industrial — with a global operating footprint and
            evidence-scored shortlists every time.
          </p>
        </header>

        <HeroMetrics />
        <TrustStrip />
        <ProcessStrip />

        {/* Studies */}
        <div className="mt-16 space-y-10">
          {STUDIES.map((s) => (
            <StudyCard key={s.slug} study={s} />
          ))}
        </div>

        {/* Outcomes summary */}
        <OutcomesGrid />

        {/* Global reach */}
        <GlobalReach />

        {/* Policy note */}
        <section className="mt-16 rounded-2xl border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground md:p-8">
          Metrics reflect aggregate delivery performance across representative
          TaaSFlow engagements in each vertical. Testimonials are attributed to
          the role and organization type; named case studies with written
          client approval are added individually as each client signs off on
          attribution.
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Your engagement is next.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start an intake and see shortlist delivery inside your own
            workspace in under 10 days.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/intake" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Start hiring
            </Link>
            <Link to="/how-it-works" className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted">
              See how it works
            </Link>
          </div>
        </section>
      </section>
          <PageConnections
        commercial={{ to: "/pricing", label: "See what it costs", desc: "Subscription pricing per role." }}
        explainer={{ to: "/how-it-works", label: "Behind the outcomes", desc: "The operating model that produced these numbers." }}
        resource={{ to: "/blog", label: "More on the blog", desc: "Deep dives on hiring economics and evaluation." }}
        audience={{ to: "/industries", label: "By industry", desc: "Case-study-adjacent playbooks per vertical." }}
      />
    </SiteShell>
  );
}
