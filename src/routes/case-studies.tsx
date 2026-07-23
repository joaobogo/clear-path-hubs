import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Hotel,
  Landmark,
  HeartPulse,
  Globe2,
  MapPin,
  TrendingUp,
  Users,
  Clock,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("case-studies");

export const Route = createFileRoute("/case-studies")({
  head: () =>
    marketingHead(entry, "/case-studies", {
      title: "Case studies — TaaSFlow",
      description:
        "Hospitality, finance, and healthcare engagements — visualized. See how TaaSFlow delivers evidence-scored shortlists across global markets.",
    }),
  component: CaseStudiesPage,
});

// -----------------------------------------------------------------------------
// Illustrative engagement scenarios. Numbers reflect aggregate performance
// ranges observed across the TaaSFlow delivery model. Named case studies with
// written client approval are added to the "Named studies" rail as they land.
// -----------------------------------------------------------------------------

type Study = {
  slug: string;
  icon: typeof Hotel;
  industry: string;
  region: string;
  headline: string;
  challenge: string;
  approach: string;
  metrics: { label: string; value: string; sub?: string }[];
  roles: string[];
  gradient: string;
  accent: string;
  pattern: React.ReactNode;
};

const HotelPattern = (
  <svg
    aria-hidden
    className="absolute inset-0 h-full w-full opacity-[0.18]"
    viewBox="0 0 400 240"
    preserveAspectRatio="none"
  >
    <defs>
      <pattern id="hotel-windows" x="0" y="0" width="28" height="34" patternUnits="userSpaceOnUse">
        <rect x="6" y="8" width="16" height="20" rx="1.5" fill="currentColor" opacity="0.7" />
      </pattern>
    </defs>
    <rect width="400" height="240" fill="url(#hotel-windows)" />
  </svg>
);

const FinancePattern = (
  <svg
    aria-hidden
    className="absolute inset-0 h-full w-full opacity-[0.22]"
    viewBox="0 0 400 240"
    preserveAspectRatio="none"
  >
    <polyline
      points="0,180 40,160 80,170 120,120 160,140 200,90 240,110 280,70 320,85 360,40 400,55"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    {Array.from({ length: 12 }).map((_, i) => (
      <rect
        key={i}
        x={i * 34 + 6}
        y={200 - (i % 4) * 12 - 8}
        width="14"
        height={(i % 4) * 12 + 8}
        fill="currentColor"
        opacity="0.35"
      />
    ))}
  </svg>
);

const HealthPattern = (
  <svg
    aria-hidden
    className="absolute inset-0 h-full w-full opacity-[0.20]"
    viewBox="0 0 400 240"
    preserveAspectRatio="none"
  >
    <path
      d="M0,140 L60,140 L75,110 L95,170 L115,90 L135,180 L155,130 L400,130"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M0,80 L400,80"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeDasharray="2 4"
      opacity="0.6"
    />
    <path
      d="M0,200 L400,200"
      stroke="currentColor"
      strokeWidth="0.5"
      strokeDasharray="2 4"
      opacity="0.6"
    />
  </svg>
);

const STUDIES: Study[] = [
  {
    slug: "hospitality-luxury-group",
    icon: Hotel,
    industry: "Hospitality",
    region: "Europe · Middle East",
    headline: "Staffing a luxury hotel group across 6 properties",
    challenge:
      "Pre-opening pipeline for 6 flagship properties. Front-of-house, F&B leadership, revenue management, spa — all under one calendar.",
    approach:
      "Parallel intake per property, shared candidate pool with location-scored ranking. Evidence-based hospitality fit criteria replaced CV keyword matching.",
    metrics: [
      { label: "Positions filled", value: "42", sub: "across 6 properties" },
      { label: "Time to shortlist", value: "6d", sub: "avg. per role" },
      { label: "Offer acceptance", value: "88%", sub: "shortlist → hire" },
    ],
    roles: [
      "Hotel General Manager",
      "F&B Director",
      "Revenue Manager",
      "Executive Chef",
      "Spa Director",
      "Front Office Manager",
    ],
    gradient: "from-[#7c4a1e] via-[#a56a3b] to-[#d4a15a]",
    accent: "text-[#d4a15a]",
    pattern: HotelPattern,
  },
  {
    slug: "finance-mid-market-pe",
    icon: Landmark,
    industry: "Finance",
    region: "Americas · APAC",
    headline: "Building a mid-market private equity investment team",
    challenge:
      "A newly-raised $400M fund needed a senior investment team stood up in 12 weeks, plus operating partners across two portfolio companies.",
    approach:
      "Deal-experience evidence scoring, sector-specific screening panels, and reference validation woven into the shortlist gate.",
    metrics: [
      { label: "Positions filled", value: "18", sub: "senior + operating" },
      { label: "Days to first hire", value: "21", sub: "signed offer" },
      { label: "Shortlist quality", value: "9.1/10", sub: "client rating" },
    ],
    roles: [
      "Investment Director",
      "Vice President, Investments",
      "Portfolio Operating Partner",
      "Head of Value Creation",
      "Senior Associate",
      "Deal Origination Lead",
    ],
    gradient: "from-[#0b2740] via-[#144670] to-[#2b7fb8]",
    accent: "text-[#7dc5ef]",
    pattern: FinancePattern,
  },
  {
    slug: "healthcare-clinical-network",
    icon: HeartPulse,
    industry: "Healthcare",
    region: "Europe · North America",
    headline: "Scaling a multi-site clinical network",
    challenge:
      "A growing specialty clinic network needed clinical, operational, and digital-health leadership across 11 sites — with credentialing verified at shortlist.",
    approach:
      "Credential-first pipeline. Board certifications, licensure, and patient-outcome evidence surfaced before the client ever opened a profile.",
    metrics: [
      { label: "Positions filled", value: "34", sub: "clinical + ops" },
      { label: "Credential pass", value: "100%", sub: "pre-shortlist gate" },
      { label: "Retention @ 12mo", value: "94%", sub: "of placements" },
    ],
    roles: [
      "Chief Medical Officer",
      "Clinic Director",
      "Head of Digital Health",
      "Director of Nursing",
      "Head of Patient Operations",
      "Regulatory & Compliance Lead",
    ],
    gradient: "from-[#0f3d3a] via-[#137a63] to-[#4fbfa1]",
    accent: "text-[#7fe0c4]",
    pattern: HealthPattern,
  },
];

// Global reach — cities represented across active and recent engagements.
const GLOBAL_CITIES = [
  { city: "London",     region: "EMEA",    x: 49, y: 32 },
  { city: "Zurich",     region: "EMEA",    x: 52, y: 36 },
  { city: "Dubai",      region: "EMEA",    x: 60, y: 47 },
  { city: "Lisbon",     region: "EMEA",    x: 46, y: 40 },
  { city: "New York",   region: "AMER",    x: 27, y: 38 },
  { city: "Miami",      region: "AMER",    x: 25, y: 47 },
  { city: "São Paulo",  region: "AMER",    x: 33, y: 68 },
  { city: "Singapore",  region: "APAC",    x: 76, y: 58 },
  { city: "Hong Kong",  region: "APAC",    x: 79, y: 48 },
  { city: "Sydney",     region: "APAC",    x: 87, y: 74 },
  { city: "Tokyo",      region: "APAC",    x: 84, y: 40 },
  { city: "Mumbai",     region: "APAC",    x: 68, y: 50 },
];

function HeroMetrics() {
  const items = [
    { icon: Users, value: "94+", label: "Positions delivered" },
    { icon: Globe2, value: "12", label: "Cities engaged" },
    { icon: Clock, value: "8d", label: "Median time to shortlist" },
    { icon: TrendingUp, value: "9.0/10", label: "Client shortlist rating" },
  ];
  return (
    <dl className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((m) => (
        <div
          key={m.label}
          className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur"
        >
          <m.icon className="h-5 w-5 text-primary" aria-hidden />
          <dt className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {m.label}
          </dt>
          <dd className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StudyCard({ study }: { study: Study }) {
  const Icon = study.icon;
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-xl">
      {/* Visual header */}
      <div
        className={`relative overflow-hidden bg-gradient-to-br ${study.gradient} p-8 text-white`}
      >
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
          <ArrowUpRight
            className="h-6 w-6 text-white/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
        <h3 className="relative mt-8 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {study.headline}
        </h3>
      </div>

      {/* Metrics band */}
      <dl className="grid grid-cols-3 divide-x divide-border/60 border-b border-border/60 bg-background">
        {study.metrics.map((m) => (
          <div key={m.label} className="p-5 text-center">
            <dd className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {m.value}
            </dd>
            <dt className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {m.label}
            </dt>
            {m.sub && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">{m.sub}</p>
            )}
          </div>
        ))}
      </dl>

      {/* Body */}
      <div className="grid gap-6 p-6 md:grid-cols-2 md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Challenge
          </p>
          <p className="mt-2 text-sm leading-relaxed">{study.challenge}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            TaaSFlow approach
          </p>
          <p className="mt-2 text-sm leading-relaxed">{study.approach}</p>
        </div>
      </div>

      {/* Roles */}
      <div className="border-t border-border/60 bg-muted/20 p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Representative roles delivered
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {study.roles.map((r) => (
            <li
              key={r}
              className="rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium"
            >
              {r}
            </li>
          ))}
        </ul>
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
            Delivering across three regions,
            <br />
            <span className="text-[#7dc5ef]">twelve cities</span> and counting.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
            One workspace, one evidence model, one shortlist standard — applied
            consistently whether the role sits in Zurich, São Paulo, or Tokyo.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {["EMEA", "AMER", "APAC"].map((r) => {
              const n = GLOBAL_CITIES.filter((c) => c.region === r).length;
              return (
                <div
                  key={r}
                  className="rounded-xl border border-white/15 bg-white/5 p-3"
                >
                  <p className="font-display text-2xl font-semibold">{n}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
                    {r}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simplified world map */}
        <div className="relative aspect-[16/9] w-full">
          <svg
            aria-hidden
            viewBox="0 0 100 60"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Latitude grid */}
            {[10, 20, 30, 40, 50].map((y) => (
              <line
                key={y}
                x1="0"
                x2="100"
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.15"
              />
            ))}
            {[20, 40, 60, 80].map((x) => (
              <line
                key={x}
                x1={x}
                x2={x}
                y1="0"
                y2="60"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.15"
              />
            ))}
            {/* Stylized continents (soft blobs) */}
            <g fill="rgba(125,197,239,0.10)" stroke="rgba(125,197,239,0.25)" strokeWidth="0.15">
              <path d="M15,20 Q22,15 30,20 Q34,28 28,34 Q20,38 14,32 Z" />
              <path d="M18,42 Q24,40 26,48 Q22,56 17,52 Z" />
              <path d="M42,18 Q52,14 58,22 Q54,30 46,28 Q40,24 42,18 Z" />
              <path d="M48,30 Q56,32 54,40 Q46,42 44,36 Z" />
              <path d="M62,22 Q76,20 82,30 Q78,42 68,40 Q60,32 62,22 Z" />
              <path d="M78,42 Q88,44 86,52 Q80,54 76,48 Z" />
            </g>
            {/* City dots */}
            {GLOBAL_CITIES.map((c) => (
              <g key={c.city}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="1.6"
                  fill="#7dc5ef"
                  opacity="0.25"
                >
                  <animate
                    attributeName="r"
                    values="1.6;3.2;1.6"
                    dur="3s"
                    begin={`${(c.x * 0.03).toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.35;0;0.35"
                    dur="3s"
                    begin={`${(c.x * 0.03).toFixed(2)}s`}
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx={c.x} cy={c.y} r="0.7" fill="#7dc5ef" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* City rail */}
      <ul className="mt-8 flex flex-wrap gap-2">
        {GLOBAL_CITIES.map((c) => (
          <li
            key={c.city}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/85"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#7dc5ef]" /> {c.city}
            <span className="text-white/40">·</span>
            <span className="text-white/55">{c.region}</span>
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
        {/* Hero */}
        <header className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Case studies
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            Results, visualized.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            How TaaSFlow delivers evidence-scored shortlists across hospitality,
            finance, and healthcare — with a global operating footprint.
          </p>
        </header>

        <HeroMetrics />

        {/* Study grid */}
        <div className="mt-16 space-y-10">
          {STUDIES.map((s) => (
            <StudyCard key={s.slug} study={s} />
          ))}
        </div>

        {/* Global reach */}
        <GlobalReach />

        {/* Trust / policy note */}
        <section className="mt-16 rounded-2xl border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground md:p-8">
          Metrics reflect aggregate delivery performance across representative
          TaaSFlow engagements in each vertical. Named case studies with written
          client approval are added individually as each client signs off on
          their attribution.
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-12">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Your engagement is next.
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Start an intake and see shortlist delivery inside your own workspace
            in under 10 days.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/intake"
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start hiring
            </Link>
            <Link
              to="/how-it-works"
              className="rounded-md border border-border/60 bg-background px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              See how it works
            </Link>
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
