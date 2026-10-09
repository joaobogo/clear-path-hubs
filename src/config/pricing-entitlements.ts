/**
 * TaaSFlow — Platform entitlements per plan
 * =========================================
 * Describes what each plan GRANTS as software-platform entitlements
 * (roles under management, seats, agent capacity, records, retention,
 * intelligence, evidence, governance, exports, integrations, support,
 * expert oversight).
 *
 * HARD RULES
 *  - No price, billing logic, checkout destination or contractual claim is
 *    defined here. Prices live in src/config/pricing-core.ts.
 *  - Never invent a usage limit. If the commercial model does not define an
 *    entitlement, use `pending()` — it renders as "Confirmed on your quote"
 *    publicly and is tracked in docs/pricing/entitlement-confirmations.md.
 */

import { RECORDS_NOTE } from "@/config/offer-facts";

export type EntitlementValue =
  | { kind: "value"; label: string; note?: string }
  | { kind: "included" }
  | { kind: "not-included" }
  | { kind: "pending"; reason: string };

export const value = (label: string, note?: string): EntitlementValue => ({
  kind: "value",
  label,
  note,
});
export const included = (): EntitlementValue => ({ kind: "included" });
export const notIncluded = (): EntitlementValue => ({ kind: "not-included" });
/** Entitlement not defined by the current commercial model. Never fabricate. */
export const pending = (reason: string): EntitlementValue => ({
  kind: "pending",
  reason,
});

export const PENDING_PUBLIC_LABEL = "Confirmed on your quote";

export type EntitlementRowId =
  | "active_roles"
  | "workspace_seats"
  | "agent_capacity"
  | "candidate_records"
  | "data_retention"
  | "hiring_intelligence"
  | "evidence_graph"
  | "governance"
  | "audit_exports"
  | "integrations"
  | "support"
  | "expert_oversight"
  | "included_results";

export type EntitlementRow = {
  id: EntitlementRowId;
  label: string;
  description: string;
  /** Keyed by plan id (one-off tier ids and subscription tier ids). */
  plans: Record<string, EntitlementValue>;
};

/** The published packages — the same packages one-off and subscription use. */
export const ONEOFF_PLAN_IDS = ["pilot", "growth", "scale", "volume", "enterprise"] as const;
export const ONEOFF_PLAN_LABELS: Record<string, string> = {
  pilot: "1 position",
  growth: "Up to 10 positions",
  scale: "Up to 20 positions",
  volume: "Up to 30 positions",
  enterprise: "More than 30 positions",
};

export const SUBSCRIPTION_PLAN_IDS = ONEOFF_PLAN_IDS;
export const SUBSCRIPTION_PLAN_LABELS = ONEOFF_PLAN_LABELS;

/* ------------------------------------------------------------------ */
/* One-off entitlement matrix                                          */
/* ------------------------------------------------------------------ */

export const ONEOFF_ENTITLEMENTS: EntitlementRow[] = [
  {
    id: "active_roles",
    label: "Active roles under management",
    description:
      "Roles that are open in the workspace and being worked by the agent layer at the same time.",
    plans: {
      pilot: value("1"),
      growth: value("Up to 10"),
      scale: value("Up to 20"),
      volume: value("Up to 30"),
      enterprise: value("Scoped", "Set with your plan"),
    },
  },
  {
    id: "workspace_seats",
    label: "Workspace seats",
    description: "People in your organisation with their own login to the workspace.",
    plans: {
      pilot: value("2 seats", "1 owner + 1 recruiter"),
      growth: value("4 seats", "1 owner + 3 recruiters"),
      scale: value("8 seats", "1 owner + 7 recruiters"),
      volume: value("11 seats", "1 owner + 10 recruiters"),
      enterprise: value("Scoped", "Agreed during security and procurement review"),
    },
  },
  {
    id: "agent_capacity",
    label: "Agent capacity",
    description:
      "Intake, blueprint, discovery, evidence and scoring agent runs available to your roles.",
    plans: {
      pilot: value("Full agent layer", "Scoped to 1 active role"),
      growth: value("Full agent layer", "Scoped to your active roles"),
      scale: value("Full agent layer", "Concurrent runs across all active roles"),
      volume: value("Full agent layer", "Concurrent runs across all active roles"),
      enterprise: value("Full agent layer", "Capacity planned with your plan"),
    },
  },
  {
    id: "candidate_records",
    label: "Candidate records",
    description: "Candidate profiles, evidence and scores stored in your workspace.",
    plans: {
      pilot: value("Unmetered for your roles", "No per-CV charges"),
      growth: value("Unmetered for your roles", "No per-CV charges"),
      scale: value("Unmetered for your roles", "No per-CV charges"),
      volume: value("Unmetered for your roles", "No per-CV charges"),
      enterprise: value("Unmetered for your roles", "No per-CV charges"),
    },
  },
  {
    id: "data_retention",
    label: "Data retention",
    description: "How long candidate records and evidence stay accessible in your workspace.",
    plans: {
      pilot: value("3 months"),
      growth: value("3 months"),
      scale: value("3 months"),
      volume: value("3 months"),
      enterprise: value("Custom", "Including data-residency requirements"),
    },
  },
  {
    id: "hiring_intelligence",
    label: "Hiring Intelligence",
    description:
      "Pipeline health, time-to-first-qualified, score distribution and dropout analysis.",
    plans: {
      pilot: included(),
      growth: included(),
      scale: included(),
      volume: included(),
      enterprise: value("Included + custom reporting"),
    },
  },
  {
    id: "evidence_graph",
    label: "Evidence Graph access",
    description:
      "Every score traced to the specific findings behind it, per candidate and requirement.",
    plans: {
      pilot: included(),
      growth: included(),
      scale: included(),
      volume: included(),
      enterprise: included(),
    },
  },
  {
    id: "governance",
    label: "Governance controls",
    description:
      "Approval gates before candidates are visible, contact-release permissions, role-based access.",
    plans: {
      pilot: included(),
      growth: included(),
      scale: included(),
      volume: included(),
      enterprise: value("Included + security review"),
    },
  },
  {
    id: "audit_exports",
    label: "Audit exports",
    description: "Exportable record of decisions, scores and evidence for internal review.",
    plans: {
      pilot: pending("Export entitlement scope per plan not defined commercially"),
      growth: pending("Export entitlement scope per plan not defined commercially"),
      scale: pending("Export entitlement scope per plan not defined commercially"),
      volume: pending("Export entitlement scope per plan not defined commercially"),
      enterprise: value("Scoped", "Agreed in your reporting requirements"),
    },
  },
  {
    id: "integrations",
    label: "Integration access",
    description: "Email and messaging connected to your workspace.",
    plans: {
      pilot: pending("Per-plan integration entitlements not defined commercially"),
      growth: pending("Per-plan integration entitlements not defined commercially"),
      scale: pending("Per-plan integration entitlements not defined commercially"),
      volume: pending("Per-plan integration entitlements not defined commercially"),
      enterprise: value("Scoped", "Reviewed with your IT and security teams"),
    },
  },
  {
    id: "support",
    label: "Support level",
    description: "How you reach us and how quickly we respond.",
    plans: {
      pilot: value("Standard support"),
      growth: value("Standard support"),
      scale: value("Priority support"),
      volume: value("Priority support"),
      enterprise: value("SLA-backed support", "Named executive sponsor"),
    },
  },
  {
    id: "expert_oversight",
    label: "Expert oversight",
    description:
      "Human review of agent output before candidates reach your decision queue.",
    plans: {
      pilot: value("Included"),
      growth: value("Included"),
      scale: value("Included + priority calibration"),
      volume: value("Included + priority calibration"),
      enterprise: value("Included + dedicated account structure"),
    },
  },
  {
    id: "included_results",
    label: "Included results",
    description: "What the platform produces for each active role.",
    plans: {
      pilot: value("Ranked, evidence-backed shortlists", "Refreshed weekly"),
      growth: value("Ranked shortlists per role", "All roles run in parallel"),
      scale: value("Ranked shortlists per role", "All roles run in parallel"),
      volume: value("Ranked shortlists per role", "All roles run in parallel"),
      enterprise: value("Ranked shortlists per role", "Custom operating cadence"),
    },
  },
];

/* ------------------------------------------------------------------ */
/* Subscription entitlement matrix                                     */
/* ------------------------------------------------------------------ */

export const SUBSCRIPTION_ENTITLEMENTS: EntitlementRow[] = [
  {
    id: "active_roles",
    label: "Active roles under management",
    description:
      "Roles open in the workspace and worked by the agent layer within the billing month.",
    plans: {
      pilot: value("1 per month"),
      growth: value("Up to 10 per month"),
      scale: value("Up to 20 per month"),
      volume: value("Up to 30 per month"),
      enterprise: value("More than 30 per month", "Scoped with you"),
    },
  },
  {
    id: "workspace_seats",
    label: "Workspace seats",
    description: "People in your organisation with their own login to the workspace.",
    plans: {
      pilot: value("2 seats", "1 owner + 1 recruiter"),
      growth: value("4 seats", "1 owner + 3 recruiters"),
      scale: value("8 seats", "1 owner + 7 recruiters"),
      volume: value("11 seats", "1 owner + 10 recruiters"),
      enterprise: value("Scoped", "Agreed during procurement"),
    },
  },
  {
    id: "agent_capacity",
    label: "Agent capacity",
    description:
      "Intake, blueprint, discovery, evidence and scoring agent runs available to your roles.",
    plans: {
      pilot: value("Full agent layer", "Within your monthly package capacity"),
      growth: value("Full agent layer", "Within your monthly package capacity"),
      scale: value("Full agent layer", "Faster calibration cycles"),
      volume: value("Full agent layer", "Highest concurrency in the published packages"),
      enterprise: value("Full agent layer", "Capacity planned with your plan"),
    },
  },
  {
    id: "candidate_records",
    label: "Candidate records",
    description: "Candidate profiles, evidence and scores stored in your workspace.",
    plans: {
      pilot: value("Unmetered for your roles", "No per-CV charges"),
      growth: value("Unmetered for your roles", "No per-CV charges"),
      scale: value("Unmetered for your roles", "No per-CV charges"),
      volume: value("Unmetered for your roles", "No per-CV charges"),
      enterprise: value("Unmetered for your roles", "No per-CV charges"),
    },
  },
  {
    id: "data_retention",
    label: "Data retention",
    description: "How long candidate records and evidence stay accessible in your workspace.",
    plans: {
      pilot: value("3 months"),
      growth: value("3 months"),
      scale: value("3 months"),
      volume: value("3 months"),
      enterprise: value("Custom", "Including data-residency requirements"),
    },
  },
  {
    id: "hiring_intelligence",
    label: "Hiring Intelligence",
    description:
      "Pipeline health, speed, score distribution and dropout analysis across your roles.",
    plans: {
      pilot: included(),
      growth: included(),
      scale: included(),
      volume: value("Included + custom reporting"),
      enterprise: value("Included + strategic planning sessions"),
    },
  },
  {
    id: "evidence_graph",
    label: "Evidence Graph access",
    description: "Every score traced to the findings behind it, per candidate and requirement.",
    plans: {
      pilot: included(),
      growth: included(),
      scale: included(),
      volume: included(),
      enterprise: included(),
    },
  },
  {
    id: "governance",
    label: "Governance controls",
    description:
      "Approval gates, contact-release permissions and role-based access across your team.",
    plans: {
      pilot: included(),
      growth: included(),
      scale: included(),
      volume: included(),
      enterprise: value("Included + security review"),
    },
  },
  {
    id: "audit_exports",
    label: "Audit exports",
    description: "Exportable record of decisions, scores and evidence for internal review.",
    plans: {
      pilot: pending("Export entitlement scope per plan not defined commercially"),
      growth: pending("Export entitlement scope per plan not defined commercially"),
      scale: pending("Export entitlement scope per plan not defined commercially"),
      volume: value("Included with custom reporting"),
      enterprise: value("Scoped", "Agreed in your reporting requirements"),
    },
  },
  {
    id: "integrations",
    label: "Integration access",
    description: "Email and messaging connected to your workspace.",
    plans: {
      pilot: pending("Per-plan integration entitlements not defined commercially"),
      growth: pending("Per-plan integration entitlements not defined commercially"),
      scale: pending("Per-plan integration entitlements not defined commercially"),
      volume: pending("Per-plan integration entitlements not defined commercially"),
      enterprise: value("Scoped", "Reviewed with your IT and security teams"),
    },
  },
  {
    id: "support",
    label: "Support level",
    description: "How you reach us and how quickly we respond.",
    plans: {
      pilot: value("Dedicated support"),
      growth: value("Dedicated support"),
      scale: value("Priority support"),
      volume: value("Dedicated account manager"),
      enterprise: value("White-glove onboarding", "Strategic planning sessions"),
    },
  },
  {
    id: "expert_oversight",
    label: "Expert oversight",
    description: "Human review of agent output before candidates reach your decision queue.",
    plans: {
      pilot: value("Included"),
      growth: value("Included"),
      scale: value("Included + faster calibration"),
      volume: value("Included + named account manager"),
      enterprise: value("Included + strategic reviews"),
    },
  },
  {
    id: "included_results",
    label: "Included results",
    description: "What the platform produces for each active role.",
    plans: {
      pilot: value("Ranked, evidence-backed shortlists", "Refreshed weekly"),
      growth: value("Ranked, evidence-backed shortlists", "Refreshed weekly"),
      scale: value("Ranked shortlists per role", "Refreshed weekly"),
      volume: value("Ranked shortlists per role", "Refreshed weekly"),
      enterprise: value("Ranked shortlists per role", "Custom operating cadence"),
    },
  },
];

/* ------------------------------------------------------------------ */
/* Plain-language policy copy (no new contractual claims)              */
/* ------------------------------------------------------------------ */

export type PolicyItem = { id: string; question: string; answer: string };

export const ENTITLEMENT_POLICY: PolicyItem[] = [
  {
    id: "active-role",
    question: "What counts as an active role?",
    answer:
      "An active role is one role in your workspace that is open and being worked by the agent layer — intake compiled, discovery running, evidence and scoring produced. Roles you have paused, filled or closed do not count against the entitlement. One role means one job opening, not one hire: multiple hires against the same opening stay inside the same active role.",
  },
  {
    id: "limits",
    question: "What happens when limits are reached?",
    answer:
      "Nothing breaks and nothing is charged automatically. When you reach your active-role entitlement, new roles queue as drafts in the workspace until a role closes or you move to the next package. We will tell you which roles are counting and what your options are before anything changes.",
  },
  {
    id: "billing",
    question: "How often are we billed?",
    answer:
      "We sell packages. The pilot is a flat fee for one position, billed once. Each larger package states a capacity and one total — one-off and subscription use the same packages at the same prices, with subscriptions billed monthly at the start of the month. Paying twelve months up front saves 10% on the annual total; the monthly price itself never changes. Exact billing terms for your plan are on your quote — nothing on this page changes what you agreed.",
  },
  {
    id: "upgrade",
    question: "How does the upgrade path work?",
    answer:
      "Move to a larger package at the next billing cycle. Your workspace, intake context, evidence, scores and candidate records carry over — you do not start again. Downgrades work the same way.",
  },
  {
    id: "cancellation",
    question: "What are the cancellation terms?",
    answer:
      "Subscriptions can be paused or cancelled with notice, and your workspace, candidates and evidence stay in place through the retention window. Contract minimums, notice periods and any enterprise terms are stated on your quote or agreement — please treat that document as the authority, not this page.",
  },
  {
    id: "retention",
    question: "How long is our data kept?",
    answer:
      `${RECORDS_NOTE} Longer retention and data-residency requirements are set on enterprise agreements. There are no placement fees or salary percentages.`,
  },
  {
    id: "oversight",
    question: "Do plans include expert oversight?",
    answer:
      "Yes. Every plan includes human review of agent output before candidates reach your decision queue, plus calibration when your criteria shift. Higher bands add priority calibration and a named account structure. This is governance over the system's output — it is included in the plan, not billed as hours.",
  },
];

/* ------------------------------------------------------------------ */
/* Public comparison table — every sold package                        */
/*                                                                     */
/* Additive. The tables above keep their shape; these derive from them  */
/* and add the 40- and 100-position packages. A cell nobody has defined */
/* says "Scoped with your account team" — never an invented feature.    */
/* ------------------------------------------------------------------ */

export const SCOPED_PUBLIC_LABEL = "Scoped with your account team";
export const ABOVE_MAX_PLAN_LABEL = "More than 100 positions: scoped";

export const PUBLIC_PLAN_IDS = [
  "pilot",
  "growth",
  "scale",
  "volume",
  "portfolio",
  "program",
  "enterprise",
] as const;

export const PUBLIC_PLAN_LABELS: Record<string, string> = {
  pilot: "1 position (pilot)",
  growth: "Up to 10 positions",
  scale: "Up to 20 positions",
  volume: "Up to 30 positions",
  portfolio: "Up to 40 positions",
  program: "Up to 100 positions",
  enterprise: ABOVE_MAX_PLAN_LABEL,
};

const scoped = () => value(SCOPED_PUBLIC_LABEL);

/** Cells for the 40- and 100-position packages, by row. */
const LARGE_PACKAGE_CELLS: Record<
  EntitlementRowId,
  { portfolio: EntitlementValue; program: EntitlementValue }
> = {
  active_roles: { portfolio: value("Up to 40"), program: value("Up to 100") },
  workspace_seats: { portfolio: scoped(), program: scoped() },
  agent_capacity: {
    portfolio: value("Full agent layer", "Concurrent runs across all active roles"),
    program: value("Full agent layer", "Concurrent runs across all active roles"),
  },
  candidate_records: {
    portfolio: value("Unmetered for your roles", "No per-CV charges"),
    program: value("Unmetered for your roles", "No per-CV charges"),
  },
  data_retention: { portfolio: value("3 months"), program: value("3 months") },
  hiring_intelligence: { portfolio: included(), program: included() },
  evidence_graph: { portfolio: included(), program: included() },
  governance: { portfolio: included(), program: included() },
  audit_exports: { portfolio: scoped(), program: scoped() },
  integrations: { portfolio: scoped(), program: scoped() },
  support: { portfolio: scoped(), program: scoped() },
  expert_oversight: { portfolio: value("Included"), program: value("Included") },
  included_results: {
    portfolio: value("Ranked shortlists per role", "All roles run in parallel"),
    program: value("Ranked shortlists per role", "All roles run in parallel"),
  },
};

function toPublicRows(
  rows: EntitlementRow[],
  billing: "oneoff" | "subscription",
): EntitlementRow[] {
  return rows.map((row) => {
    const plans: Record<string, EntitlementValue> = { ...row.plans };
    plans.portfolio = LARGE_PACKAGE_CELLS[row.id].portfolio;
    plans.program = LARGE_PACKAGE_CELLS[row.id].program;
    if (row.id === "active_roles") {
      plans.enterprise = value(SCOPED_PUBLIC_LABEL);
      if (billing === "subscription") {
        // Subscription capacity is the same package, charged monthly.
        plans.growth = value("Up to 10");
        plans.scale = value("Up to 20");
        plans.volume = value("Up to 30");
        plans.pilot = value("1", "Paid once, one pilot per company");
      }
    }
    if (row.id === "included_results") {
      // No cadence claim: the timing we state is the first-shortlist outcome.
      for (const id of ["pilot", "growth", "scale", "volume"]) {
        const v = plans[id];
        if (v?.kind === "value" && v.note === "Refreshed weekly") {
          plans[id] = value(v.label);
        }
      }
      plans.enterprise = value("Ranked shortlists per role", SCOPED_PUBLIC_LABEL);
    }
    return { ...row, plans };
  });
}

/** What the public /pricing comparison shows: every sold package. */
export const PUBLIC_ONEOFF_ENTITLEMENTS: EntitlementRow[] = toPublicRows(
  ONEOFF_ENTITLEMENTS,
  "oneoff",
);
export const PUBLIC_SUBSCRIPTION_ENTITLEMENTS: EntitlementRow[] = toPublicRows(
  SUBSCRIPTION_ENTITLEMENTS,
  "subscription",
);

/** Seats line for a package, read from the table so copy cannot drift from it. */
export function publicSeatsLine(planId: string): string {
  const v = PUBLIC_ONEOFF_ENTITLEMENTS.find((r) => r.id === "workspace_seats")?.plans[planId];
  if (!v || v.kind !== "value") return SCOPED_PUBLIC_LABEL;
  return v.note ? `${v.label}: ${v.note}` : v.label;
}

/** Entitlements awaiting internal commercial confirmation (internal use). */
export function pendingEntitlements(rows: EntitlementRow[]) {
  return rows.flatMap((row) =>
    Object.entries(row.plans)
      .filter(([, v]) => v.kind === "pending")
      .map(([planId, v]) => ({
        row: row.id,
        label: row.label,
        planId,
        reason: (v as { kind: "pending"; reason: string }).reason,
      })),
  );
}
