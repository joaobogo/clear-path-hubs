/**
 * Offline rescore: score matches with this repository's engine outside the
 * app, and write the runs back as SQL that the database verifies.
 *
 * The deployed app can lag the repository (its build is whatever Lovable
 * last published). This produces the same score run executeScoring would
 * write, from the same inputs, so a role can be rescored on the current
 * engine without waiting for a deploy. Each statement is one transaction
 * and refuses to write unless:
 *   - the result and snapshot JSON hash to the values computed here, so a
 *     copy error in transit cannot store a different score;
 *   - the CV text in the database is byte-for-byte the text that was scored;
 *   - the match's published score is not a human-reviewed (human_adjusted)
 *     run, which a machine rescore must never replace or clear.
 * The CV text itself is not carried in the SQL: the database reads it from
 * files.extracted_text when it assembles the run's replay snapshot.
 *
 * Recruiter decisions (eligibility_checks recruiter_review:*) are exported
 * with each match and fed to the engine exactly as the live path does. The
 * SQL never writes, overwrites or deletes them, and refuses to write if they
 * changed after the export (the score was computed against them).
 *
 * Input rows come from the export query in scripts/offline-rescore/export.sql.
 */
import { createHash, randomUUID } from "crypto";
import { scoreCandidate, type RequirementInput, type ScoringResult, type ScreeningAnswer } from "../scoring-engine.server";
import { ENGINE_VERSION } from "./engine-version";
import { EVALUATION_METHOD, parseCalibration, serialiseCalibration } from "./engine-calibration";
import { buildReplaySnapshot } from "./replay";
import { dealbreakerCondition } from "./eligibility";
import { roleContextOf } from "./evidence-sources";
import {
  ENGINE_CHECK_KEY_PREFIXES,
  RECRUITER_REVIEW_KEY_PREFIX,
  engineCheckRows,
  isRecruiterReviewKey,
  resolveScoredEligibility,
  type StoredEligibilityCheck,
} from "./recruiter-review";
import { employmentIntervals } from "../cv/employment-dates";
import { candidateReviewTask } from "../cv/unscored-review";
import { SCORING_BLUEPRINT_VERSION, buildExplanation, reconcile } from "../scoring-service.server";

export type OfflineAnswer = {
  question_id: string;
  answer: unknown;
  q: {
    question?: string | null;
    answer_type?: string | null;
    required?: boolean | null;
    dealbreaker?: boolean | null;
    preferred_answer?: unknown;
    must_have?: string | null;
  } | null;
};

export type OfflineMatch = {
  match_id: string;
  application_id: string;
  candidate_profile_id: string;
  position_id: string;
  organization_id: string;
  eligibility_status: string | null;
  cv_text: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  answers: OfflineAnswer[];
  /** Names the admin task when the match cannot be scored. */
  candidate_name?: string | null;
  /**
   * The match's eligibility_checks rows (qualifier_key, status, evidence).
   * Recruiter decisions among them win over the answers. Optional so an
   * export taken before this field existed still parses; such an export
   * scores as if no recruiter decision existed, and the fingerprint check
   * then refuses the write if one does.
   */
  eligibility_checks?: StoredEligibilityCheck[] | null;
};

export type OfflineContext = {
  position: {
    id: string;
    requirements: unknown;
    preferred_requirements: unknown;
    title?: string | null;
  };
  /** The client, whose own name is not evidence (evidence-sources.ts). */
  organisation?: { name?: string | null; brand_display_name?: string | null } | null;
  rubric: { id: string; calibration: unknown };
  role_family: string | null;
  reason: string;
};

export type OfflineOutcome =
  | { match_id: string; kind: "scored"; final_state: "scored" | "manual_review_required"; score: number; run_id: string; sql: string }
  | {
      match_id: string;
      kind: "no_dated_roles";
      /** Eligibility block, then the incomplete-document marker (clears the current score pointer). */
      sql: string;
      /**
       * The eligibility block alone: the dealbreaker checks, the
       * unverified-claim flags and the eligibility the answers and the
       * recruiter's decisions give. It leaves the score pointer alone, so it
       * can be applied where clearing a reviewed score is not wanted.
       */
      eligibility_sql: string;
      eligibility: "eligible" | "not_eligible" | "excepted";
      unverified_claims: string[];
    }
  | { match_id: string; kind: "skipped"; why: string };

/** Postgres's jsonb text form: keys by length then bytes, ", " and ": " separators. */
export function jsonbText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    const s = JSON.stringify(value);
    if (/e/i.test(s)) throw new Error(`jsonbText: exponent form not supported (${s})`);
    return s;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    if (value.includes("\u0000")) throw new Error("jsonbText: NUL in string");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(", ")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort((a, b) => {
      const ba = Buffer.from(a, "utf8");
      const bb = Buffer.from(b, "utf8");
      return ba.length - bb.length || Buffer.compare(ba, bb);
    });
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${jsonbText((value as Record<string, unknown>)[k])}`).join(", ")}}`;
  }
  throw new Error(`jsonbText: unsupported ${typeof value}`);
}

const md5 = (s: string) => createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");

/**
 * One published score per candidate: a reviewer's verdicts live on a
 * human_adjusted run, and nothing offline replaces or clears it.
 */
function humanReviewedGuard(mid: string, matchId: string, why: string): string {
  return `IF EXISTS (SELECT 1 FROM candidate_matches m JOIN score_runs r ON r.id = m.current_score_run_id WHERE m.id = ${mid} AND r.evaluation_method = 'human_adjusted') THEN RAISE EXCEPTION 'offline rescore ${matchId}: the published score is human-reviewed; ${why}'; END IF;`;
}

/**
 * The recruiter_review rows as one line each, `key=status=question_id`, in
 * key byte order, joined by "|": the same text the generated SQL rebuilds
 * from the table, so a decision added, removed or changed after the export
 * stops the write.
 */
export function recruiterReviewFingerprintText(rows: StoredEligibilityCheck[] | null | undefined): string {
  return (rows ?? [])
    .filter((r) => r && isRecruiterReviewKey(r.qualifier_key))
    .map((r) => {
      const ev = r.evidence;
      const q = ev && typeof ev === "object" && !Array.isArray(ev) ? (ev as Record<string, unknown>).question_id : undefined;
      const qText = q === undefined || q === null ? "" : typeof q === "string" ? q : jsonbText(q);
      return { key: r.qualifier_key, line: `${r.qualifier_key}=${r.status ?? ""}=${qText}` };
    })
    .sort((a, b) => Buffer.compare(Buffer.from(a.key, "utf8"), Buffer.from(b.key, "utf8")))
    .map((x) => x.line)
    .join("|");
}

/** A dollar-quoted literal whose tag does not occur in the text. */
function dollar(text: string, hint: string): string {
  let tag = hint;
  for (let i = 0; text.includes(`$${tag}$`); i++) tag = `${hint}${i}`;
  return `$${tag}$${text}$${tag}$`;
}

const uuid = (s: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(s)) throw new Error(`not a uuid: ${s}`);
  return `'${s}'`;
};

/** The same mapping executeScoring's loadInputs applies. */
function requirementsOf(position: OfflineContext["position"]): RequirementInput[] {
  const reqToText = (r: unknown): string | null => {
    if (typeof r === "string") return r.trim() || null;
    if (r && typeof r === "object") {
      const o = r as { label?: unknown; text?: unknown; name?: unknown; requirement?: unknown };
      const v = o.label ?? o.text ?? o.name ?? o.requirement;
      return typeof v === "string" && v.trim() ? v.trim() : null;
    }
    return null;
  };
  const map = (arr: unknown, prefix: string, required: boolean): RequirementInput[] => {
    if (!Array.isArray(arr)) return [];
    const out: RequirementInput[] = [];
    arr.forEach((t, i) => {
      const text = reqToText(t);
      if (text) out.push({ id: `${prefix}-${i}`, text, required, keywords: [] });
    });
    return out;
  };
  return [...map(position.requirements, "req", true), ...map(position.preferred_requirements, "pref", false)];
}

function screeningOf(answers: OfflineAnswer[]): ScreeningAnswer[] {
  return answers.map((r) => {
    const q = r.q;
    const value = r.answer && typeof r.answer === "object" && "value" in (r.answer as Record<string, unknown>)
      ? (r.answer as { value: unknown }).value
      : r.answer;
    return {
      question_id: r.question_id,
      question: q?.question ?? "",
      required: q?.required ?? false,
      answer_type: q?.answer_type ?? "text",
      value,
      disqualifying_condition: dealbreakerCondition(q as Parameters<typeof dealbreakerCondition>[0]),
      must_have: q?.must_have ?? null,
    } as ScreeningAnswer;
  });
}

const num = (n: number | null | undefined) => (n == null ? "NULL" : String(n));
const text = (s: string | null, tag: string) => (s == null ? "NULL" : dollar(s, tag));

/** Refuse the write when the CV the score was computed from has changed. Needs `cv text` declared. */
function cvGuardSql(m: OfflineMatch, mid: string, cvText: string): string {
  return `  SELECT f.extracted_text INTO cv FROM candidate_matches m JOIN candidate_profiles cp ON cp.id = m.candidate_profile_id JOIN files f ON f.id = cp.current_cv_file_id WHERE m.id = ${mid};
  IF cv IS NULL OR md5(cv) <> '${md5(cvText)}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: CV text changed since export'; END IF;`;
}

/** Refuse the write when the recruiter's decisions changed after the export. */
function recruiterGuardSql(m: OfflineMatch, mid: string): string {
  const reviewPrint = md5(recruiterReviewFingerprintText(m.eligibility_checks));
  return `  IF (SELECT md5(coalesce(string_agg(qualifier_key || '=' || status || '=' || coalesce(evidence->>'question_id', ''), '|' ORDER BY qualifier_key COLLATE "C"), '')) FROM eligibility_checks WHERE candidate_match_id = ${mid} AND starts_with(qualifier_key, ${text(RECRUITER_REVIEW_KEY_PREFIX, "p")})) <> '${reviewPrint}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: recruiter decisions changed since export'; END IF;`;
}

/**
 * The engine's own rows (disq:*, screening_claim_unverified:*) and the
 * clean-up of stale ones. Recruiter rows are never in this list, and the
 * clean-up only reaches these prefixes, so a recruiter_review row survives
 * every rescore untouched.
 */
function engineChecksSql(m: OfflineMatch, mid: string, raw: ScoringResult): string {
  const engineRows = engineCheckRows(raw);
  const checks = engineRows.map((c) =>
    `(${mid}, ${uuid(m.organization_id)}, ${uuid(m.position_id)}, ${text(c.qualifier_key, "k")}, ${text(c.qualifier_label, "q")}, '${c.qualifier_kind}', '${c.status}', ${text(c.reason, "w")}, ${dollar(JSON.stringify(c.evidence), "e")}::jsonb, now())`,
  );
  const keep = engineRows.map((c) => c.qualifier_key);
  const stalePrefixes = ENGINE_CHECK_KEY_PREFIXES.map((p) => `starts_with(qualifier_key, ${text(p, "p")})`).join(" OR ");
  return `${checks.length ? `  INSERT INTO eligibility_checks (candidate_match_id, organization_id, position_id, qualifier_key, qualifier_label, qualifier_kind, status, reason, evidence, updated_at)
  VALUES ${checks.join(",\n    ")}
  ON CONFLICT (candidate_match_id, qualifier_key) DO UPDATE SET qualifier_label = excluded.qualifier_label, qualifier_kind = excluded.qualifier_kind, status = excluded.status, reason = excluded.reason, evidence = excluded.evidence, updated_at = excluded.updated_at;\n` : ""}  DELETE FROM eligibility_checks WHERE candidate_match_id = ${mid} AND (${stalePrefixes})${keep.length ? ` AND qualifier_key NOT IN (${keep.map((k) => text(k, "k")).join(", ")})` : ""};`;
}

/** The audit row for an eligibility change (empty when it does not change). */
function eligibilityAuditSql(
  m: OfflineMatch,
  mid: string,
  decision: ReturnType<typeof resolveScoredEligibility>,
  trace: string,
): string {
  if ((m.eligibility_status ?? null) === decision.status) return "";
  return `  INSERT INTO audit_events (organization_id, entity_type, entity_id, action, before_state, after_state, trace_id)
  VALUES (${uuid(m.organization_id)}, 'candidate_match', ${mid}, 'scoring.eligibility_changed', ${dollar(JSON.stringify({ eligibility_status: m.eligibility_status ?? null }), "b")}::jsonb, ${dollar(JSON.stringify({ eligibility_status: decision.status, position_id: m.position_id, checks: decision.decided_by }), "a")}::jsonb, '${trace}');\n`;
}

export function offlineRescore(
  m: OfflineMatch,
  ctx: OfflineContext,
  ids: { run_id?: string; trace_id?: string } = {},
): OfflineOutcome {
  const cvText = m.cv_text ?? "";
  if (cvText.length < 60) return { match_id: m.match_id, kind: "skipped", why: "cv_unparsed" };
  const mid = uuid(m.match_id);
  const trace = ids.trace_id ?? `sc_off_${randomUUID().slice(0, 8)}${Date.now().toString(36)}`;

  const requirements = requirementsOf(ctx.position);
  const screening = screeningOf(m.answers);
  const calibration = parseCalibration(ctx.rubric?.calibration);
  // The same role context executeScoring's loadInputs builds.
  const roleContext = roleContextOf({
    organisation_name: ctx.organisation?.name ?? null,
    brand_display_name: ctx.organisation?.brand_display_name ?? null,
    role_title: ctx.position.title ?? null,
  });
  const raw = scoreCandidate({
    cv_text: cvText,
    requirements,
    screening,
    candidate_location: [m.location, m.city, m.country].filter(Boolean).join(", ") || null,
    role_context: roleContext,
    calibration,
    eligibility_checks: m.eligibility_checks ?? [],
  });

  if (employmentIntervals(cvText).length === 0) {
    // No run without dated roles (as in executeScoring), but the dealbreaker
    // checks, the unverified-claim flags and the recruiter's decisions still
    // apply to eligibility.
    const decision = resolveScoredEligibility({
      disqualifying_answers: raw.disqualifying_answers,
      eligibility_checks: m.eligibility_checks,
    });
    const task = candidateReviewTask({
      code: "cv_employment_history_missing",
      message:
        "Manual review required - incomplete document. The CV has no dated employment history.",
      candidateName: m.candidate_name ?? null,
      positionTitle: ctx.position.title ?? null,
    });
    const meta = {
      source: "pipeline",
      reason: task.reason,
      final_state: "manual_review_required",
      trace_id: trace,
    };
    const refusalSql = `DO $do$
DECLARE
  cv text;
BEGIN
  SELECT f.extracted_text INTO cv FROM candidate_matches m JOIN candidate_profiles cp ON cp.id = m.candidate_profile_id JOIN files f ON f.id = cp.current_cv_file_id WHERE m.id = ${mid};
  IF cv IS NULL OR md5(cv) <> '${md5(cvText)}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: CV text changed since export'; END IF;
  ${humanReviewedGuard(mid, m.match_id, "an offline refusal never clears it")}
  UPDATE candidate_matches SET current_score_run_id = NULL, processing_state = 'manual_review_required', last_processing_trace_id = '${trace}', processing_error_code = 'cv_employment_history_missing', processing_error_message = 'Manual review required - incomplete document. The CV has no dated employment history.' WHERE id = ${mid};
  INSERT INTO tasks (organization_id, position_id, candidate_match_id, candidate_profile_id, task_type, title, description, priority, status, metadata)
  SELECT m.organization_id, m.position_id, m.id, m.candidate_profile_id, 'candidate_review', ${dollar(task.title, "tt")}, ${dollar(task.description, "td")}, '${task.priority}', 'open', ${dollar(JSON.stringify(meta), "tm")}::jsonb
  FROM candidate_matches m
  WHERE m.id = ${mid} AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.candidate_match_id = m.id AND t.task_type = 'candidate_review' AND t.status IN ('open', 'in_progress') AND t.deleted_at IS NULL);
END $do$;`;
    const eligibility_sql = `DO $do$
DECLARE
  cv text;
BEGIN
${cvGuardSql(m, mid, cvText)}
${recruiterGuardSql(m, mid)}
${engineChecksSql(m, mid, raw)}
  UPDATE candidate_matches SET eligibility_status = '${decision.status}', eligibility_updated_at = now() WHERE id = ${mid};
${eligibilityAuditSql(m, mid, decision, trace)}END $do$;`;
    return {
      match_id: m.match_id,
      kind: "no_dated_roles",
      // The eligibility block, then the refusal: clears the score pointer and
      // opens the admin task once per match, guarded so it never clears a
      // human-reviewed published score.
      sql: `${eligibility_sql}
${refusalSql}`,
      eligibility_sql,
      eligibility: decision.status,
      unverified_claims: raw.unverified_screening_claims.map((c) => c.question_id),
    };
  }
  const rec = reconcile(raw);
  if (!rec.reconciled) return { match_id: m.match_id, kind: "skipped", why: `reconciliation_failed:${rec.mismatch}` };

  const runId = ids.run_id ?? randomUUID();
  const snapshot = buildReplaySnapshot({
    cv_text: cvText,
    requirements,
    screening,
    role_family: ctx.role_family,
    role_context: roleContext,
    recruiter_exceptions: raw.recruiter_exceptions.map((x) => x.question_id),
    reviewed_claims: raw.reviewed_screening_claims,
  });
  const { cv_text: _cv, ...snapshotRest } = snapshot as unknown as Record<string, unknown>;
  void _cv;
  const result = JSON.parse(JSON.stringify({
    ...raw,
    blueprint_version: SCORING_BLUEPRINT_VERSION,
    rubric_version_id: ctx.rubric.id,
    calibration_version: calibration.calibration_version,
    calibration: serialiseCalibration(calibration),
    role_family: ctx.role_family,
    evaluation_method: EVALUATION_METHOD,
    applied_caps: rec.applied_caps,
    reconciliation: {
      raw_computed: rec.raw,
      raw_declared: raw.raw_score,
      final_computed: rec.computed,
      final_declared: raw.score,
      applied_cap: rec.applied_cap,
      cap_reasons: rec.applied_caps.map((c) => c.reason),
      ok: true,
    },
    actor_user_id: null,
    reason: ctx.reason,
    identity: {
      match_id: m.match_id,
      position_id: m.position_id,
      candidate_profile_id: m.candidate_profile_id,
      application_id: m.application_id,
      organization_id: m.organization_id,
    },
  })) as Record<string, unknown>;
  const snap = JSON.parse(JSON.stringify(snapshotRest)) as Record<string, unknown>;

  const decision = resolveScoredEligibility({
    disqualifying_answers: raw.disqualifying_answers,
    eligibility_checks: m.eligibility_checks,
  });
  const eligibility = decision.status;
  const finalState =
    raw.contradiction_status === "disqualifying_answer" || raw.overall_confidence < calibration.manual_review_confidence
      ? "manual_review_required"
      : "scored";
  const explanation = buildExplanation(raw, rec.applied_caps);
  const capReason = rec.applied_caps.length ? rec.applied_caps.map((c) => c.reason).join(" | ") : null;

  const sql = `DO $do$
DECLARE
  r jsonb := ${dollar(JSON.stringify(result), "res")}::jsonb;
  s jsonb := ${dollar(JSON.stringify(snap), "snp")}::jsonb;
  cv text;
BEGIN
  IF md5(r::text) <> '${md5(jsonbText(result))}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: result fingerprint mismatch'; END IF;
  IF md5(s::text) <> '${md5(jsonbText(snap))}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: snapshot fingerprint mismatch'; END IF;
${cvGuardSql(m, mid, cvText)}
${recruiterGuardSql(m, mid)}
  ${humanReviewedGuard(mid, m.match_id, "a machine rescore never replaces it")}
  UPDATE score_runs SET superseded_at = now() WHERE candidate_match_id = ${mid} AND status = 'completed' AND superseded_at IS NULL;
  INSERT INTO score_runs (id, candidate_match_id, position_id, application_id, candidate_profile_id, candidate_submission_id, organization_id,
    blueprint_version, rubric_version_id, raw_score, applied_cap, cap_reason, final_score, evaluation_method, fit_band, engine_version,
    score, confidence, evidence_confidence, status, explanation, evidence, requirement_coverage, started_at, completed_at, trace_id,
    result, fit_label, must_have_coverage, preferred_coverage, contradiction_status, input_hash)
  VALUES (${uuid(runId)}, ${mid}, ${uuid(m.position_id)}, ${uuid(m.application_id)}, ${uuid(m.candidate_profile_id)}, ${uuid(m.application_id)}, ${uuid(m.organization_id)},
    '${SCORING_BLUEPRINT_VERSION}', ${uuid(ctx.rubric.id)}, ${num(raw.raw_score)}, ${num(rec.applied_cap)}, ${text(capReason, "cr")}, ${num(raw.score)}, '${EVALUATION_METHOD}', ${text(raw.fit_label, "fb")}, '${ENGINE_VERSION}',
    ${num(raw.score)}, ${num(raw.overall_confidence)}, ${num(raw.evidence_confidence)}, 'completed', ${text(explanation, "ex")}, r->'evidence',
    jsonb_build_object('must_have', r#>'{category_breakdown,must_have}', 'preferred', r#>'{category_breakdown,preferred}', 'screening_alignment', r#>'{category_breakdown,screening_alignment}', 'category_weights', r->'category_weights', 'requirement_assessment', r->'requirement_assessment'),
    now(), now(), '${trace}',
    r || jsonb_build_object('inputs', s || jsonb_build_object('cv_text', cv)),
    ${text(raw.fit_label, "fl")}, ${num(raw.must_have_coverage)}, ${num(raw.preferred_coverage)}, ${text(raw.contradiction_status, "cs")}, '${raw.input_hash}');
${engineChecksSql(m, mid, raw)}
  UPDATE candidate_matches SET current_score_run_id = ${uuid(runId)}, eligibility_status = '${eligibility}', eligibility_updated_at = now(), evidence_confidence = ${num(raw.evidence_confidence)} WHERE id = ${mid};
${eligibilityAuditSql(m, mid, decision, trace)}  UPDATE candidate_matches SET processing_state = '${finalState}', last_processing_trace_id = '${trace}', processing_error_code = NULL, processing_error_message = NULL WHERE id = ${mid};
  INSERT INTO processing_jobs (entity_type, entity_id, job_type, status, attempts, trace_id, started_at, completed_at) VALUES ('candidate_match', ${mid}, 'score', 'completed', 1, '${trace}', now(), now());
  UPDATE candidate_matches SET score_stale = false, score_stale_reasons = '{}', score_stale_at = NULL, rescore_queued_at = NULL WHERE id = ${mid};
END $do$;`;

  return { match_id: m.match_id, kind: "scored", final_state: finalState, score: raw.score, run_id: runId, sql };
}
