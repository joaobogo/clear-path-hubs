import * as React from "react";
import {
  Briefcase,
  Users,
  Calculator,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StakeholderKey = "ta" | "hm" | "finance" | "procurement";

type Stakeholder = {
  key: StakeholderKey;
  role: string;
  title: string;
  icon: LucideIcon;
  headline: string;
  priorities: string[];
  view: string; // "what they see in the workspace"
  proof: string[]; // 3 concise substantiated points
};

const STAKEHOLDERS: Stakeholder[] = [
  {
    key: "ta",
    role: "Talent Acquisition Leader",
    title: "One portfolio. Same standard across every requisition.",
    icon: Briefcase,
    headline:
      "Every open role runs the same intake, sourcing, evidence review, and ranked delivery — so standards travel across teams instead of resetting per requisition.",
    priorities: [
      "Consistent scoring rubric across role families",
      "Requisition portfolio at a glance",
      "Cycle-time signals live, not lagged",
      "Named oversight owners per role family",
    ],
    view: "Requisition portfolio · rollups by business unit · stage distribution · decision audit",
    proof: [
      "Same intake → same rubric → same evidence bar for every requisition.",
      "Agent capacity aligned to role families keeps quality consistent as volume shifts.",
      "Every stage change is time-stamped and attributable.",
    ],
  },
  {
    key: "hm",
    role: "Hiring Manager",
    title: "The candidates you review are already defensible.",
    icon: Users,
    headline:
      "Nothing reaches your pipeline without recruiter-reviewed evidence per requirement. You spend time on interviews, not filtering CVs.",
    priorities: [
      "Ranked shortlist against the requirements you approved",
      "Evidence quotes from each CV",
      "Interview prompts pre-drafted from the rubric",
      "Direct thread with your platform experts",
    ],
    view: "Role pipeline · candidate detail · evidence per requirement · fit summary · interview prompts",
    proof: [
      "Every score is anchored to a CV quote — no black-box rankings.",
      "Kanban stages with validation prevent silent drop-offs.",
      "Feedback in the workspace triggers another sourcing round automatically.",
    ],
  },
  {
    key: "finance",
    role: "Finance",
    title: "Flat subscription. Predictable spend. No contingency surprise.",
    icon: Calculator,
    headline:
      "Recruiting cost becomes a line item you can plan. No per-hire success fees, no post-close surprise from an agency invoice.",
    priorities: [
      "Predictable monthly cost, published packages",
      "Cost per hire visible against actual placements",
      "Board-ready exports of pipeline and outcomes",
      "One vendor invoice — not a spreadsheet of agencies",
    ],
    view: "Account cost summary · placements per month · export for board and audit",
    proof: [
      "Pricing is published — no bespoke deal math needed to plan the quarter.",
      "The workspace is the report, not a stale month-end export.",
      "Custom-volume tiers are quoted transparently against actual usage.",
    ],
  },
  {
    key: "procurement",
    role: "Procurement",
    title: "One vendor. Clear scope. Auditable decisions.",
    icon: ShieldCheck,
    headline:
      "Replace a fragmented panel of agencies with one accountable vendor. Every candidate decision is recorded with the reason, visible to your team.",
    priorities: [
      "Single MSA covers all searches",
      "Tenant isolation and role-based access",
      "Decision audit trail per candidate",
      "Named recruiter contact — not a ticket queue",
    ],
    view: "Access controls · decision audit · export for reviews · scoped contract terms",
    proof: [
      "Every enterprise account is tenant-isolated — your candidates stay in your account.",
      "Every advance, hold, and pass is captured with a reason.",
      "Certifications, integrations, and SLAs are scoped in the enterprise consultation.",
    ],
  },
];

export function EnterpriseStakeholderSelector() {
  const [active, setActive] = React.useState<StakeholderKey>("ta");
  const current = STAKEHOLDERS.find((s) => s.key === active)!;

  return (
    <div>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Choose a stakeholder"
        className="flex flex-wrap gap-2"
      >
        {STAKEHOLDERS.map((s) => {
          const Icon = s.icon;
          const selected = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`stakeholder-panel-${s.key}`}
              id={`stakeholder-tab-${s.key}`}
              onClick={() => setActive(s.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                selected
                  ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                  : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:bg-[color:var(--brand-navy)]/[0.04]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{s.role}</span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div
        id={`stakeholder-panel-${current.key}`}
        role="tabpanel"
        aria-labelledby={`stakeholder-tab-${current.key}`}
        className="mt-6 grid gap-6 rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-6 lg:grid-cols-[1.15fr_1fr] lg:p-8"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            {current.role}
          </p>
          <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)] sm:text-3xl">
            {current.title}
          </h3>
          <p className="mt-3 text-[color:var(--brand-navy)]/80">
            {current.headline}
          </p>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">
            What matters to this role
          </p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {current.priorities.map((p) => (
              <li
                key={p}
                className="flex items-start gap-2 text-sm text-[color:var(--brand-navy)]/80"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]"
                />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-cream)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">
              What they see in the workspace
            </p>
            <p className="mt-1.5 text-sm text-[color:var(--brand-navy)]/80">
              {current.view}
            </p>
          </div>

          <div className="rounded-xl border border-[color:var(--brand-navy)]/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--brand-navy)]/80">
              Why it holds up under scrutiny
            </p>
            <ul className="mt-2 space-y-1.5">
              {current.proof.map((p) => (
                <li
                  key={p}
                  className="text-sm text-[color:var(--brand-navy)]/80"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
