/**
 * Integrity checks required before a candidate_match may become
 * client-visible. Mirrors the DB trigger tg_candidate_matches_publish_gate,
 * but usable from server functions to compute a UI-friendly checklist.
 */

export type PublishReadiness = {
  ok: boolean;
  checks: Array<{ id: string; label: string; ok: boolean; detail?: string }>;
};

type MatchLike = {
  approved_score_run_id: string | null;
  canonical_state: string;
  integrity_status: string;
  eligibility_status: string;
  recommendation: string;
};

type ScoreRunLike = {
  status: string;
  rubric_version_id: string | null;
  contradiction_status: string | null;
  final_score: number | null;
  applied_cap: number | null;
  raw_score: number | null;
} | null;

export function computePublishReadiness(
  match: MatchLike,
  run: ScoreRunLike,
  requiredEvidenceOk: boolean,
): PublishReadiness {
  const checks = [
    {
      id: 'approved_run',
      label: 'Approved score run pinned',
      ok: Boolean(match.approved_score_run_id),
    },
    {
      id: 'canonical',
      label: 'Canonical state is "approved" or "published"',
      ok: ['approved', 'published_to_client'].includes(match.canonical_state),
    },
    {
      id: 'integrity',
      label: 'Integrity checks pass',
      ok: match.integrity_status === 'ok',
      detail: match.integrity_status !== 'ok' ? match.integrity_status : undefined,
    },
    {
      id: 'evidence_required',
      label: 'All required criteria have valid evidence',
      ok: requiredEvidenceOk,
    },
    {
      id: 'run_completed',
      label: 'Score run completed',
      ok: run?.status === 'completed',
    },
    {
      id: 'rubric_pinned',
      label: 'Score run linked to a rubric version',
      ok: Boolean(run?.rubric_version_id),
    },
    {
      id: 'no_disqualifying_contradiction',
      label: 'No disqualifying contradictions',
      ok: run?.contradiction_status !== 'disqualifying_answer',
    },
    {
      id: 'math_invariant',
      label: 'Score math invariant (final ≤ cap ≤ raw)',
      ok:
        run == null
          ? true
          : (run.final_score ?? 0) <= (run.applied_cap ?? Infinity) &&
            (run.final_score ?? 0) <= (run.raw_score ?? Infinity),
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}
