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
      "Every role runs the same intake, sourcing and evidence review, so standards travel across teams.",
    priorities: [
      "Consistent scoring rubric across role families",
      "Requisition portfolio at a glance",
      "Cycle-time signals in the workspace",
      "Oversight owners per role family",
    ],
    view: "Requisition portfolio · rollups by business unit · stage distribution · decision audit",
    proof: [
      "Same intake → same rubric → same evidence bar for every requisition.",
      "Agent capacity aligned to role families helps keep quality consistent as volume shifts.",
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
      "Interview prompts drafted from the rubric",
      "A message thread with your TaaSFlow recruiter",
    ],
    view: "Role pipeline · candidate detail · evidence per requirement · fit summary · interview prompts",
    proof: [
      "Every score is anchored to a CV quote — no black-box rankings.",
      "Kanban stages with validation prevent silent drop-offs.",
      "Feedback in the workspace can trigger another sourcing round.",
    ],
  },
  {
    key: "finance",
    role: "Finance",
    title: "Fixed package prices. No contingency surprise.",
    icon: Calculator,
    headline:
      "Recruiting becomes a line item you can plan. No success fees and no percentage of salary.",
    priorities: [
      "Published package prices, one-time per package",
      "Pipeline and outcomes visible in the workspace",
      "Candidate records you can export at any time",
      "One vendor instead of a spreadsheet of agencies",
    ],
    view: "Package and billing summary · pipeline and outcomes · record export",
    proof: [
      "Pricing is published — no bespoke deal math needed to plan the quarter.",
      "The workspace is the report, not a stale month-end export.",
      "Above 100 positions we scope the package with you before anything starts.",
    ],
  },
  {
    key: "procurement",
    role: "Procurement",
    title: "One vendor. Clear scope. Auditable decisions.",
    icon: ShieldCheck,
    headline:
      "One accountable vendor instead of an agency panel. Every decision recorded with its reason.",
    priorities: [
      "One agreement covering your searches, scoped with you",
      "Tenant isolation and role-based access",
      "Decision audit trail per candidate",
      "A recruiter reviews every shortlist",
    ],
    view: "Access controls · decision audit · export for reviews · scoped contract terms",
    proof: [
      "Every enterprise account is tenant-isolated — your candidates stay in your account.",
      "Every advance, hold, and pass is captured with a reason.",
      "Security documentation, integrations and service terms are scoped with you before you commit.",
    ],
  },
];

export function EnterpriseStakeholderSelector() {
  const [active, setActive] = React.useState<StakeholderKey>("ta");

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
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(s.key)}
              onKeyDown={(e) => {
                const i = STAKEHOLDERS.findIndex((x) => x.key === s.key);
                const next =
                  e.key === "ArrowRight"
                    ? STAKEHOLDERS[(i + 1) % STAKEHOLDERS.length]
                    : e.key === "ArrowLeft"
                      ? STAKEHOLDERS[(i - 1 + STAKEHOLDERS.length) % STAKEHOLDERS.length]
                      : null;
                if (next) {
                  e.preventDefault();
                  setActive(next.key);
                  document.getElementById(`stakeholder-tab-${next.key}`)?.focus();
                }
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                selected
                  ? "border-[color:var(--brand-navy)] bg-[color:var(--blue-600)] text-white"
                  : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:bg-[color:var(--brand-navy)]/[0.04]",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{s.role}</span>
            </button>
          );
        })}
      </div>

      {/* Panels: all rendered in the server HTML; inactive ones carry `hidden`. */}
      {STAKEHOLDERS.map((current) => (
      <div
        key={current.key}
        id={`stakeholder-panel-${current.key}`}
        role="tabpanel"
        aria-labelledby={`stakeholder-tab-${current.key}`}
        hidden={current.key !== active}
        className="mt-6 grid gap-6 rounded-2xl border border-[color:var(--brand-navy)]/12 bg-white p-6 lg:grid-cols-[1.15fr_1fr] lg:p-8 [&[hidden]]:hidden"
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
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--blue-600)]"
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
      ))}
    </div>
  );
}
