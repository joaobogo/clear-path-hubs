export type DealbreakerWarning = {
  label: string;
  uncapped_score: number | null;
};

type PublicationCheck = {
  qualifier_key?: string;
  status?: string;
  evidence?: { publication_override?: { score_run_id?: string; preserve_cap?: boolean; client_warning?: string } };
  eligibility_exceptions?: Array<{ revoked_at?: string | null; expires_at?: string | null }>;
};

/** Only explicitly client-safe, active, run-bound publication exceptions. */
export function clientDealbreakerWarnings(
  row: { admin_status?: string; approved_score_run_id?: string; eligibility_checks?: PublicationCheck[]; score_runs?: { raw_score?: number | string | null } },
  now = Date.now(),
): DealbreakerWarning[] {
  if (row.admin_status !== "approved" || !row.approved_score_run_id) return [];
  return (row.eligibility_checks ?? []).flatMap((check) => {
    const override = check.evidence?.publication_override;
    const active = check.eligibility_exceptions?.some((e) =>
      !e.revoked_at && (!e.expires_at || Date.parse(e.expires_at) > now),
    );
    if (!check.qualifier_key?.startsWith("recruiter_review:") || check.status !== "excepted" ||
      !active || override?.preserve_cap !== true || override.score_run_id !== row.approved_score_run_id ||
      !override.client_warning?.trim()) return [];
    const raw = row.score_runs?.raw_score;
    const score = raw == null ? NaN : Number(raw);
    return [{ label: override.client_warning.trim(), uncapped_score: Number.isFinite(score) ? score : null }];
  });
}

export const CLIENT_PUBLICATION_EXCEPTION_SELECT = `eligibility_checks(qualifier_key,status,evidence,eligibility_exceptions(revoked_at,expires_at))`;