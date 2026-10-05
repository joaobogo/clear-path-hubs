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
      "Position credits purchased up front. Activate them when roles open; unused credits can roll over instead of expiring at year-end.",
    plans: {
      pilot: value("1 position credit"),
      growth: value("Up to 10 position credits"),
      scale: value("Up to 20 position credits"),
      volume: value("Up to 30 position credits"),
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
      enterprise: value("Included + SSO and security review"),
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
    description: "Email and calendar coordination connected to your workspace.",
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
    description: "Email and calendar coordination connected to your workspace.",
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
    question: "How do prepaid packages work?",
    answer:
      "A prepaid package is a bank of position credits. Buy the capacity up front, then activate each position when you need it rather than opening every role at once. Unused credits can roll over instead of disappearing at year-end. One position means one job opening, not one hire.",
  },
  {
    id: "limits",
    question: "How does subscription capacity work?",
    answer:
      "A subscription is continuous recruiting capacity. You can keep roles moving month after month, rotate in new positions as priorities change, and keep sourcing and pipeline-building active. Nothing is charged beyond the selected package automatically; moving to a larger capacity still requires an agreed plan.",
  },
  {
    id: "billing",
    question: "How often are we billed?",
    answer:
      "The pilot is a one-time $699 first-role engagement. Larger prepaid packages use the published total once for a bank of position credits. Subscription uses the same published capacity bands as a monthly fee for continuous recruiting capacity. Paying twelve subscription months up front saves 10% on the annual total. Exact billing terms on your quote remain the authority.",
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
      "Published plans include three months of access to candidate records and evidence in your workspace. Longer retention and specific data-residency requirements are set on enterprise agreements. You keep the candidates the platform surfaced — there are no placement fees or salary percentages.",
  },
  {
    id: "oversight",
    question: "Do plans include expert oversight?",
    answer:
      "Yes. Every plan includes human review of agent output before candidates reach your decision queue, plus calibration when your criteria shift. Higher bands add priority calibration and a named account structure. This is governance over the system's output — it is included in the plan, not billed as hours.",
  },
];

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
