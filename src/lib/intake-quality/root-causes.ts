/**
 * Intake quality: one view over the two queues that share root causes.
 *
 * Parse failures and evidence gaps are symptoms, not causes. A missing text
 * layer and "CV arrived, application never created" are different rows in
 * different queues but both mean the same thing to whoever has to act on them.
 * This module folds both queues into root-cause groups with one next action and
 * one accountable owner each.
 */

export type IntakeOwner = "engineering" | "recruiter" | "candidate";

export type IntakeQualityItem = {
  key: string;
  source: "parse_failure" | "evidence_gap";
  candidate_name: string | null;
  reference: string | null;
  position_title: string | null;
  client_name: string | null;
  detail: string | null;
  first_seen: string;
  /** Deep link to the record where the action happens. */
  link_path: string | null;
};

export type RootCauseGroup = {
  cause_code: string;
  cause_label: string;
  /** What actually happened, one sentence. */
  cause: string;
  next_action: string;
  owner: IntakeOwner;
  /** True when the candidate did their part and we still failed. */
  our_fault: boolean;
  /** True when what the candidate was told hid the real cause. */
  misinformed: boolean;
  items: IntakeQualityItem[];
};

export type IntakeQualitySummary = {
  groups: RootCauseGroup[];
  total_items: number;
  our_fault_items: number;
  misinformed_items: number;
  parse_failures: number;
  evidence_gaps: number;
};

/**
 * Root-cause families. Both queues map into these, so overlapping causes stop
 * being two separate backlogs.
 */
const FAMILY: Record<string, { code: string; label: string }> = {
  text_layer_missing: { code: "unreadable_document", label: "Document carries no readable text" },
  scanned_image: { code: "unreadable_document", label: "Document carries no readable text" },
  ocr_failed: { code: "unreadable_document", label: "Document carries no readable text" },
  encrypted: { code: "blocked_document", label: "Document is locked or protected" },
  password_protected: { code: "blocked_document", label: "Document is locked or protected" },
  corrupt: { code: "broken_upload", label: "Upload arrived incomplete or broken" },
  upload_without_application: {
    code: "pipeline_did_not_finish",
    label: "Our pipeline stopped part-way",
  },
  duplicate_orphan_upload: {
    code: "pipeline_did_not_finish",
    label: "Our pipeline stopped part-way",
  },
  processing_stalled: { code: "pipeline_did_not_finish", label: "Our pipeline stopped part-way" },
};

function family(code: string, fallbackLabel: string) {
  return FAMILY[code] ?? { code: `other_${code}`, label: fallbackLabel };
}

type ParseRow = {
  file_id: string;
  filename: string;
  candidate_name: string | null;
  candidate_profile_id: string | null;
  match_id: string | null;
  position_title: string | null;
  client_name: string | null;
  uploaded_at: string;
  detail: string | null;
  failure: {
    code: string;
    label: string;
    cause: string;
    nextAction: string;
    owner: IntakeOwner;
    candidateMessage: string | null;
  };
};

type GapRow = {
  key: string;
  candidate_name: string | null;
  reference: string | null;
  position_title: string | null;
  match_id: string | null;
  first_seen: string;
  link_path: string | null;
  reason: {
    code: string;
    label: string;
    cause: string;
    nextAction: string;
    owner: IntakeOwner;
    ourFault: boolean;
    candidateWasTold: "nothing" | "generic" | "specific";
  };
};

export function buildIntakeQuality(args: {
  parseFailures: ParseRow[];
  evidenceGaps: GapRow[];
}): IntakeQualitySummary {
  const groups = new Map<string, RootCauseGroup>();

  const ensure = (
    key: string,
    seed: Omit<RootCauseGroup, "items">,
  ): RootCauseGroup => {
    const existing = groups.get(key);
    if (existing) return existing;
    const created: RootCauseGroup = { ...seed, items: [] };
    groups.set(key, created);
    return created;
  };

  for (const row of args.parseFailures) {
    const fam = family(row.failure.code, row.failure.label);
    const group = ensure(fam.code, {
      cause_code: fam.code,
      cause_label: fam.label,
      cause: row.failure.cause,
      next_action: row.failure.nextAction,
      owner: row.failure.owner,
      our_fault: row.failure.owner === "engineering",
      misinformed: row.failure.candidateMessage === null && row.failure.owner === "candidate",
    });
    group.items.push({
      key: `pf:${row.file_id}:${row.match_id ?? "none"}`,
      source: "parse_failure",
      candidate_name: row.candidate_name,
      reference: null,
      position_title: row.position_title,
      client_name: row.client_name,
      detail: row.detail ?? row.filename,
      first_seen: row.uploaded_at,
      link_path: row.match_id ? `/admin/candidates/${row.match_id}` : null,
    });
  }

  for (const row of args.evidenceGaps) {
    const fam = family(row.reason.code, row.reason.label);
    const group = ensure(fam.code, {
      cause_code: fam.code,
      cause_label: fam.label,
      cause: row.reason.cause,
      next_action: row.reason.nextAction,
      owner: row.reason.owner,
      our_fault: row.reason.ourFault,
      misinformed: row.reason.candidateWasTold !== "specific",
    });
    group.our_fault = group.our_fault || row.reason.ourFault;
    group.misinformed = group.misinformed || row.reason.candidateWasTold !== "specific";
    group.items.push({
      key: `eg:${row.key}`,
      source: "evidence_gap",
      candidate_name: row.candidate_name,
      reference: row.reference,
      position_title: row.position_title,
      client_name: null,
      detail: row.reason.label,
      first_seen: row.first_seen,
      link_path: row.link_path ?? (row.match_id ? `/admin/candidates/${row.match_id}` : null),
    });
  }

  const list = Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length);
  for (const g of list) g.items.sort((x, y) => x.first_seen.localeCompare(y.first_seen));

  const total = list.reduce((sum, g) => sum + g.items.length, 0);
  return {
    groups: list,
    total_items: total,
    our_fault_items: list.filter((g) => g.our_fault).reduce((s, g) => s + g.items.length, 0),
    misinformed_items: list.filter((g) => g.misinformed).reduce((s, g) => s + g.items.length, 0),
    parse_failures: args.parseFailures.length,
    evidence_gaps: args.evidenceGaps.length,
  };
}
