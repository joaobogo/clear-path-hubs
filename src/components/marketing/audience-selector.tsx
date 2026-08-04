import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Rocket,
  Users,
  Building2,
  Handshake,
  ArrowRight,
  Sparkles,
  BarChart3,
  Layers,
  Network,
} from "lucide-react";

type AudienceKey = "founders" | "hr" | "enterprise" | "agencies";

type Audience = {
  key: AudienceKey;
  label: string;
  tagline: string;
  icon: typeof Rocket;
  problem: string;
  role: string;
  benefit: {
    title: string;
    body: string;
  };
  cta: { label: string; to: string };
  visual: "founder" | "hr" | "enterprise" | "agency";
};

const AUDIENCES: Audience[] = [
  {
    key: "founders",
    label: "Founders",
    tagline: "Hire without building a talent team.",
    icon: Rocket,
    problem: "You need to hire without building an entire recruiting department.",
    role: "Your on-demand sourcing and candidate-delivery team.",
    benefit: {
      title: "Ship hires, not job posts.",
      body: "Delivered shortlists with evidence — you spend hours, not weeks, per role.",
    },
    cta: { label: "See how founders hire", to: "/how-it-works" },
    visual: "founder",
  },
  {
    key: "hr",
    label: "HR & Talent Teams",
    tagline: "Add sourcing capacity your team can trust.",
    icon: Users,
    problem:
      "Your TA team is overloaded with sourcing and fragmented agency management.",
    role: "Continuous sourcing capacity with visible candidate delivery.",
    benefit: {
      title: "Your team stops chasing agencies.",
      body: "One workspace, one process, one evidence trail — across every role in flight.",
    },
    cta: { label: "See the HR workflow", to: "/how-it-works" },
    visual: "hr",
  },
  {
    key: "enterprise",
    label: "Enterprise",
    tagline: "Coordinate hiring at portfolio scale.",
    icon: Building2,
    problem:
      "Multi-role and multi-market hiring becomes difficult to coordinate.",
    role: "Structured recruiting capacity with portfolio-level transparency.",
    benefit: {
      title: "Every role, one control plane.",
      body: "Cross-market pipelines, consistent evaluation, and audit-ready delivery.",
    },
    cta: { label: "Talk to enterprise", to: "/contact" },
    visual: "enterprise",
  },
  {
    key: "agencies",
    label: "Staffing Agencies",
    tagline: "White-label sourcing capacity.",
    icon: Handshake,
    problem: "Client demand can exceed internal sourcing capacity.",
    role: "A scalable sourcing partner behind your client relationships.",
    benefit: {
      title: "Say yes to more mandates.",
      body: "Flexible sourcing capacity that plugs into your delivery — with your brand up front.",
    },
    cta: { label: "Partner with TaaSFlow", to: "/contact" },
    visual: "agency",
  },
];

export function AudienceSelector() {
  const [active, setActive] = useState<AudienceKey>("founders");
  const a = AUDIENCES.find((x) => x.key === active)!;

  return (
    <div className="mt-10">
      {/* Selector */}
      <div
        role="tablist"
        aria-label="Choose your audience"
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
      >
        {AUDIENCES.map((x) => {
          const Icon = x.icon;
          const isActive = x.key === active;
          return (
            <button
              key={x.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(x.key)}
              className={`group flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition sm:p-4 ${
                isActive
                  ? "border-[color:var(--brand-ocean-text)] bg-[color:var(--brand-ocean-text)] text-white shadow-md"
                  : "border-[color:var(--brand-navy)]/10 bg-white text-[color:var(--brand-navy)] hover:border-[color:var(--brand-ocean)]/40"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive ? "text-white" : "text-[color:var(--brand-ocean-text)]"
                }`}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight">{x.label}</div>
                <div
                  className={`mt-0.5 text-[11px] leading-snug ${
                    isActive ? "text-white/85" : "text-[color:var(--brand-navy)]/80"
                  }`}
                >
                  {x.tagline}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="mt-6 grid gap-6 rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:p-8">
        <div className="flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
                The problem
              </div>
              <p className="mt-1 text-lg font-semibold leading-snug text-[color:var(--brand-navy)]">
                {a.problem}
              </p>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-ocean-text)]">
                TaaSFlow's role
              </div>
              <p className="mt-1 text-base leading-relaxed text-[color:var(--brand-navy)]/85">
                {a.role}
              </p>
            </div>
            <div className="rounded-lg bg-[color:var(--brand-mist)]/50 p-4">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
                <Sparkles className="h-3 w-3 text-[color:var(--brand-ocean-text)]" />
                Strongest benefit
              </div>
              <div className="mt-1.5 text-base font-bold text-[color:var(--brand-navy)]">
                {a.benefit.title}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/80">
                {a.benefit.body}
              </p>
            </div>
          </div>

          <Link
            to={a.cta.to}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-ocean)]"
          >
            {a.cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {/* Product visual */}
        <div className="min-h-[280px] rounded-xl bg-gradient-to-br from-[color:var(--brand-mist)]/60 to-white p-5">
          {a.visual === "founder" && <FounderVisual />}
          {a.visual === "hr" && <HRVisual />}
          {a.visual === "enterprise" && <EnterpriseVisual />}
          {a.visual === "agency" && <AgencyVisual />}
        </div>
      </div>
    </div>
  );
}

/* ---- Visuals ---- */

function FounderVisual() {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
        Your first hire, delivered
      </div>
      {[
        { name: "Head of Engineering", status: "3 candidates delivered", pct: 100 },
      ].map((r) => (
        <div key={r.name} className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[color:var(--brand-navy)]">{r.name}</span>
            <span className="rounded-full bg-[color:var(--brand-ocean)]/10 px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand-ocean-text)]">
              Delivered
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-mist)]">
            <div className="h-full bg-[color:var(--brand-ocean)]" style={{ width: `${r.pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-[color:var(--brand-navy)]/80">{r.status}</div>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        {["Alex R.", "Priya M.", "Daniel K."].map((n, i) => (
          <div key={n} className="rounded-md border border-[color:var(--brand-navy)]/10 bg-white p-2 text-center">
            <div className="mx-auto grid h-7 w-7 place-items-center rounded-full bg-[color:var(--brand-ocean)]/10 text-[10px] font-bold text-[color:var(--brand-ocean-text)]">
              {i + 1}
            </div>
            <div className="mt-1 truncate text-[11px] font-semibold text-[color:var(--brand-navy)]">{n}</div>
            <div className="text-[10px] text-[color:var(--brand-navy)]/80">Fit {92 - i * 4}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HRVisual() {
  const roles = [
    { r: "Sales Lead", s: "Delivering", p: 80 },
    { r: "Data Eng", s: "Sourcing", p: 45 },
    { r: "PM", s: "Delivering", p: 65 },
    { r: "Designer", s: "Sourcing", p: 30 },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
        <Layers className="h-3 w-3 text-[color:var(--brand-ocean-text)]" />
        Continuous sourcing capacity
      </div>
      {roles.map((r) => (
        <div key={r.r} className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-2.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-[color:var(--brand-navy)]">{r.r}</span>
            <span className="text-[10px] text-[color:var(--brand-navy)]/80">{r.s}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-mist)]">
            <div className="h-full bg-[color:var(--brand-ocean)]" style={{ width: `${r.p}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EnterpriseVisual() {
  const markets = [
    { m: "North America", roles: 12, delivered: 34 },
    { m: "EMEA", roles: 8, delivered: 21 },
    { m: "APAC", roles: 5, delivered: 12 },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
        <Network className="h-3 w-3 text-[color:var(--brand-ocean-text)]" />
        Portfolio view
      </div>
      {markets.map((m) => (
        <div key={m.m} className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[color:var(--brand-navy)]">{m.m}</span>
            <span className="text-[11px] text-[color:var(--brand-navy)]/80">
              {m.roles} roles active
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-[color:var(--brand-ocean-text)]" />
            <span className="text-[11px] font-semibold text-[color:var(--brand-navy)]">
              {m.delivered} candidates delivered YTD
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgencyVisual() {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/80">
        Your brand up front
      </div>
      <div className="rounded-lg border border-[color:var(--brand-navy)]/10 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[color:var(--brand-navy)]">Client: Acme</span>
          <span className="rounded-full bg-[color:var(--brand-ocean)]/10 px-2 py-0.5 text-[10px] font-bold text-[color:var(--brand-ocean-text)]">
            3 mandates
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          {["Head of Sales", "Senior BE Engineer", "Ops Manager"].map((r, i) => (
            <div key={r} className="flex items-center justify-between text-[11px]">
              <span className="text-[color:var(--brand-navy)]/85">{r}</span>
              <span className="text-[color:var(--brand-navy)]/80">
                Sourced by TaaSFlow · {12 - i * 3} candidates
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-[color:var(--brand-mist)]/40 p-3 text-[11px] leading-relaxed text-[color:var(--brand-navy)]/80">
        White-label delivery — TaaSFlow works behind your workspace, your client sees you.
      </div>
    </div>
  );
}
