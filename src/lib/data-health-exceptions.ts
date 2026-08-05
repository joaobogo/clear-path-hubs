/**
 * Data health exceptions — shared, pure definitions.
 *
 * An "exception" is a broken record that makes a screen lie or throw:
 * an orphaned score, a match whose position or candidate does not resolve,
 * a tenant mismatch, or a missing / unreadable CV.
 *
 * Ranking is deliberate: anything a client can currently see comes first,
 * then oldest. Nothing here deletes data — repairs are relink / requeue /
 * acknowledge only, and every repair must be previewed before it is applied.
 */

export type DataHealthKind =
  | "scoring_orphan"
  | "match_without_position"
  | "match_without_candidate"
  | "match_org_mismatch"
  | "match_missing_cv"
  | "file_unreadable";

export type DataHealthRepair =
  | "none"
  | "acknowledge_orphan"
  | "realign_match_org"
  | "retry_parse";

export type DataHealthException = {
  /** Stable per-row key: `${kind}:${record_id}`. */
  key: string;
  kind: DataHealthKind;
  /** The record that is broken (orphan row id, match id, or file id). */
  record_id: string;
  record_label: string;
  /** Match that is affected, when one exists — drives hide-from-client. */
  candidate_match_id: string | null;
  candidate_name: string | null;
  position_id: string | null;
  position_title: string | null;
  organization_id: string | null;
  client_name: string | null;
  /** True when a client can see the broken record right now. */
  client_visible: boolean;
  detected_at: string;
  age_days: number;
  detail: string;
  repair: DataHealthRepair;
  is_test_record: boolean;
};

export const KIND_LABEL: Record<DataHealthKind, string> = {
  scoring_orphan: "Orphan score",
  match_without_position: "Match without position",
  match_without_candidate: "Match without candidate",
  match_org_mismatch: "Tenant mismatch",
  match_missing_cv: "Missing CV",
  file_unreadable: "Unreadable CV file",
};

export const KIND_EXPLAINER: Record<DataHealthKind, string> = {
  scoring_orphan: "A score run whose scoring identity does not resolve. Screens show a score with no traceable rubric.",
  match_without_position: "The match points at a position that no longer resolves, so position screens break.",
  match_without_candidate: "The match points at a candidate profile that no longer resolves.",
  match_org_mismatch: "The match and its position belong to different clients — isolation risk.",
  match_missing_cv: "No readable CV file is attached, so evidence and scoring cannot complete.",
  file_unreadable: "The CV file failed upload or text extraction.",
};

export const REPAIR_LABEL: Record<DataHealthRepair, string> = {
  none: "No safe automatic repair",
  acknowledge_orphan: "Acknowledge orphan",
  realign_match_org: "Realign to the position's client",
  retry_parse: "Re-run CV parsing",
};

/** Human description of exactly what a repair will change. Shown before applying. */
export function repairPreviewLines(e: DataHealthException): string[] {
  switch (e.repair) {
    case "acknowledge_orphan":
      return [
        "Mark this orphan record as resolved, with your note and your name attached.",
        "No score run, match, or candidate row is changed or deleted.",
      ];
    case "realign_match_org":
      return [
        `Set the match's client to the position's client (${e.client_name ?? "the position owner"}).`,
        "Visibility is left exactly as it is; no rows are deleted.",
      ];
    case "retry_parse":
      return [
        "Re-run text extraction on the attached CV using the existing pipeline.",
        "A new parse attempt is recorded; earlier attempts and score runs are untouched.",
      ];
    case "none":
    default:
      return [
        "There is no safe automatic repair for this exception.",
        "Open the record to fix it by hand, or hide it from the client while you do.",
      ];
  }
}

/** Client-visible first, then oldest first. */
export function rankExceptions(rows: DataHealthException[]): DataHealthException[] {
  return [...rows].sort((a, b) => {
    if (a.client_visible !== b.client_visible) return a.client_visible ? -1 : 1;
    return new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime();
  });
}

export function ageDays(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
