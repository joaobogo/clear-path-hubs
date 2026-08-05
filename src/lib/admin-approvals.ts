/**
 * Approvals inbox — pure types and helpers.
 *
 * Four kinds of pending decision, each backed by real state (never a synthetic
 * "pending" flag):
 *  • candidate_visible — the match passed admin review but is still hidden from
 *    the client. Approving runs the canonical `approve_candidate_match` path.
 *  • contact_release   — the client asked for direct contact details
 *    (`client_decisions.decision = 'request_contact_release'`) and the match
 *    has no `contact_released_at` yet.
 *  • shortlist_share   — an active share link contains candidates that are not
 *    client-visible, so the share cannot show them until they are approved.
 *  • publish_position  — the requisition is submitted/under review/approved but
 *    has never been published.
 */

export const APPROVAL_KINDS = [
  "candidate_visible",
  "contact_release",
  "shortlist_share",
  "publish_position",
] as const;

export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  candidate_visible: "Candidate visible to client",
  contact_release: "Contact released",
  shortlist_share: "Shortlist share",
  publish_position: "Publish position",
};

export const APPROVAL_KIND_BLURB: Record<ApprovalKind, string> = {
  candidate_visible:
    "Passed admin review, still hidden from the client. Approving publishes through the same gate as the Publish Desk.",
  contact_release:
    "The client requested direct contact details for a candidate they can already see.",
  shortlist_share:
    "An active share link includes candidates who are not client-visible yet.",
  publish_position: "A requisition is waiting to go live.",
};

export type ApprovalItem = {
  id: string;
  kind: ApprovalKind;
  /** Row the decision writes to. */
  target_type: "candidate_match" | "position" | "shortlist_share";
  target_id: string;
  target_label: string;
  /** Secondary line: position title, share title, etc. */
  context_label: string | null;
  organization_id: string | null;
  org_name: string | null;
  position_id: string | null;
  position_title: string | null;
  requester_name: string | null;
  requested_at: string;
  age_days: number;
  /** Matches that must become visible for this item to clear (share rollups). */
  match_ids: string[];
  /** Server-side reasons the approve action will fail; empty means clear. */
  blockers: string[];
  link: string | null;
};

export type ApprovalGroup = {
  kind: ApprovalKind;
  label: string;
  blurb: string;
  items: ApprovalItem[];
};

export type ApprovalsPayload = {
  groups: ApprovalGroup[];
  total: number;
  include_test: boolean;
  generated_at: string;
};

const DAY = 86_400_000;

export function ageDays(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY));
}

export type AgeTier = "fresh" | "watch" | "overdue";

/** 0–1 day fresh, 2–3 days watch, 4+ overdue. */
export function ageTier(days: number): AgeTier {
  if (days >= 4) return "overdue";
  if (days >= 2) return "watch";
  return "fresh";
}

export const AGE_TIER_LABEL: Record<AgeTier, string> = {
  fresh: "New",
  watch: "Waiting",
  overdue: "Overdue",
};

export function ageLabel(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

/** Bulk approve is only legal inside one position — never across clients. */
export function bulkEligible(items: ApprovalItem[]): boolean {
  if (items.length < 2) return false;
  const positions = new Set(items.map((i) => i.position_id ?? ""));
  const orgs = new Set(items.map((i) => i.organization_id ?? ""));
  return (
    positions.size === 1 &&
    !positions.has("") &&
    orgs.size === 1 &&
    items.every((i) => i.kind === items[0]!.kind && i.blockers.length === 0)
  );
}

export function groupApprovals(items: ApprovalItem[]): ApprovalGroup[] {
  return APPROVAL_KINDS.map((kind) => ({
    kind,
    label: APPROVAL_KIND_LABEL[kind],
    blurb: APPROVAL_KIND_BLURB[kind],
    items: items
      .filter((i) => i.kind === kind)
      .sort((a, b) => b.age_days - a.age_days || a.target_label.localeCompare(b.target_label)),
  })).filter((g) => g.items.length > 0);
}

/** Decline always needs a written reason; approve does not. */
export const MIN_DECLINE_REASON = 10;
