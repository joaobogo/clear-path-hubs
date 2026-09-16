/**
 * An assessment is a parallel signal. It never enters the score.
 *
 * This is the whole safety argument for shipping assessments at all. The
 * 15 Sep audit's risk register puts "assessment result leaks into the 60/20/20
 * evidence score, publish gate or band" first, because it would break both the
 * immutability the product is sold on and the legal position that a person,
 * not an instrument, makes the decision (Title VII, NYC LL144, GDPR Art. 22).
 *
 * The guarantee is structural rather than careful: the scoring path has
 * nothing to read. No assessment table is referenced by the score code, no
 * column was added to candidate_matches, and the feature flag is off for every
 * organisation until someone turns it on. These tests hold all three.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_CONSENT_VERSION,
  assessmentConsentText,
  assessmentInterpretation,
  assessmentsEnabled,
  clientMaySeeResult,
} from "@/lib/assessments/assessments";

const root = process.cwd();
const src = (rel: string) => readFileSync(join(root, rel), "utf8");
const MIGRATION = "supabase/migrations/20260915120000_assessments_phase1.sql";

/** Every file the published score is computed from. */
const SCORING_FILES = [
  "src/lib/scoring/published-score.ts",
  "src/lib/scoring/score-composition.ts",
  "src/lib/scoring-engine.server.ts",
  "src/lib/publish-gate.ts",
  "src/lib/client-pipeline-lane.ts",
];

const ASSESSMENT_TOKENS = [
  "assessment_definitions",
  "assessment_invitations",
  "assessment_results",
  "assessment_consent",
  "assessments_enabled",
  "assessments/assessments",
];

describe("the scoring path cannot read an assessment", () => {
  for (const file of SCORING_FILES) {
    it(`${file} never mentions an assessment`, () => {
      const code = src(file);
      for (const token of ASSESSMENT_TOKENS) {
        expect(code, `${file} references ${token}`).not.toContain(token);
      }
    });
  }

  it("no assessment table is joined anywhere in the scoring or publish path", () => {
    // A wider sweep than the file list above: if any server module that the
    // score or the publish desk depends on starts selecting an assessment
    // table, this catches it.
    const libDir = join(root, "src/lib");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "assessments" || entry.name === "__tests__") continue;
          walk(p);
          continue;
        }
        if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
        const code = readFileSync(p, "utf8");
        const scoreish = /publishedScore|scoreCandidate|evaluatePublishGate|buildScoreComposition/.test(code);
        if (!scoreish) continue;
        if (/assessment_(definitions|invitations|results|consent)/.test(code)) {
          offenders.push(p.replace(root, "").replace(/\\/g, "/"));
        }
      }
    };
    walk(libDir);
    expect(offenders, "a scoring-aware module reads an assessment table").toEqual([]);
  });

  it("adds no column to candidate_matches", () => {
    const sql = src(MIGRATION);
    expect(sql).not.toMatch(/alter\s+table\s+public\.candidate_matches/i);
    expect(sql, "no trigger may fire off a match either").not.toMatch(/create\s+trigger/i);
  });

  it("the assessment module imports nothing from scoring", () => {
    // Comments stripped first: the module's own docstring says it must never
    // import from scoring, and a rule written down is not a violation of it.
    const code = src("src/lib/assessments/assessments.ts")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/from\s+["']@\/lib\/scoring/);
    expect(code).not.toMatch(/import\(["']@\/lib\/scoring/);
    expect(code).not.toMatch(/scoring-engine/);
    // And nothing at all is imported from outside this module today.
    expect(code.match(/^import\s/gm) ?? []).toHaveLength(0);
  });
});

describe("nothing switches on by itself", () => {
  it("the flag defaults to false, for existing organisations too", () => {
    const sql = src(MIGRATION);
    expect(sql).toMatch(/assessments_enabled\s+boolean\s+not\s+null\s+default\s+false/i);
    // `add column ... default false` backfills every existing row with false,
    // so no organisation is opted in by the migration itself.
    expect(sql).toMatch(/add column if not exists assessments_enabled/i);
  });

  it("reads the flag strictly — anything but true is off", () => {
    expect(assessmentsEnabled({ assessments_enabled: true })).toBe(true);
    for (const off of [{ assessments_enabled: false }, { assessments_enabled: null }, {}, null, undefined]) {
      expect(assessmentsEnabled(off as never)).toBe(false);
    }
  });

  it("an assessment never gates publishing", () => {
    const sql = src(MIGRATION);
    // "Required" is about the shortlist conversation, and the column name says
    // so. A publish-gating flag would have to be read by publish-gate.ts,
    // which the test above forbids.
    expect(sql).toMatch(/required_before_shortlist/);
    expect(src("src/lib/publish-gate.ts")).not.toMatch(/required_before_shortlist/);
  });
});

describe("a person releases every result", () => {
  it("the database refuses a client an unreviewed result", () => {
    const sql = src(MIGRATION);
    const policy = sql.slice(sql.indexOf('"client reads reviewed assessment results"'));
    expect(policy).toMatch(/reviewed_by is not null/);
  });

  it("the same rule is readable by the UI", () => {
    expect(clientMaySeeResult({ reviewed_by: "someone" })).toBe(true);
    for (const hidden of [{ reviewed_by: null }, {}, null, undefined]) {
      expect(clientMaySeeResult(hidden as never)).toBe(false);
    }
  });

  it("an unreleased result says so rather than showing a number", () => {
    const text = assessmentInterpretation({
      band: "B",
      percentile: 70,
      vendorReportUrl: null,
      reviewed: false,
    });
    expect(text).toMatch(/not released/i);
    expect(text, "a band must not leak before review").not.toMatch(/\bB\b/);
  });

  it("a released result is framed as a signal, never a verdict", () => {
    const text = assessmentInterpretation({
      band: "B",
      percentile: 70.4,
      vendorReportUrl: null,
      reviewed: true,
    });
    expect(text).toMatch(/70th percentile/);
    expect(text).toMatch(/does not form part of the Fit score/i);
    expect(text).not.toMatch(/pass|fail|reject|recommend/i);
  });
});

describe("consent is asked, recorded and versioned", () => {
  it("tells the candidate a person reviews it and it cannot reject them", () => {
    const text = assessmentConsentText({ roleTitle: "Senior Accountant", minutes: 15 });
    expect(text).toMatch(/Senior Accountant/);
    expect(text).toMatch(/about 15 minutes/);
    expect(text).toMatch(/a person always\s+reviews them/);
    expect(text).toMatch(/never used to automatically reject you/);
    expect(text, "an accommodation path is required under the ADA").toMatch(/adjustment/i);
  });

  it("carries a version, so a record stays attributable to the text shown", () => {
    expect(ASSESSMENT_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(src(MIGRATION)).toMatch(/version text not null/);
  });

  it("records an accommodation request alongside the answer", () => {
    expect(src(MIGRATION)).toMatch(/accommodation_requested boolean not null default false/);
  });
});

describe("the tables are scoped to one organisation", () => {
  it("every table has row-level security on", () => {
    const sql = src(MIGRATION);
    for (const t of [
      "assessment_definitions",
      "assessment_invitations",
      "assessment_results",
      "assessment_consent",
      "assessment_audit",
    ]) {
      expect(sql, `${t} has no RLS`).toMatch(
        new RegExp(`alter table public\\.${t} enable row level security`),
      );
    }
  });

  it("a client gets read access only, never write", () => {
    const sql = src(MIGRATION);
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*to authenticated/i);
    expect(sql).toMatch(/grant select on public\.assessment_results to authenticated/);
  });

  it("statuses are constrained by the database, not only by TypeScript", () => {
    const sql = src(MIGRATION);
    for (const s of ASSESSMENT_STATUSES) expect(sql).toContain(`'${s}'`);
  });
});
