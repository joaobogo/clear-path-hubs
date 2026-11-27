/**
 * Structured screening pilot: the switch, the stored answers, and the apply
 * path. Behavioural where the code is pure or takes its database as an
 * argument; source-reading for the apply handler, which needs a live
 * database (the same approach as tests/unit/public-apply-cannot-rewrite-a-profile).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import {
  loadStructuredScreening,
  storeApplicationAnswers,
} from "../structured.server";
import type { StructuredQuestion } from "../structured";

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>) {
  const writes: Array<{ table: string; rows: Row[]; opts: unknown }> = [];
  const db = {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const api: Record<string, unknown> = {
        select: () => api,
        eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
        maybeSingle: async () => ({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r)))[0] ?? null, error: null }),
        upsert: async (rows: Row[], opts: unknown) => (writes.push({ table, rows, opts }), { error: null }),
        then: (res: (v: unknown) => unknown) =>
          Promise.resolve({ data: (tables[table] ?? []).filter((r) => filters.every((f) => f(r))), error: null }).then(res),
      };
      return api;
    },
  };
  return { db, writes };
}

const POS = "a781288f-cf6f-45d6-b78f-5db5a846bc15";
const questionRow = (key: string, extra: Row = {}): Row => ({
  position_id: POS,
  key,
  label: key,
  type: "yes_no",
  options: null,
  required: true,
  section: "this_role",
  maps_to_requirement: null,
  pass_rule: null,
  sort_order: 1,
  help: null,
  unit: null,
  show_when: null,
  short_label: null,
  staff_only: false,
  ...extra,
});

describe("the per-job switch", () => {
  it("is off unless the job's flag is on, whatever question rows exist", async () => {
    const { db } = fakeDb({
      positions: [{ id: POS, structured_screening_enabled: false, structured_screening_enabled_at: null }],
      structured_screening_questions: [questionRow("london_travel")],
    });
    expect(await loadStructuredScreening(POS, db)).toEqual({ enabled: false, enabled_at: null, questions: [] });
  });

  it("is on with the job's questions when the flag is on", async () => {
    const { db } = fakeDb({
      positions: [{ id: POS, structured_screening_enabled: true, structured_screening_enabled_at: "2026-11-28T09:00:00Z" }],
      structured_screening_questions: [questionRow("london_travel")],
    });
    const s = await loadStructuredScreening(POS, db);
    expect(s.enabled).toBe(true);
    expect(s.questions.map((q) => q.key)).toEqual(["london_travel"]);
  });
});

describe("storing a new application's answers", () => {
  it("stores the form's answers, LinkedIn and location, never replacing an answer already stored", async () => {
    const { db, writes } = fakeDb({});
    const questions = [
      { key: "linkedin_url" },
      { key: "based_in" },
      { key: "london_travel" },
    ] as unknown as StructuredQuestion[];
    await storeApplicationAnswers(db, {
      applicationId: "app-1",
      positionId: POS,
      answers: [
        { key: "london_travel", value: true },
        { key: "not_a_question", value: true },
      ],
      linkedinUrl: "https://www.linkedin.com/in/example",
      basedIn: "London, United Kingdom",
      questions,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("structured_screening_answers");
    expect(writes[0].opts).toEqual({ onConflict: "application_id,question_key", ignoreDuplicates: true });
    expect(writes[0].rows.map((r) => [r.question_key, r.value, r.source, r.status])).toEqual([
      ["london_travel", true, "candidate", "answered"],
      ["linkedin_url", "https://www.linkedin.com/in/example", "candidate", "answered"],
      ["based_in", "London, United Kingdom", "candidate", "answered"],
    ]);
  });
});

describe("the apply path", () => {
  const src = readFileSync(join(process.cwd(), "src", "lib", "apply.server.ts"), "utf8");

  it("asks a pilot job's structured questions instead of its standard ones", () => {
    expect(src).toMatch(/const structured = await loadStructuredScreening\(data\.position_id, supabaseAdmin\)/);
    expect(src).toMatch(/const questions = structured\.enabled \? \[\] : standardQuestions;/);
  });

  it("so no standard dealbreaker can reject a pilot application, and every other job is checked as before", () => {
    // The dealbreaker rule reads `questions`, which is empty only on a pilot job.
    expect(src).toMatch(/decideScreeningEligibility\(\s*\(questions \?\? \[\]\)/);
  });

  it("requires LinkedIn and validates the answers only on a pilot job", () => {
    const block = src.slice(src.indexOf("if (structured.enabled) {"), src.indexOf("// 2. Validate screening answers"));
    expect(block).toMatch(/linkedin_url/);
    expect(block).toMatch(/validateAnswers\(structured\.questions/);
  });

  it("stores the answers and adds the one-line summary to the application alert only on a pilot job", () => {
    expect(src).toMatch(/if \(structured\.enabled\) \{\s*await storeApplicationAnswers\(/);
    expect(src).toMatch(/\.\.\.\(structured\.enabled\s*\?\s*\[\s*\{\s*label: "Screening"/);
  });
});
