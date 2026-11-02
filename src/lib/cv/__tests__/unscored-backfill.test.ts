/**
 * The operator statement that opens the missing admin task for matches that
 * cannot be scored (review, 2 Nov 2026: 3b45fb2e, 7a173684 and 08b08208 were
 * parked with no open task). It is provided for an operator to apply; tests
 * here prove its wording is the pipeline's and that it only inserts tasks.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKFILL_UNSCORED_STATES,
  renderTemplate,
  taskTemplates,
  unscoredTaskBackfillSql,
} from "@/lib/cv/unscored-backfill";
import { REVIEW_TASK_CODES, candidateReviewTask, needsReviewTask } from "@/lib/cv/unscored-review";

const sql = unscoredTaskBackfillSql();

describe("open-unscored-tasks.sql", () => {
  it("the checked-in copy is the generated statement", () => {
    const file = readFileSync(
      join(process.cwd(), "scripts/offline-rescore/open-unscored-tasks.sql"),
      "utf8",
    );
    expect(file).toBe(sql);
  });

  it("reads exactly as the task the pipeline opens, for every code", () => {
    const values = [
      {
        name: "Candidate B",
        title: "Mushroom Harvesting Manager",
        message: "Manual review required - incomplete document.",
      },
      { name: null, title: null, message: null },
      { name: "  ", title: " ", message: " " },
    ];
    const codes = [...REVIEW_TASK_CODES, "engine_error", "unknown", "some_new_code"];
    const templates = taskTemplates();
    for (const code of codes) {
      const t = templates.find((x) => x.code === code) ?? templates.find((x) => x.code === null)!;
      for (const v of values) {
        const pipeline = candidateReviewTask({
          code,
          message: v.message,
          candidateName: v.name,
          positionTitle: v.title,
        });
        expect(renderTemplate(t.title, v)).toBe(pipeline.title);
        expect(renderTemplate(t.description, v)).toBe(pipeline.description);
        expect(t.priority).toBe(pipeline.priority);
      }
    }
  });

  it("names the cause and the next step for a CV with no dated roles", () => {
    expect(sql).toContain(
      "WHEN 'cv_employment_history_missing' THEN 'No dated roles could be read from the CV.' || u.detail || ' Next: Open the CV.",
    );
    expect(sql).toContain(
      "WHEN 'cv_employment_history_missing' THEN u.who || u.role || ': not scored yet'",
    );
    expect(sql).toMatch(
      /\(CASE WHEN u\.code IN \('engine_error', 'unknown'\) THEN 'high' ELSE 'normal' END\)::task_priority/,
    );
  });

  it("covers exactly the states in which the pipeline opens a task", () => {
    const states = [
      "queued",
      "parsing",
      "ocr_required",
      "parsed",
      "enriching",
      "ready_to_score",
      "scoring",
      "scored",
      "manual_review_required",
      "provider_blocked",
      "failed",
    ];
    const opens = states.filter((s) =>
      needsReviewTask(
        { final_state: s, steps: [{ step: "score", ok: false }] },
        { current_score_run_id: null },
      ),
    );
    expect([...BACKFILL_UNSCORED_STATES].sort()).toEqual(opens.sort());
    expect(sql).toContain(
      "AND m.processing_state::text IN ('failed', 'ocr_required', 'provider_blocked', 'manual_review_required')",
    );
    expect(sql).toContain("WHERE m.current_score_run_id IS NULL");
  });

  it("is idempotent: an open candidate_review task from any source is reused", () => {
    expect(sql).toMatch(
      /AND NOT EXISTS \(\s*SELECT 1 FROM tasks t\s*WHERE t\.candidate_match_id = m\.id AND t\.task_type = 'candidate_review'\s*AND t\.status IN \('open', 'in_progress'\) AND t\.deleted_at IS NULL\s*\)/,
    );
    expect(sql).not.toMatch(/metadata\s*@>/);
  });

  it("leaves out test records and roles that are filled, closed or archived", () => {
    expect(sql).toContain("AND m.is_test_record = false");
    expect(sql).toContain(
      "AND coalesce(p.status::text, '') NOT IN ('filled', 'closed', 'archived')",
    );
  });

  it("only inserts tasks: no score, eligibility, approval, visibility or stage change, and nothing is sent", () => {
    const code = sql.replace(/^--.*$/gm, "");
    expect(code.match(/\bINSERT INTO (\w+)/g)).toEqual(["INSERT INTO tasks"]);
    expect(code).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
    expect(code).not.toMatch(
      /admin_status|client_visibility|stage|eligibility_status|score_runs|reminder_policy|notifications|email/i,
    );
    expect(code).toContain("'candidate_review',");
    expect(code).toContain(
      "jsonb_build_object('source', 'unscored_backfill', 'reason', u.code, 'final_state', u.final_state)",
    );
  });
});
