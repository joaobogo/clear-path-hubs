import { useState } from "react";
import {
  Building2,
  Users,
  Search,
  ListChecks,
  Eye,
  Handshake,
  ArrowRight,
} from "lucide-react";

/**
 * Interactive workflow: Client → Agency → TaaSFlow → Ranked shortlist →
 * Agency review → Client delivery. Click any node to see what happens at
 * that step and who owns what.
 */

type Step = {
  id: string;
  label: string;
  actor: "client" | "agency" | "taasflow";
  icon: typeof Building2;
  detail: string;
  owner: string;
};

const STEPS: Step[] = [
  {
    id: "request",
    label: "Client request",
    actor: "client",
    icon: Building2,
    detail:
      "The end client sends a brief to your agency in the way they always have — email, call, existing account manager. Nothing about the client relationship changes.",
    owner: "Your agency owns the client contact.",
  },
  {
    id: "agency",
    label: "Agency intake",
    actor: "agency",
    icon: Handshake,
    detail:
      "Your recruiter runs structured intake with TaaSFlow — capturing must-haves, nice-to-haves, seniority, context. The rubric is agreed with your team before sourcing starts.",
    owner: "Agency-led. TaaSFlow supports.",
  },
  {
    id: "sourcing",
    label: "TaaSFlow sourcing",
    actor: "taasflow",
    icon: Search,
    detail:
      "TaaSFlow recruiters source, screen, and capture CV evidence against every requirement inside the workspace. All activity is auditable — no black-box output.",
    owner: "TaaSFlow delivery layer.",
  },
  {
    id: "shortlist",
    label: "Ranked shortlist",
    actor: "taasflow",
    icon: ListChecks,
    detail:
      "Candidates surface ranked, with CV citations mapped to each requirement, plus recruiter notes. Nothing is 'summarised away' — your team sees the raw signal.",
    owner: "TaaSFlow delivers into your workspace.",
  },
  {
    id: "agency-review",
    label: "Agency review",
    actor: "agency",
    icon: Eye,
    detail:
      "Your recruiter reviews the ranked shortlist, adds their own context, and decides which candidates to present. You control tone, framing, and who reaches the client.",
    owner: "Your agency owns the presentation.",
  },
  {
    id: "delivery",
    label: "Client delivery",
    actor: "agency",
    icon: Users,
    detail:
      "You present shortlisted candidates to your client under your brand — with or without workspace access, depending on your partnership model. Final hiring decision stays with the client.",
    owner: "Your agency owns the delivery.",
  },
];

const OWNERSHIP = [
  {
    area: "Client relationship",
    agency: "Fully owned by your agency",
    taasflow: "Behind-the-scenes delivery only",
  },
  {
    area: "Client communication",
    agency: "All emails, calls, meetings under your brand",
    taasflow: "Never contacts the end client directly",
  },
  {
    area: "Candidate presentation",
    agency: "Your recruiter decides how candidates are framed",
    taasflow: "Provides ranked shortlist + evidence — you package it",
  },
  {
    area: "Final hiring decision",
    agency: "Facilitated by your agency",
    taasflow: "No involvement",
  },
  {
    area: "Sourcing capacity",
    agency: "Extended by TaaSFlow",
    taasflow: "Runs sourcing, screening, evidence work",
  },
  {
    area: "Commercial relationship",
    agency: "Your agency invoices the client",
    taasflow: "Subscription with your agency — separate from client fee",
  },
];

const ACTOR_STYLE: Record<
  Step["actor"],
  { chip: string; ring: string; label: string }
> = {
  client: {
    chip: "bg-[color:var(--brand-mist)] text-[color:var(--brand-navy)]",
    ring: "border-[color:var(--brand-navy)]/25",
    label: "Client",
  },
  agency: {
    chip: "bg-[color:var(--brand-navy)] text-white",
    ring: "border-[color:var(--brand-navy)]",
    label: "Your agency",
  },
  taasflow: {
    chip: "bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-ocean)]",
    ring: "border-[color:var(--brand-ocean)]/40",
    label: "TaaSFlow",
  },
};

export function StaffingWorkflow() {
  const [activeId, setActiveId] = useState<string>("request");
  const active = STEPS.find((s) => s.id === activeId) ?? STEPS[0];
  const ActiveIcon = active.icon;
  const style = ACTOR_STYLE[active.actor];

  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
      {/* Node rail */}
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => {
          const isActive = s.id === activeId;
          const st = ACTOR_STYLE[s.actor];
          return (
            <li key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveId(s.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? `${st.ring} bg-[color:var(--brand-navy)]/[0.03] text-[color:var(--brand-navy)] shadow-sm`
                    : "border-[color:var(--brand-navy)]/15 text-[color:var(--brand-navy)]/70 hover:border-[color:var(--brand-navy)]/40"
                }`}
                aria-pressed={isActive}
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${st.chip}`}
                >
                  {i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 ? (
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-[color:var(--brand-navy)]/30"
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Detail panel */}
      <div className="mt-6 grid gap-6 rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/40 p-6 md:grid-cols-[auto_1fr]">
        <div
          className={`grid h-14 w-14 place-items-center rounded-xl border-2 bg-white ${style.ring}`}
        >
          <ActiveIcon
            aria-hidden
            className="h-6 w-6 text-[color:var(--brand-navy)]"
          />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style.chip}`}
            >
              {style.label}
            </span>
            <h3 className="text-lg font-semibold text-[color:var(--brand-navy)]">
              {active.label}
            </h3>
          </div>
          <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
            {active.detail}
          </p>
          <p className="mt-3 text-xs font-semibold text-[color:var(--brand-navy)]/60">
            Ownership · {active.owner}
          </p>
        </div>
      </div>
    </div>
  );
}

export function StaffingOwnershipMatrix() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white">
      <div className="grid grid-cols-[1.2fr_1.4fr_1.4fr] gap-0 border-b border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-mist)]/60 text-xs font-semibold uppercase tracking-widest text-[color:var(--brand-navy)]/70">
        <div className="px-4 py-3">Area</div>
        <div className="px-4 py-3">Your agency</div>
        <div className="px-4 py-3">TaaSFlow</div>
      </div>
      <ul className="divide-y divide-[color:var(--brand-navy)]/10">
        {OWNERSHIP.map((row) => (
          <li
            key={row.area}
            className="grid grid-cols-[1.2fr_1.4fr_1.4fr] gap-0 text-sm text-[color:var(--brand-navy)]/85"
          >
            <div className="px-4 py-3 font-semibold text-[color:var(--brand-navy)]">
              {row.area}
            </div>
            <div className="px-4 py-3">{row.agency}</div>
            <div className="px-4 py-3">{row.taasflow}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
