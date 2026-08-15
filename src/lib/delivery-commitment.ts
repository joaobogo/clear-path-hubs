import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
/**
 * What TaaSFlow has actually committed to deliver for one role.
 *
 * Clients email to ask "what happens next, and when?" because the confirmation
 * screen never told them. This module turns a stored `position_commitments` row
 * into that answer — and, crucially, produces nothing when no commitment is
 * stored. A date is either backed by a row attached to this role or it is not
 * shown at all; we never print a placeholder, an estimate, or a range.
 *
 * Pure. No DB access, no formatting of anything we did not read back.
 */

export type StoredCommitment = {
  position_id: string;
  first_shortlist_days: number;
  shortlist_size: number;
  interview_slots_hours: number;
  baseline_at: string;
};

/** Said when no commitment row exists yet. Never paired with a date. */
export const COMMITMENT_PENDING_MESSAGE =
  "Your recruiter confirms dates within one business day.";

export type CommitmentRow = { label: string; value: string };

export type DeliveryCommitment = {
  /** True only when every date shown below came from a stored row. */
  hasCommitment: boolean;
  /** Committed first-shortlist date, or null when nothing is stored. */
  firstShortlistBy: string | null;
  rows: CommitmentRow[];
  /** What we need back from the client, in their own turnaround terms. */
  clientTurnaround: string | null;
  /** Named recruiter, or an honest statement that naming follows. */
  contactLine: string;
  /** Present only when nothing is committed yet. */
  pendingMessage: string | null;
};

export function formatCommitmentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE, weekday: "short", day: "numeric", month: "short" });
}

/** baseline_at + first_shortlist_days, or null when the inputs aren't usable. */
export function firstShortlistDate(commitment: StoredCommitment): string | null {
  const base = Date.parse(commitment.baseline_at);
  const days = Number(commitment.first_shortlist_days);
  if (Number.isNaN(base) || !Number.isFinite(days) || days <= 0) return null;
  return new Date(base + days * 86_400_000).toISOString();
}

function hoursLine(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} working day${days === 1 ? "" : "s"}`;
  }
  return `${hours} hours`;
}

export function buildDeliveryCommitment(input: {
  /** The row read back for THIS role, or null when none is stored. */
  commitment: StoredCommitment | null;
  /** Position the block is rendered for — guards against a mismatched row. */
  positionId: string | null;
  /** Named recruiter for this role, when one is assigned. */
  contactName: string | null;
}): DeliveryCommitment {
  const { commitment, positionId, contactName } = input;

  const contactLine = contactName
    ? `${contactName} is your point of contact for this role.`
    : "Your named recruiter is introduced by email when the role is assigned.";

  const attached =
    commitment && positionId && commitment.position_id === positionId ? commitment : null;
  const shortlistBy = attached ? firstShortlistDate(attached) : null;

  if (!attached || !shortlistBy) {
    return {
      hasCommitment: false,
      firstShortlistBy: null,
      rows: [],
      clientTurnaround: null,
      contactLine,
      pendingMessage: COMMITMENT_PENDING_MESSAGE,
    };
  }

  const size = Number(attached.shortlist_size);
  const slots = hoursLine(Number(attached.interview_slots_hours));

  const rows: CommitmentRow[] = [
    { label: "First shortlist by", value: formatCommitmentDate(shortlistBy) },
    {
      label: "Candidates in that shortlist",
      value: `${size} candidate${size === 1 ? "" : "s"}`,
    },
  ];
  if (slots) rows.push({ label: "Interview slots offered within", value: slots });

  return {
    hasCommitment: true,
    firstShortlistBy: shortlistBy,
    rows,
    clientTurnaround: slots
      ? `Decide on each candidate within ${slots} of delivery, so interviews stay on this schedule.`
      : null,
    contactLine,
    pendingMessage: null,
  };
}
