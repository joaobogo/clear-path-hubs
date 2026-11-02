/**
 * Pins migration 0013 (recompute_screening_eligibility honours recruiter
 * decisions) to the TypeScript rules in recruiter-review.ts and
 * screening-eligibility.ts, so the database writer and the app writers cannot
 * drift apart on what a recruiter_review row means.
 *
 * Behaviour was also checked against a local Postgres 16 (see the migration's
 * header); this test keeps the text honest in CI, where no database runs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ENGINE_CHECK_KEY_PREFIXES,
  RECRUITER_REVIEW_KEY_PREFIX,
  recruiterReviewQuestionId,
} from "../recruiter-review";

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8").replace(/\r\n/g, "\n");
const sql = read("drizzle/migrations/0013_recompute_eligibility_honours_recruiter_review.sql");
/** The function body without comments. */
const code = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("migration 0013: recompute_screening_eligibility reads recruiter decisions", () => {
  it("keeps the signature the app calls (no type regeneration needed)", () => {
    expect(code).toContain("CREATE OR REPLACE FUNCTION public.recompute_screening_eligibility(\n  p_position_id uuid DEFAULT NULL,\n  p_apply boolean DEFAULT false\n)");
    expect(code).toMatch(/RETURNS TABLE \(\n  match_id uuid,\n  position_id uuid,\n  eligibility_before text,\n  eligibility_after text,\n  failed_dealbreakers text\[\],\n  applied boolean\n\)/);
    expect(code).toContain("GRANT EXECUTE ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) TO service_role;");
    expect(code).toContain("REVOKE ALL ON FUNCTION public.recompute_screening_eligibility(uuid, boolean) FROM anon, authenticated;");
  });

  it("resolves the question as recruiterReviewQuestionId does: a string evidence.question_id, else the key suffix", () => {
    expect(code).toContain("WHERE c.qualifier_key LIKE 'recruiter_review:%'");
    expect(code).toContain("CASE WHEN jsonb_typeof(c.evidence -> 'question_id') = 'string'");
    expect(code).toContain("substr(c.qualifier_key, length('recruiter_review:') + 1)");
    expect(RECRUITER_REVIEW_KEY_PREFIX).toBe("recruiter_review:");
    expect(recruiterReviewQuestionId({ qualifier_key: "recruiter_review:q-1", evidence: [] })).toBe("q-1");
    expect(recruiterReviewQuestionId({ qualifier_key: "recruiter_review:x", evidence: { question_id: "q-2" } })).toBe("q-2");
  });

  it("'excepted' and 'passed' lift the answer; 'failed' forces not_eligible; 'unknown' is no decision", () => {
    expect(code).toContain("AND c.status IN ('excepted', 'passed', 'failed')");
    expect(code).toMatch(/NOT EXISTS \(\s*SELECT 1 FROM decisions d\s*WHERE d\.m_id = a\.m_id AND d\.status IN \('excepted', 'passed'\) AND d\.q_id = a\.q_id::text/);
    expect(code).toMatch(/IF r\.recruiter_failed AND r\.before_status <> 'not_eligible' THEN\s*-?-?[^\n]*\n\s*next_status := 'not_eligible';/);
    expect(code).toContain("next_status := CASE WHEN r.recruiter_excepted THEN 'excepted' ELSE 'eligible' END;");
    // A failed check the engine does not own holds a not_eligible match.
    expect(code).toContain("ELSIF r.before_status = 'not_eligible' AND cardinality(r.failed) = 0 AND NOT r.held THEN");
    for (const prefix of ENGINE_CHECK_KEY_PREFIXES) expect(code).toContain(`AND c.qualifier_key NOT LIKE '${prefix}%'`);
  });

  it("never updates or deletes an eligibility_checks row; only inserts missing disq: rows", () => {
    expect(code).not.toMatch(/UPDATE\s+public\.eligibility_checks/i);
    expect(code).not.toMatch(/DELETE\s+FROM\s+public\.eligibility_checks/i);
    expect(code).toContain("ON CONFLICT (candidate_match_id, qualifier_key) DO NOTHING;");
    const inserted = code.match(/INSERT INTO public\.eligibility_checks[\s\S]*?ON CONFLICT/g) ?? [];
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toContain("'disq:' || (x ->> 'q_id')");
    // Nothing here approves, publishes or moves a candidate.
    expect(code).not.toMatch(/admin_status|client_visibility|\bstage\b|score_runs/);
  });

  it("is registered as journal idx 13 with a chained snapshot", () => {
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries.find((e) => e.idx === 13)?.tag).toBe("0013_recompute_eligibility_honours_recruiter_review");
    const snap = JSON.parse(read("drizzle/migrations/meta/0013_snapshot.json")) as { id: string; prevId: string; dialect: string };
    expect(snap.dialect).toBe("postgresql");
    // 0012 (reviewed verdicts honour recruiter exceptions) is on main.
    expect(snap.prevId).toBe("1071c33a-2d3b-4b64-9a97-d4dbb9c8fdef");
    expect(snap.id).not.toBe(snap.prevId);
  });
});
