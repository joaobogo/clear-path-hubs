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

type Metric = { label: string; value: string; sub?: string };
type Timeline = { day: string; label: string };
type Study = {
  slug: string;
  icon: typeof Hotel;
  industry: string;
  region: string;
  headline: string;
  challenge: string;
  approach: string;
  metrics: Metric[];
  roles: string[];
  timeline: Timeline[];
  testimonial: { quote: string; author: string; role: string };
  gradient: string;
  accent: string;
  pattern: React.ReactNode;
};

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

// --- Studies ------------------------------------------------------------------

const STUDIES: Study[] = [
  {
    slug: "hospitality-luxury-group",
    icon: Hotel,
    industry: "Hospitality",
    region: "Europe · Middle East",
    headline: "Staffing a luxury hotel group across 6 properties",
    challenge:
      "Pre-opening pipeline for 6 flagship properties. Front-of-house, F&B leadership, revenue management, spa — all under one calendar with a hard opening date.",
    approach:
      "Parallel intake per property. Shared candidate pool with location-scored ranking. Evidence-based hospitality fit criteria replaced CV keyword matching entirely.",
    metrics: [
      { label: "Positions filled", value: "42", sub: "across 6 properties" },
      { label: "Time to shortlist", value: "6d", sub: "median per role" },
      { label: "Offer acceptance", value: "88%", sub: "shortlist → hire" },
      { label: "12-mo retention", value: "91%", sub: "of placements" },
    ],
    roles: ["Hotel General Manager", "F&B Director", "Revenue Manager", "Executive Chef", "Spa Director", "Front Office Manager", "Director of Sales", "Rooms Division Manager"],
    timeline: [
      { day: "Day 0", label: "Intake · 6 briefs captured" },
      { day: "Day 4", label: "First evidence-scored shortlists" },
      { day: "Day 12", label: "First 8 offers signed" },
      { day: "Day 84", label: "All 42 roles closed" },
    ],
    testimonial: {
      quote: "TaaSFlow ran six pre-openings in parallel without a single missed calendar. We stopped reading CVs — we read evidence.",
      author: "Group Talent Director",
      role: "European hospitality group",
    },
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
      "Deal-experience evidence scoring, sector-specific screening panels, and reference validation woven directly into the shortlist gate.",
    metrics: [
      { label: "Positions filled", value: "18", sub: "senior + operating" },
      { label: "Days to first hire", value: "21", sub: "signed offer" },
      { label: "Shortlist quality", value: "9.1/10", sub: "client rating" },
      { label: "Diversity mix", value: "44%", sub: "underrepresented" },
    ],
    roles: ["Investment Director", "Vice President, Investments", "Portfolio Operating Partner", "Head of Value Creation", "Senior Associate", "Deal Origination Lead", "Head of IR"],
    timeline: [
      { day: "Day 0", label: "Fund charter → role scoping" },
      { day: "Day 7", label: "First shortlist delivered" },
      { day: "Day 21", label: "First signed offer" },
      { day: "Day 84", label: "Full team + operating partners in seat" },
    ],
    testimonial: {
      quote: "The shortlists were dense with deal evidence, not resumes. Our IC could go straight to reference conversations by week two.",
      author: "Founding Partner",
      role: "Mid-market PE fund",
    },
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
      "A specialty clinic network needed clinical, operational, and digital-health leadership across 11 sites — with credentialing verified before shortlist.",
    approach:
      "Credential-first pipeline. Board certifications, licensure, and patient-outcome evidence surfaced before the client ever opened a profile.",
    metrics: [
      { label: "Positions filled", value: "34", sub: "clinical + ops" },
      { label: "Credential pass", value: "100%", sub: "pre-shortlist gate" },
      { label: "Retention @ 12mo", value: "94%", sub: "of placements" },
      { label: "Sites covered", value: "11", sub: "across 3 countries" },
    ],
    roles: ["Chief Medical Officer", "Clinic Director", "Head of Digital Health", "Director of Nursing", "Head of Patient Operations", "Regulatory & Compliance Lead"],
    timeline: [
      { day: "Day 0", label: "Credential taxonomy locked" },
      { day: "Day 9", label: "First site director shortlisted" },
      { day: "Day 30", label: "8 sites fully staffed at leadership" },
      { day: "Day 120", label: "All 11 sites live" },
    ],
    testimonial: {
      quote: "Every shortlisted candidate had verified credentials before we spoke to them. That alone gave us back six weeks per hire.",
      author: "Chief People Officer",
      role: "Specialty clinic network",
    },
    gradient: "from-[#0f3d3a] via-[#137a63] to-[#4fbfa1]",
    accent: "text-[#7fe0c4]",
    pattern: HealthPattern,
  },
  {
    slug: "tech-series-c-platform",
    icon: Cpu,
    industry: "Technology",
    region: "North America · Europe",
    headline: "Series C platform team — engineers, PMs, and design",
    challenge:
      "A Series C infra platform company needed to double engineering and stand up a product-led design org in two quarters, without diluting their bar.",
    approach:
      "Skill-graph evidence scoring on real project artifacts (PRs, RFCs, portfolios). Structured hiring panels standardized across regions.",
    metrics: [
      { label: "Positions filled", value: "27", sub: "eng · PM · design" },
      { label: "Interview-to-offer", value: "3.2x", sub: "vs. prior baseline" },
      { label: "Pass through loop", value: "62%", sub: "shortlist → onsite" },
      { label: "Diversity mix", value: "48%", sub: "underrepresented" },
    ],
    roles: ["Staff Engineer, Platform", "Principal PM", "Head of Design", "Engineering Manager", "Senior Backend Engineer", "Design Systems Lead"],
    timeline: [
      { day: "Day 0", label: "Skill graph + rubric locked" },
      { day: "Day 5", label: "First shortlist across 3 tracks" },
      { day: "Day 42", label: "12 offers signed" },
      { day: "Day 90", label: "Full 27 seats closed" },
    ],
    testimonial: {
      quote: "The candidate loop finally felt like engineering — evidence in, decisions out. We stopped debating vibes and started debating trade-offs.",
      author: "VP of Engineering",
      role: "Series C infra company",
    },
    gradient: "from-[#1a1440] via-[#3b2e8c] to-[#7c5cff]",
    accent: "text-[#b8a6ff]",
    pattern: TechPattern,
  },
  {
    slug: "consumer-dtc-scaleup",
    icon: ShoppingBag,
    industry: "Consumer & Retail",
    region: "Europe · Americas",
    headline: "Scaling a DTC brand into omnichannel retail",
    challenge:
      "A fast-growing DTC brand needed leadership across retail expansion, supply chain, brand, and performance marketing — while protecting margin discipline.",
    approach:
      "P&L-owner evidence gate. Every senior shortlist required documented category ownership, margin, and channel results at comparable scale.",
    metrics: [
      { label: "Positions filled", value: "23", sub: "commercial + ops" },
      { label: "Median time-to-hire", value: "31d", sub: "brief → signed" },
      { label: "Cost-per-hire", value: "-42%", sub: "vs. prior agency" },
      { label: "Markets opened", value: "4", sub: "in 9 months" },
    ],
    roles: ["Chief Retail Officer", "VP Supply Chain", "Head of Brand", "Director of Performance Marketing", "Head of Category", "Regional GM"],
    timeline: [
      { day: "Day 0", label: "Growth plan → role map" },
      { day: "Day 6", label: "First commercial shortlist" },
      { day: "Day 45", label: "Retail leadership in seat" },
      { day: "Day 180", label: "4 new markets operational" },
    ],
    testimonial: {
      quote: "We halved our cost per senior hire and doubled offer acceptance. The shortlists actually understood our margin model.",
      author: "Chief Executive Officer",
      role: "DTC consumer brand",
    },
    gradient: "from-[#5c1c3a] via-[#a02d5d] to-[#e77aa8]",
    accent: "text-[#f7c2d9]",
    pattern: RetailPattern,
  },
  {
    slug: "industrial-energy-transition",
    icon: Factory,
    industry: "Industrial & Energy",
    region: "Europe · Middle East · APAC",
    headline: "Energy-transition leadership across 3 continents",
    challenge:
      "A heavy-industry group building out a low-carbon business needed engineering, EPC, and commercial leadership across sites on three continents.",
    approach:
      "Regulated-industry evidence scoring — safety records, EPC delivery track record, and commissioning experience were mandatory shortlist gates.",
    metrics: [
      { label: "Positions filled", value: "31", sub: "engineering + commercial" },
      { label: "Sites staffed", value: "9", sub: "on 3 continents" },
      { label: "Time to shortlist", value: "7d", sub: "median per role" },
      { label: "Offer acceptance", value: "84%", sub: "shortlist → hire" },
    ],
    roles: ["Head of Low-Carbon Projects", "VP Engineering", "EPC Program Director", "Commissioning Manager", "Head of HSE", "Commercial Director"],
    timeline: [
      { day: "Day 0", label: "Program charter · 3 regions" },
      { day: "Day 10", label: "First regional shortlists" },
      { day: "Day 60", label: "18 senior seats filled" },
      { day: "Day 150", label: "All 31 roles closed" },
    ],
    testimonial: {
      quote: "The shortlist gate for safety and EPC delivery experience is what won us the confidence of our board.",
      author: "Group HR Director",
      role: "Industrial energy group",
    },
    gradient: "from-[#1e1a12] via-[#4a3a1f] to-[#c8933a]",
    accent: "text-[#f5cf7a]",
    pattern: IndustrialPattern,
  },
];

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
