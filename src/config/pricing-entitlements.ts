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

/** One-off package plans (Pilot / Multi / Sprint / Custom). */
export const ONEOFF_PLAN_IDS = ["pilot", "multi", "sprint", "enterprise"] as const;
export const ONEOFF_PLAN_LABELS: Record<string, string> = {
  pilot: "Pilot",
  multi: "Multi Role",
  sprint: "Hiring Sprint",
  enterprise: "Custom",
};

/** Subscription plans (Bronze / Silver / Gold / Enterprise). */
export const SUBSCRIPTION_PLAN_IDS = ["bronze", "silver", "gold", "enterprise"] as const;
export const SUBSCRIPTION_PLAN_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  enterprise: "Enterprise",
};

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
      multi: value("2–5"),
      sprint: value("6–10"),
      enterprise: value("Scoped", "Set with your plan"),
    },
  },
  {
    id: "workspace_seats",
    label: "Workspace seats",
    description: "People in your organisation with their own login to the workspace.",
    plans: {
      pilot: value("2 seats", "1 owner + 1 recruiter"),
      multi: value("4 seats", "1 owner + 3 recruiters"),
      sprint: value("6 seats", "1 owner + 5 recruiters"),
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
      multi: value("Full agent layer", "Scoped to your active roles"),
      sprint: value("Full agent layer", "Concurrent runs across all active roles"),
      enterprise: value("Full agent layer", "Capacity planned with your plan"),
    },
  },
  {
    id: "candidate_records",
    label: "Candidate records",
    description: "Candidate profiles, evidence and scores stored in your workspace.",
    plans: {
      pilot: value("Unmetered for your roles", "No per-CV charges"),
      multi: value("Unmetered for your roles", "No per-CV charges"),
      sprint: value("Unmetered for your roles", "No per-CV charges"),
      enterprise: value("Unmetered for your roles", "No per-CV charges"),
    },
  },
  {
    id: "data_retention",
    label: "Data retention",
    description: "How long candidate records and evidence stay accessible in your workspace.",
    plans: {
      pilot: value("3 months"),
      multi: value("3 months"),
      sprint: value("3 months"),
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
      multi: included(),
      sprint: included(),
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
      multi: included(),
      sprint: included(),
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
      multi: included(),
      sprint: included(),
      enterprise: value("Included + SSO and security review"),
    },
  },
  {
    id: "audit_exports",
    label: "Audit exports",
    description: "Exportable record of decisions, scores and evidence for internal review.",
    plans: {
      pilot: pending("Export entitlement scope per plan not defined commercially"),
      multi: pending("Export entitlement scope per plan not defined commercially"),
      sprint: pending("Export entitlement scope per plan not defined commercially"),
      enterprise: value("Scoped", "Agreed in your reporting requirements"),
    },
  },
  {
    id: "integrations",
    label: "Integration access",
    description: "Email and calendar coordination connected to your workspace.",
    plans: {
      pilot: pending("Per-plan integration entitlements not defined commercially"),
      multi: pending("Per-plan integration entitlements not defined commercially"),
      sprint: pending("Per-plan integration entitlements not defined commercially"),
      enterprise: value("Scoped", "Reviewed with your IT and security teams"),
    },
  },
  {
    id: "support",
    label: "Support level",
    description: "How you reach us and how quickly we respond.",
    plans: {
      pilot: value("Standard support"),
      multi: value("Standard support"),
      sprint: value("Priority support"),
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
      multi: value("Included"),
      sprint: value("Included + priority calibration"),
      enterprise: value("Included + dedicated account structure"),
    },
  },
  {
    id: "included_results",
    label: "Included results",
    description: "What the platform produces for each active role.",
    plans: {
      pilot: value("Ranked, evidence-backed shortlists", "Refreshed weekly"),
      multi: value("Ranked shortlists per role", "All roles run in parallel"),
      sprint: value("Ranked shortlists per role", "All roles run in parallel"),
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
      bronze: value("Up to 15 per month"),
      silver: value("16–30 per month"),
      gold: value("31–50 per month"),
      enterprise: value("50+ per month", "Scoped to your plan"),
    },
  },
  {
    id: "workspace_seats",
    label: "Workspace seats",
    description: "People in your organisation with their own login to the workspace.",
    plans: {
      bronze: value("4 seats", "1 owner + 3 recruiters"),
      silver: value("6 seats", "1 owner + 5 recruiters"),
      gold: value("11 seats", "1 owner + 10 recruiters"),
      enterprise: value("Scoped", "Agreed during procurement"),
    },
  },
  {
    id: "agent_capacity",
    label: "Agent capacity",
    description:
      "Intake, blueprint, discovery, evidence and scoring agent runs available to your roles.",
    plans: {
      bronze: value("Full agent layer", "Within your monthly role band"),
      silver: value("Full agent layer", "Faster calibration cycles"),
      gold: value("Full agent layer", "Highest concurrency in the published bands"),
      enterprise: value("Full agent layer", "Capacity planned with your plan"),
    },
  },
  {
    id: "candidate_records",
    label: "Candidate records",
    description: "Candidate profiles, evidence and scores stored in your workspace.",
    plans: {
      bronze: value("Unmetered for your roles", "No per-CV charges"),
      silver: value("Unmetered for your roles", "No per-CV charges"),
      gold: value("Unmetered for your roles", "No per-CV charges"),
      enterprise: value("Unmetered for your roles", "No per-CV charges"),
    },
  },
  {
    id: "data_retention",
    label: "Data retention",
    description: "How long candidate records and evidence stay accessible in your workspace.",
    plans: {
      bronze: value("3 months"),
      silver: value("3 months"),
      gold: value("3 months"),
      enterprise: value("Custom", "Including data-residency requirements"),
    },
  },
  {
    id: "hiring_intelligence",
    label: "Hiring Intelligence",
    description:
      "Pipeline health, speed, score distribution and dropout analysis across your roles.",
    plans: {
      bronze: included(),
      silver: included(),
      gold: value("Included + custom reporting"),
      enterprise: value("Included + strategic planning sessions"),
    },
  },
  {
    id: "evidence_graph",
    label: "Evidence Graph access",
    description: "Every score traced to the findings behind it, per candidate and requirement.",
    plans: {
      bronze: included(),
      silver: included(),
      gold: included(),
      enterprise: included(),
    },
  },
  {
    id: "governance",
    label: "Governance controls",
    description:
      "Approval gates, contact-release permissions and role-based access across your team.",
    plans: {
      bronze: included(),
      silver: included(),
      gold: included(),
      enterprise: value("Included + security review"),
    },
  },
  {
    id: "audit_exports",
    label: "Audit exports",
    description: "Exportable record of decisions, scores and evidence for internal review.",
    plans: {
      bronze: pending("Export entitlement scope per plan not defined commercially"),
      silver: pending("Export entitlement scope per plan not defined commercially"),
      gold: value("Included with custom reporting"),
      enterprise: value("Scoped", "Agreed in your reporting requirements"),
    },
  },
  {
    id: "integrations",
    label: "Integration access",
    description: "Email and calendar coordination connected to your workspace.",
    plans: {
      bronze: pending("Per-plan integration entitlements not defined commercially"),
      silver: pending("Per-plan integration entitlements not defined commercially"),
      gold: pending("Per-plan integration entitlements not defined commercially"),
      enterprise: value("Scoped", "Reviewed with your IT and security teams"),
    },
  },
  {
    id: "support",
    label: "Support level",
    description: "How you reach us and how quickly we respond.",
    plans: {
      bronze: value("Dedicated support"),
      silver: value("Priority support"),
      gold: value("Dedicated account manager"),
      enterprise: value("White-glove onboarding", "Strategic planning sessions"),
    },
  },
  {
    id: "expert_oversight",
    label: "Expert oversight",
    description: "Human review of agent output before candidates reach your decision queue.",
    plans: {
      bronze: value("Included"),
      silver: value("Included + faster calibration"),
      gold: value("Included + named account manager"),
      enterprise: value("Included + strategic reviews"),
    },
  },
  {
    id: "included_results",
    label: "Included results",
    description: "What the platform produces for each active role.",
    plans: {
      bronze: value("Ranked, evidence-backed shortlists", "Refreshed weekly"),
      silver: value("Ranked shortlists per role", "Refreshed weekly"),
      gold: value("Ranked shortlists per role", "Refreshed weekly"),
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
      "Nothing breaks and nothing is charged automatically. When you reach your active-role entitlement, new roles queue as drafts in the workspace until a role closes or you move to the next band. We will tell you which roles are counting and what your options are before anything changes.",
  },
  {
    id: "billing",
    question: "How often are we billed?",
    answer:
      "One-off packages are a single flat fee for the scoped roles. Subscription plans are billed monthly at the start of the month. Annual commitment saves 10%, applied on your invoice. Exact billing terms for your plan are on your quote — nothing on this page changes what you agreed.",
  },
  {
    id: "upgrade",
    question: "How does the upgrade path work?",
    answer:
      "Move to a higher band at the next billing cycle. Your workspace, intake context, evidence, scores and candidate records carry over — you do not start again. Downgrades work the same way.",
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
