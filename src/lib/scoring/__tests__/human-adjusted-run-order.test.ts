/**
 * A reviewer's verdict writes a new run and retires the machine run.
 *
 * The database keeps one current completed run per application
 * (score_runs_one_current_per_submission). The adjusted run used to be
 * inserted as completed while the machine run was still current, so the
 * insert was refused and the per-criterion override could not be saved
 * (found 16 Nov 2026 applying recruiter verdicts on the Billing Manager
 * role). The fake below enforces the same rule.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const tables: Record<string, Row[]> = {};
const UNIQUE =
  'duplicate key value violates unique constraint "score_runs_one_current_per_submission"';

const isLive = (r: Row) => r.status === "completed" && r.superseded_at == null;
function violates(rows: Row[], row: Row): boolean {
  return (
    isLive(row) &&
    rows.some(
      (r) =>
        r.id !== row.id &&
        isLive(r) &&
        r.candidate_match_id === row.candidate_match_id &&
        r.candidate_submission_id === row.candidate_submission_id,
    )
  );
}

class Query {
  private filters: Array<(r: Row) => boolean> = [];
  private action: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  constructor(private table: string) {}
  select() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  is(k: string, v: unknown) {
    this.filters.push((r) => (r[k] ?? null) === v);
    return this;
  }
  insert(row: Row) {
    this.action = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.action = "update";
    this.payload = patch;
    return this;
  }
  private run(): { data: Row[]; error: { message: string } | null } {
    const rows = (tables[this.table] ??= []);
    if (this.action === "insert") {
      const row = { ...this.payload };
      if (this.table === "score_runs" && violates(rows, row))
        return { data: [], error: { message: UNIQUE } };
      rows.push(row);
      return { data: [row], error: null };
    }
    const hit = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.action === "update") {
      for (const r of hit) {
        const next = { ...r, ...this.payload };
        if (this.table === "score_runs" && violates(rows, next))
          return { data: [], error: { message: UNIQUE } };
        Object.assign(r, this.payload);
      }
      return { data: hit, error: null };
    }
    // Newest completed first, as the function asks for.
    const sorted = [...hit].sort((a, b) =>
      String(b.completed_at ?? "").localeCompare(String(a.completed_at ?? "")),
    );
    return { data: sorted, error: null };
  }
  maybeSingle() {
    const r = this.run();
    return Promise.resolve({ data: r.data[0] ?? null, error: r.error });
  }
  single() {
    return this.maybeSingle();
  }
  then<T>(resolve: (v: { data: Row[]; error: { message: string } | null }) => T) {
    return Promise.resolve(this.run()).then(resolve);
  }
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => new Query(table) },
}));

const MATCH = "11111111-1111-4111-8111-111111111111";
const APP = "22222222-2222-4222-8222-222222222222";
const BASE = "33333333-3333-4333-8333-333333333333";
const ACTOR = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
  tables.candidate_matches = [
    {
      id: MATCH,
      position_id: "pos",
      application_id: APP,
      candidate_profile_id: "prof",
      organization_id: "org",
      current_score_run_id: BASE,
      intro_video_url: null,
      processing_state: "scored",
      processing_error_code: null,
    },
  ];
  tables.profiles = [{ auth_user_id: ACTOR, full_name: "Pat Reviewer", email: "pat@example.com" }];
  tables.candidate_evidence_items = [];
  tables.score_runs = [
    {
      id: BASE,
      candidate_match_id: MATCH,
      candidate_submission_id: APP,
      position_id: "pos",
      organization_id: "org",
      status: "completed",
      superseded_at: null,
      completed_at: "2026-11-16T10:00:00.000Z",
      engine_version: "taasflow-scoring-v1.7.7",
      blueprint_version: 1,
      rubric_version_id: null,
      final_score: 50,
      score: 50,
      fit_label: "worth_considering",
      evidence: [],
      input_hash: "abc",
      contradiction_status: "none",
      result: {
        role_family: "unclassified",
        evaluation_method: "deterministic",
        category_weights: { must_have: 0.6, preferred: 0.2, screening_alignment: 0.2 },
        category_breakdown: { screening_alignment: 1 },
        applied_caps: [],
        requirement_assessment: [
          {
            id: "req-0",
            text: "5+ years of billing experience",
            required: true,
            status: "partial",
          },
          { id: "req-1", text: "2+ years managing a team", required: true, status: "met" },
          {
            id: "pref-0",
            text: "General accounting knowledge",
            required: false,
            status: "missing",
          },
        ],
      },
    },
  ];
});

describe("createHumanAdjustedRun against the one-current-run rule", () => {
  it("the fake refuses a second completed run beside the current one", async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => Query };
    const r = await db.from("score_runs").insert({
      id: "x",
      candidate_match_id: MATCH,
      candidate_submission_id: APP,
      status: "completed",
      superseded_at: null,
    });
    expect(r.error?.message).toBe(UNIQUE);
  });

  it("saves the verdicts: retires the machine run, then completes the adjusted one", async () => {
    const { createHumanAdjustedRun } = await import("@/lib/scoring/human-adjusted-run.server");
    const out = await createHumanAdjustedRun({
      matchId: MATCH,
      actorUserId: ACTOR,
      reason: "Recruiter research",
      verdicts: [
        {
          requirement_id: "req-0",
          verdict: "met",
          reason: "Ran billing end to end at two employers.",
        },
        {
          requirement_id: "req-1",
          verdict: "not_met",
          reason: "Answered no to the screening question.",
        },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.previous_run_id).toBe(BASE);

    const runs = tables.score_runs!;
    const live = runs.filter(isLive);
    // One current completed run: the adjusted one.
    expect(live.map((r) => r.id)).toEqual([out.run_id]);
    expect(live[0]!.evaluation_method).toBe("human_adjusted");
    expect(live[0]!.completed_at).toBeTruthy();
    const base = runs.find((r) => r.id === BASE)!;
    expect(base.superseded_by_run_id).toBe(out.run_id);
    expect(base.superseded_reason).toBe("human_adjusted");
    expect(tables.candidate_matches![0]!.current_score_run_id).toBe(out.run_id);

    // The override history keeps what the machine said and why it changed.
    const overrides = tables.evidence_overrides ?? [];
    expect(overrides).toHaveLength(2);
    expect(overrides[0]).toMatchObject({
      candidate_match_id: MATCH,
      reason: "Ran billing end to end at two employers.",
      before_state: { requirement_id: "req-0", machine_status: "partial", score_run_id: BASE },
      after_state: { requirement_id: "req-0", human_verdict: "met", score_run_id: out.run_id },
    });
    expect((tables.audit_events ?? []).map((a) => a.action)).toEqual(["score_human_adjusted"]);
  });
});
