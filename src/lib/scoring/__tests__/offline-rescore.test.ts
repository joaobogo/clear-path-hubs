import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jsonbText, offlineRescore, type OfflineContext, type OfflineMatch } from "../offline-rescore";
import { ENGINE_VERSION } from "../engine-version";
import { CAREER_OVERVIEW_CV, DETACHED_HEADINGS_CV } from "@tests/fixtures/cv/hughes-unscored";

const ctx: OfflineContext = {
  position: {
    id: "228cd1ec-1ec1-4205-828c-7a92b1be42e1",
    requirements: [
      { label: "Hands-on marketing experience in at least one of: South Korea, Japan, Singapore, Hong Kong, China or Vietnam" },
      { label: "10 or more years of progressive marketing experience" },
    ],
    preferred_requirements: [{ label: "Arabic language skills" }],
  },
  rubric: { id: "05267eed-5042-41b1-aa25-e8fd165b7ea2", calibration: {} },
  role_family: null,
  reason: "test",
};

const match = (cv: string): OfflineMatch => ({
  match_id: "dd7f35f1-7dae-40ec-870e-a8d2fed5d448",
  application_id: "3bfa31dc-91f7-4d42-b332-a7719f75e0cd",
  candidate_profile_id: "07e94312-81fd-4f0c-9d2d-582d42fb31a9",
  position_id: ctx.position.id,
  organization_id: "1def8e51-d266-48a4-8829-065d0201b447",
  eligibility_status: "eligible",
  cv_text: cv,
  location: "Dubai",
  city: "Dubai",
  country: "United Arab Emirates",
  answers: [
    {
      question_id: "ebb353f2-fc97-41a5-ac7a-2af8bde8fba6",
      answer: { value: false },
      q: { question: "Are you fluent in professional business Arabic?", answer_type: "boolean", required: true, dealbreaker: false },
    },
  ],
});

const CV = [
  "Professional Experience",
  "Group Marketing Director, Damas Jewellery, Dubai Jan 2015 – Mar 2025",
  "Lead the regional marketing strategy of international brands: Graff Dubai, Mikomoto UAE, Queelin UAE.",
  "Marketing Manager, ABC Group, Beirut Feb 2005 – Dec 2014",
].join("\n");

describe("jsonbText", () => {
  it("orders keys as Postgres jsonb does: by length, then bytes", () => {
    expect(jsonbText({ bb: 1, a: [true, null, "x\n"], c: { z: 0.5 } })).toBe('{"a": [true, null, "x\\n"], "c": {"z": 0.5}, "bb": 1}');
  });
});

describe("offlineRescore", () => {
  it("writes one guarded transaction on the current engine without carrying the CV text", () => {
    const out = offlineRescore(match(CV), ctx, { run_id: "11111111-1111-4111-8111-111111111111", trace_id: "sc_test" });
    expect(out.kind).toBe("scored");
    if (out.kind !== "scored") return;
    expect(out.sql).toMatch(/^DO \$do\$/);
    expect(out.sql).toContain(`'${ENGINE_VERSION}'`);
    expect(out.sql).toMatch(/md5\(r::text\) <> '[0-9a-f]{32}'/);
    expect(out.sql).toMatch(/md5\(cv\) <> '[0-9a-f]{32}'/);
    // Evidence quotes are part of the result; the whole CV is not.
    expect(out.sql).not.toContain(JSON.stringify(CV).slice(1, -1));
    expect(out.sql).toContain("'eligible'");
  });

  it("credits the brand from a named market on the engine it ships with", () => {
    const out = offlineRescore(match(CV), ctx);
    expect(out.kind).toBe("scored");
    if (out.kind !== "scored") return;
    expect(out.sql).toMatch(/Mikomoto \(Japan\)/);
  });

  it("sends a CV with no dated roles to manual review and a missing CV is skipped", () => {
    expect(offlineRescore(match("A cover letter about my marketing career and my passion for brands and retail."), ctx).kind).toBe("no_dated_roles");
    expect(offlineRescore(match(""), ctx)).toMatchObject({ kind: "skipped", why: "cv_unparsed" });
  });
});

describe("Mushroom Harvesting Manager: the two applicants never scored (owner item 6a)", () => {
  const hughes: OfflineContext = {
    position: {
      id: "9466d8ac-0b74-4b14-94e9-0e9d56021fa2",
      title: "Mushroom Harvesting Manager",
      requirements: [
        { label: "Hands-on mushroom picking experience" },
        { label: "Previous supervisory experience on a mushroom farm" },
        { label: "Strong people management and communication skills, written and verbal" },
        { label: "Excellent organisational and interpersonal skills" },
        { label: "Good basic IT and numerical skills" },
        { label: "Flexible approach to working hours, including weekends and peak overtime" },
      ],
      preferred_requirements: [
        { label: "Previous experience as a Harvesting Manager in the mushroom industry" },
        { label: "Experience managing pick rates, manning plans and agency labour" },
        { label: "Food safety team experience (HACCP, TACCP, VACCP, BRC)" },
        { label: "Advanced Food Hygiene qualification" },
        { label: "Degree-level education" },
      ],
    },
    rubric: { id: "05267eed-5042-41b1-aa25-e8fd165b7ea2", calibration: {} },
    role_family: "people",
    reason: "test",
  };
  const applicant = (cv: string): OfflineMatch => ({
    ...match(cv),
    position_id: hughes.position.id,
    location: null,
    city: null,
    country: null,
    answers: [],
    candidate_name: "Candidate B",
  });

  it("both CVs are scored instead of refused", () => {
    for (const cv of [CAREER_OVERVIEW_CV, DETACHED_HEADINGS_CV]) {
      expect(offlineRescore(applicant(cv), hughes).kind).toBe("scored");
    }
  });

  it("a CV it still cannot read leaves one open admin task naming the cause", () => {
    const out = offlineRescore(
      applicant("A cover letter about my farming career and my passion for mushrooms and people."),
      hughes,
      { trace_id: "sc_test" },
    );
    expect(out.kind).toBe("no_dated_roles");
    if (out.kind !== "no_dated_roles") return;
    expect(out.sql).toMatch(/^DO \$do\$/);
    expect(out.sql).toContain("current_score_run_id = NULL");
    expect(out.sql).toContain("processing_error_code = 'cv_employment_history_missing'");
    expect(out.sql).toContain("INSERT INTO tasks");
    expect(out.sql).toContain("'candidate_review'");
    expect(out.sql).toContain("Candidate B for Mushroom Harvesting Manager: not scored yet");
    expect(out.sql).toContain("No dated roles could be read from the CV.");
    // Once per match: any open candidate_review task is reused, as the
    // pipeline does, whoever opened it.
    expect(out.sql).toContain(
      `NOT EXISTS (SELECT 1 FROM tasks t WHERE t.candidate_match_id = m.id AND t.task_type = 'candidate_review' AND t.status IN ('open', 'in_progress') AND t.deleted_at IS NULL);`,
    );
    expect(out.sql).not.toContain('source": "pipeline"}\'::jsonb');
    expect(out.sql).toContain(
      '{"source":"pipeline","reason":"cv_employment_history_missing","final_state":"manual_review_required","trace_id":"sc_test"}',
    );
    // Nothing approves, publishes or changes what the client sees.
    expect(out.sql).not.toMatch(/admin_status|client_visibility|stage\s*=/);
  });
});

describe("an offline refusal is guarded like an offline score (review, 2 Nov 2026)", () => {
  const COVER = "A cover letter about my farming career and my passion for mushrooms and people.";
  const refusal = () => {
    const out = offlineRescore(match(COVER), ctx, { trace_id: "sc_test" });
    if (out.kind !== "no_dated_roles") throw new Error(out.kind);
    return out.sql;
  };
  const before = (sql: string, a: string, b: string) => {
    expect(sql.indexOf(a)).toBeGreaterThan(0);
    expect(sql.indexOf(a)).toBeLessThan(sql.indexOf(b));
  };

  it("refuses when the CV text changed since the export, before it clears anything", () => {
    // A stale refusal file (Abdul's pre-fix one) applied after the live
    // pipeline re-read and scored the CV would otherwise undo that score.
    const sql = refusal();
    const md5 = createHash("md5").update(Buffer.from(COVER, "utf8")).digest("hex");
    expect(sql).toMatch(/^DO \$do\$\nDECLARE\n {2}cv text;\nBEGIN\n/);
    expect(sql).toContain(
      "SELECT f.extracted_text INTO cv FROM candidate_matches m JOIN candidate_profiles cp ON cp.id = m.candidate_profile_id JOIN files f ON f.id = cp.current_cv_file_id WHERE m.id = 'dd7f35f1-7dae-40ec-870e-a8d2fed5d448';",
    );
    expect(sql).toContain(
      `IF cv IS NULL OR md5(cv) <> '${md5}' THEN RAISE EXCEPTION 'offline rescore dd7f35f1-7dae-40ec-870e-a8d2fed5d448: CV text changed since export'; END IF;`,
    );
    before(sql, "md5(cv)", "UPDATE candidate_matches");
    before(sql, "md5(cv)", "INSERT INTO tasks");
  });

  it("never clears a human-reviewed published score", () => {
    const sql = refusal();
    const guard =
      "IF EXISTS (SELECT 1 FROM candidate_matches m JOIN score_runs r ON r.id = m.current_score_run_id WHERE m.id = 'dd7f35f1-7dae-40ec-870e-a8d2fed5d448' AND r.evaluation_method = 'human_adjusted') THEN RAISE EXCEPTION";
    expect(sql).toContain(guard);
    expect(sql).toContain(
      "the published score is human-reviewed; an offline refusal never clears it",
    );
    before(sql, guard, "current_score_run_id = NULL");
  });

  it("a machine rescore never replaces a human-reviewed published score either", () => {
    const out = offlineRescore(match(CV), ctx, {
      run_id: "11111111-1111-4111-8111-111111111111",
      trace_id: "sc_test",
    });
    if (out.kind !== "scored") throw new Error(out.kind);
    const guard = "AND r.evaluation_method = 'human_adjusted') THEN RAISE EXCEPTION";
    expect(out.sql).toContain(guard);
    expect(out.sql).toContain(
      "the published score is human-reviewed; a machine rescore never replaces it",
    );
    before(out.sql, guard, "UPDATE score_runs SET superseded_at");
    before(out.sql, guard, "UPDATE candidate_matches SET current_score_run_id");
  });

  it("the runner keeps refusals apart, to be applied only for a match named explicitly", () => {
    const runner = readFileSync(join(process.cwd(), "scripts/offline-rescore/run.ts"), "utf8");
    expect(runner).toMatch(
      /out\.kind === "no_dated_roles"[\s\S]*join\(outDir, "refusals", `\$\{m\.match_id\}\.sql`\)/,
    );
    expect(runner).toMatch(/apply one only for a match you have named explicitly/);
  });
});
