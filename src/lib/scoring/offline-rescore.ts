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
 *   - the CV text in the database is byte-for-byte the text that was scored.
 * The CV text itself is not carried in the SQL: the database reads it from
 * files.extracted_text when it assembles the run's replay snapshot.
 *
 * Input rows come from the export query in scripts/offline-rescore/export.sql.
 */
import { createHash, randomUUID } from "crypto";
import { scoreCandidate, type RequirementInput, type ScreeningAnswer } from "../scoring-engine.server";
import { ENGINE_VERSION } from "./engine-version";
import { EVALUATION_METHOD, parseCalibration, serialiseCalibration } from "./engine-calibration";
import { buildReplaySnapshot } from "./replay";
import { dealbreakerCondition } from "./eligibility";
import { employmentIntervals } from "../cv/employment-dates";
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
};

export type OfflineContext = {
  position: { id: string; requirements: unknown; preferred_requirements: unknown };
  rubric: { id: string; calibration: unknown };
  role_family: string | null;
  reason: string;
};

export type OfflineOutcome =
  | { match_id: string; kind: "scored"; final_state: "scored" | "manual_review_required"; score: number; run_id: string; sql: string }
  | { match_id: string; kind: "no_dated_roles"; sql: string }
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

export function offlineRescore(
  m: OfflineMatch,
  ctx: OfflineContext,
  ids: { run_id?: string; trace_id?: string } = {},
): OfflineOutcome {
  const cvText = m.cv_text ?? "";
  if (cvText.length < 60) return { match_id: m.match_id, kind: "skipped", why: "cv_unparsed" };
  const mid = uuid(m.match_id);
  const trace = ids.trace_id ?? `sc_off_${randomUUID().slice(0, 8)}${Date.now().toString(36)}`;

  if (employmentIntervals(cvText).length === 0) {
    return {
      match_id: m.match_id,
      kind: "no_dated_roles",
      sql: `UPDATE candidate_matches SET current_score_run_id = NULL, processing_state = 'manual_review_required', last_processing_trace_id = '${trace}', processing_error_code = 'cv_employment_history_missing', processing_error_message = 'Manual review required - incomplete document. The CV has no dated employment history.' WHERE id = ${mid};`,
    };
  }

  const requirements = requirementsOf(ctx.position);
  const screening = screeningOf(m.answers);
  const calibration = parseCalibration(ctx.rubric.calibration);
  const raw = scoreCandidate({
    cv_text: cvText,
    requirements,
    screening,
    candidate_location: [m.location, m.city, m.country].filter(Boolean).join(", ") || null,
    calibration,
  });
  const rec = reconcile(raw);
  if (!rec.reconciled) return { match_id: m.match_id, kind: "skipped", why: `reconciliation_failed:${rec.mismatch}` };

  const runId = ids.run_id ?? randomUUID();
  const snapshot = buildReplaySnapshot({ cv_text: cvText, requirements, screening, role_family: ctx.role_family });
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

  const disq = raw.disqualifying_answers;
  const eligibility = disq.length > 0 ? "not_eligible" : "eligible";
  const finalState =
    raw.contradiction_status === "disqualifying_answer" || raw.overall_confidence < calibration.manual_review_confidence
      ? "manual_review_required"
      : "scored";
  const explanation = buildExplanation(raw, rec.applied_caps);
  const capReason = rec.applied_caps.length ? rec.applied_caps.map((c) => c.reason).join(" | ") : null;
  const num = (n: number | null | undefined) => (n == null ? "NULL" : String(n));
  const text = (s: string | null, tag: string) => (s == null ? "NULL" : dollar(s, tag));

  const checks = disq.map((d) =>
    `(${mid}, ${uuid(m.organization_id)}, ${uuid(m.position_id)}, ${text(`disq:${d.question_id}`, "k")}, ${text(d.question, "q")}, 'disqualifier', 'failed', ${text(`Dealbreaker answer: ${d.normalized_value}`, "w")}, ${dollar(JSON.stringify({ question_id: d.question_id, value: d.normalized_value }), "e")}::jsonb, now())`,
  );
  const keep = disq.map((d) => `disq:${d.question_id}`);

  const sql = `DO $do$
DECLARE
  r jsonb := ${dollar(JSON.stringify(result), "res")}::jsonb;
  s jsonb := ${dollar(JSON.stringify(snap), "snp")}::jsonb;
  cv text;
BEGIN
  IF md5(r::text) <> '${md5(jsonbText(result))}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: result fingerprint mismatch'; END IF;
  IF md5(s::text) <> '${md5(jsonbText(snap))}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: snapshot fingerprint mismatch'; END IF;
  SELECT f.extracted_text INTO cv FROM candidate_matches m JOIN candidate_profiles cp ON cp.id = m.candidate_profile_id JOIN files f ON f.id = cp.current_cv_file_id WHERE m.id = ${mid};
  IF cv IS NULL OR md5(cv) <> '${md5(cvText)}' THEN RAISE EXCEPTION 'offline rescore ${m.match_id}: CV text changed since export'; END IF;
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
${checks.length ? `  INSERT INTO eligibility_checks (candidate_match_id, organization_id, position_id, qualifier_key, qualifier_label, qualifier_kind, status, reason, evidence, updated_at)
  VALUES ${checks.join(",\n    ")}
  ON CONFLICT (candidate_match_id, qualifier_key) DO UPDATE SET qualifier_label = excluded.qualifier_label, qualifier_kind = excluded.qualifier_kind, status = excluded.status, reason = excluded.reason, evidence = excluded.evidence, updated_at = excluded.updated_at;\n` : ""}  DELETE FROM eligibility_checks WHERE candidate_match_id = ${mid} AND qualifier_key LIKE 'disq:%'${keep.length ? ` AND qualifier_key NOT IN (${keep.map((k) => text(k, "k")).join(", ")})` : ""};
  UPDATE candidate_matches SET current_score_run_id = ${uuid(runId)}, eligibility_status = '${eligibility}', eligibility_updated_at = now(), evidence_confidence = ${num(raw.evidence_confidence)} WHERE id = ${mid};
${(m.eligibility_status ?? null) !== eligibility ? `  INSERT INTO audit_events (organization_id, entity_type, entity_id, action, before_state, after_state, trace_id)
  VALUES (${uuid(m.organization_id)}, 'candidate_match', ${mid}, 'scoring.eligibility_changed', ${dollar(JSON.stringify({ eligibility_status: m.eligibility_status ?? null }), "b")}::jsonb, ${dollar(JSON.stringify({ eligibility_status: eligibility, position_id: m.position_id, checks: keep }), "a")}::jsonb, '${trace}');\n` : ""}  UPDATE candidate_matches SET processing_state = '${finalState}', last_processing_trace_id = '${trace}', processing_error_code = NULL, processing_error_message = NULL WHERE id = ${mid};
  INSERT INTO processing_jobs (entity_type, entity_id, job_type, status, attempts, trace_id, started_at, completed_at) VALUES ('candidate_match', ${mid}, 'score', 'completed', 1, '${trace}', now(), now());
  UPDATE candidate_matches SET score_stale = false, score_stale_reasons = '{}', score_stale_at = NULL, rescore_queued_at = NULL WHERE id = ${mid};
END $do$;`;

  return { match_id: m.match_id, kind: "scored", final_state: finalState, score: raw.score, run_id: runId, sql };
}
