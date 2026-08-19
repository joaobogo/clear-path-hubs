/**
 * Position publish gate — one shared definition of "why can't this role go live?".
 *
 * The same pure evaluation is used by:
 *  - the server check that runs before a position is activated (setPositionStatus)
 *  - the admin "Publish blockers" list
 *
 * so the list can never disagree with the action. There is no client-side
 * bypass: payment state is read from the row and only cleared by a real payment
 * or an audited exemption.
 */

export type PublishBlocker =
  | "payment_unpaid"
  | "not_approved"
  | "missing_title"
  | "missing_description"
  | "missing_employment_type"
  | "missing_work_model"
  | "missing_seniority"
  | "missing_location"
  | "missing_requirements";

export const PUBLISH_BLOCKER_LABEL: Record<PublishBlocker, string> = {
  payment_unpaid: "Payment not complete",
  not_approved: "Not approved for publishing yet",
  missing_title: "Role title missing",
  missing_description: "Role description too short (80 characters minimum)",
  missing_employment_type: "Employment type missing",
  missing_work_model: "Work model missing",
  missing_seniority: "Seniority missing",
  missing_location: "Location missing (required unless fully remote)",
  missing_requirements: "At least one requirement is needed to score candidates",
};

/** Field on the position edit form that resolves each blocker, when there is one. */
export const PUBLISH_BLOCKER_FIELD: Partial<Record<PublishBlocker, string>> = {
  missing_title: "title",
  missing_description: "description",
  missing_employment_type: "employment_type",
  missing_work_model: "work_model",
  missing_seniority: "seniority",
  missing_location: "location",
  missing_requirements: "requirements",
};

export const PAID_PAYMENT_STATES = ["paid", "exempt", "covered"] as const;

export type PublishGateInput = {
  status: string | null;
  payment_status: string | null;
  approved_at: string | null;
  published_at: string | null;
  title: string | null;
  description: string | null;
  employment_type: string | null;
  work_model: string | null;
  seniority: string | null;
  location: string | null;
  requirements?: unknown;
};

export function isPaymentSatisfied(paymentStatus: string | null | undefined): boolean {
  return (PAID_PAYMENT_STATES as readonly string[]).includes(paymentStatus ?? "unpaid");
}

/** Blockers, in the order a recruiter should resolve them. */
export function evaluatePublishGate(p: PublishGateInput): PublishBlocker[] {
  const blockers: PublishBlocker[] = [];

  if (!isPaymentSatisfied(p.payment_status)) blockers.push("payment_unpaid");

  if (!p.title || p.title.trim().length < 3) blockers.push("missing_title");
  if (!p.description || p.description.trim().length < 80) blockers.push("missing_description");
  if (!p.employment_type) blockers.push("missing_employment_type");
  if (!p.work_model) blockers.push("missing_work_model");
  if (!p.seniority || !p.seniority.trim()) blockers.push("missing_seniority");
  if (p.work_model !== "remote" && !(p.location ?? "").trim()) blockers.push("missing_location");

  const reqs = Array.isArray(p.requirements) ? p.requirements : [];
  if (reqs.length === 0) blockers.push("missing_requirements");

  // Approval is a workflow gate, not a data gate: only mention it once the
  // role is otherwise ready, so the list surfaces the real work first.
  // C6: Explicitly include 'not_approved' if neither published nor approved.
  if (!p.published_at && !p.approved_at && blockers.length === 0) {
    blockers.push("not_approved");
  }

  return blockers;
}

export const PUBLISH_BLOCKED_PREFIX = "publish_blocked: ";

export function publishBlockedMessage(blockers: PublishBlocker[]): string {
  return (
    PUBLISH_BLOCKED_PREFIX +
    blockers.map((b) => PUBLISH_BLOCKER_LABEL[b]).join("; ") +
    ". Resolve these first — publishing is not bypassable."
  );
}

/**
 * Convert a `publish_blocked:` error into an admin-facing human message.
 *
 * Admins must never see client checkout copy ("Your brief is saved as a draft")
 * or raw snake_case tokens. The message matches the actual state: the role stays
 * "under review" / "approved" until payment or an exemption clears.
 */
export function humanizePublishBlockedMessage(message: string): string {
  // P-019: the database payment gate raises client checkout copy ("Your brief is
  // saved as a draft — finish checkout…"). Staff surfaces must read as an admin
  // sentence instead of client-facing instructions they cannot act on.
  if (/cannot be published until payment|can't be published until payment/i.test(message)) {
    return "Approval blocked: payment or exemption required";
  }
  if (message === "position_screening_limit_exceeded") {
    return "Approval blocked: Screening limit reached — raise the limit or archive a run to continue.";
  }
  if (message.startsWith("match_not_found:")) {
    const id = message.split(":")[1];
    return `Approval blocked: Candidate record not found (${id})`;
  }

  if (!message.startsWith(PUBLISH_BLOCKED_PREFIX)) return message;

  const inner = message
    .slice(PUBLISH_BLOCKED_PREFIX.length)
    .replace(". Resolve these first — publishing is not bypassable.", "")
    .trim();

  const hasPayment = inner.includes(PUBLISH_BLOCKER_LABEL.payment_unpaid);
  const hasRequirements = inner.includes(PUBLISH_BLOCKER_LABEL.missing_requirements);
  const hasApproval = inner.includes(PUBLISH_BLOCKER_LABEL.not_approved);

  // P-019: Humanize approval blockers for staff; remove snake_case codes and client-only copy.
  if (hasPayment && hasRequirements) {
    return "Approval blocked: payment or exemption is required, and at least one must-have requirement is needed.";
  }
  if (hasPayment) return "Approval blocked: payment or exemption required";
  if (hasRequirements) return "Approval blocked: add at least one must-have requirement";
  if (hasApproval) return "Approval blocked: not approved for publishing yet";

  // Generic fallback for the remaining data blockers.
  const first = inner.split(";")[0]?.trim();
  if (!first) return "Can't approve this role yet — resolve the blockers first.";
  return `Approval blocked: ${first.toLowerCase()}`;
}



