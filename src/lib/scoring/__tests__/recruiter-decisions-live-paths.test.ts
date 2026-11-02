/**
 * The live write paths behind the Hughes review follow-ups, against an
 * in-memory stand-in for the database client:
 *
 *  - executeScoring on a CV with no dated roles (Abdul, Chiedza) still writes
 *    the screening_claim_unverified row and honours recruiter decisions, while
 *    writing no score run;
 *  - the admin eligibility control (setEligibilityDecision) records a
 *    recruiter_review row instead of editing the engine's row, and the
 *    match's eligibility follows at once. It never approves, publishes or
 *    touches stage / client visibility, and never rescores.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** A tiny in-memory PostgREST stand-in: enough filters for these paths. */
function memoryDb(tables: Record<string, Row[]>, rpc: Record<string, unknown>) {
  const writes: Array<{ table: string; op: string; payload?: unknown }> = [];
  let seq = 0;
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    const filters: Array<(r: Row) => boolean> = [];
    let op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
    let payload: unknown;
    let conflict: string[] = [];
    let limit = Infinity;
    const run = () => {
      const hit = () => rows.filter((r) => filters.every((f) => f(r)));
      if (op === "select") return hit().slice(0, limit).map((r) => ({ ...r }));
      writes.push({ table, op, payload });
      if (op === "update") {
        const out = hit();
        for (const r of out) Object.assign(r, payload as Row);
        return out.map((r) => ({ ...r }));
      }
      if (op === "delete") {
        const out = hit();
        for (const r of out) rows.splice(rows.indexOf(r), 1);
        return out;
      }
      const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
      return list.map((p) => {
        const existing =
          op === "upsert" && conflict.length ? rows.find((r) => conflict.every((k) => r[k] === p[k])) : undefined;
        if (existing) {
          Object.assign(existing, p);
          return { ...existing };
        }
        const row = { id: p.id ?? `row-${++seq}`, ...p };
        rows.push(row);
        return { ...row };
      });
    };
    const b: Row = {
      select: () => b,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), b),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), b),
      is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), b),
      like: (c: string, pattern: string) => {
        const re = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`);
        filters.push((r) => re.test(String(r[c] ?? "")));
        return b;
      },
      not: (c: string, operator: string, list: string) => {
        const vals = list.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
        if (operator === "in") filters.push((r) => !vals.includes(r[c]));
        return b;
      },
      order: () => b,
      limit: (n: number) => ((limit = n), b),
      update: (p: unknown) => ((op = "update"), (payload = p), b),
      insert: (p: unknown) => ((op = "insert"), (payload = p), b),
      upsert: (p: unknown, o?: { onConflict?: string }) => (
        (op = "upsert"), (payload = p), (conflict = (o?.onConflict ?? "").split(",").filter(Boolean)), b
      ),
      delete: () => ((op = "delete"), b),
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => {
        const out = run();
        return out[0] ? { data: out[0], error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ data: run(), error: null }).then(ok, ko),
    };
    return b;
  };
  return {
    tables,
    writes,
    client: { from, rpc: async (name: string) => ({ data: rpc[name] ?? null, error: null }) },
  };
}

let db: ReturnType<typeof memoryDb>;

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return db.client;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain: Row = {
      middleware: () => chain,
      inputValidator: (v: (i: unknown) => unknown) => ((chain.validate = v), chain),
      handler: (h: (a: unknown) => unknown) => {
        const fn = async (args: { data: unknown; context: unknown }) => h({ ...args, data: chain.validate(args.data) });
        return fn;
      },
    };
    return chain;
  },
}));

const ORG = "1def8e51-d266-48a4-8829-065d0201b447";
const POS = "9466d8ac-0b74-4b14-94e9-0e9d56021fa2";
const MATCH = "3b45fb2e-1111-4111-8111-111111111111";
const APP = "3b45fb2e-2222-4222-8222-222222222222";
const PROFILE = "3b45fb2e-3333-4333-8333-333333333333";
const Q_MUSHROOM = "7da77185-54dc-4fd9-89ea-1f960fee0fdb";
const QUESTION =
  "Do you have direct, hands-on mushroom picking experience as well as supervisory experience on a commercial mushroom farm?";

/** Supervision described, no dates anywhere, no mushroom work. */
const CV_UNDATED = [
  "Warehouse Supervisor",
  "Supervised a team of 25 operatives on rotating shifts, including weekends and overtime in peak periods.",
  "Trained new starters in health and safety and handled absence and disciplinary processes.",
  "Planned daily manning and reported KPIs to the site manager.",
].join("\n");

function seed(opts: { answer: boolean; eligibility: string; checks?: Row[] }) {
  db = memoryDb(
    {
      candidate_matches: [
        {
          id: MATCH,
          application_id: APP,
          candidate_profile_id: PROFILE,
          position_id: POS,
          organization_id: ORG,
          processing_state: "ready_to_score",
          current_score_run_id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          eligibility_status: opts.eligibility,
          score_stale: false,
          stage: "screening",
          client_visibility: "hidden",
          admin_status: "pending",
        },
      ],
      positions: [
        {
          id: POS,
          status: "active",
          title: "Mushroom Harvesting Manager",
          organization_id: ORG,
          requirements: [{ label: "Hands-on mushroom picking experience" }, { label: "Previous supervisory experience on a mushroom farm" }],
          preferred_requirements: [],
        },
      ],
      candidate_profiles: [{ id: PROFILE, current_cv_file_id: "f1", location: null, city: null, country: null }],
      files: [{ id: "f1", extracted_text: CV_UNDATED }],
      application_answers: [
        {
          application_id: APP,
          question_id: Q_MUSHROOM,
          answer: { value: opts.answer },
          screening_questions: {
            question: QUESTION,
            answer_type: "boolean",
            required: true,
            dealbreaker: true,
            preferred_answer: null,
            must_have: "Hands-on mushroom picking experience and supervisory experience on a mushroom farm",
          },
        },
      ],
      eligibility_checks: (opts.checks ?? []).map((c) => ({
        candidate_match_id: MATCH,
        organization_id: ORG,
        position_id: POS,
        qualifier_label: "q",
        qualifier_kind: "disqualifier",
        evidence: [],
        ...c,
      })),
      rubric_versions: [],
      score_runs: [],
      audit_events: [],
      processing_jobs: [],
    },
    { scoring_readiness: { ok: true, blockers: [] }, is_platform_staff: true, role_family_of: null },
  );
}

const match = () => db.tables.candidate_matches[0]!;
const checks = () => db.tables.eligibility_checks;
const untouched = (row: Row) => {
  expect(row.stage).toBe("screening");
  expect(row.client_visibility).toBe("hidden");
  expect(row.admin_status).toBe("pending");
};

describe("executeScoring: a CV with no dated roles", () => {
  beforeEach(() => vi.resetModules());

  it("records the unverified claim ('unknown'), stays eligible, writes no run", async () => {
    seed({ answer: true, eligibility: "eligible" });
    const { executeScoring } = await import("@/lib/scoring-service.server");
    const out = await executeScoring(MATCH, { force: true });
    expect(out.ok).toBe(false);
    expect(out).toMatchObject({ code: "cv_employment_history_missing" });
    const flag = checks().find((c) => c.qualifier_key === `screening_claim_unverified:${Q_MUSHROOM}`);
    expect(flag).toMatchObject({ status: "unknown", qualifier_kind: "qualifier" });
    expect(match().eligibility_status).toBe("eligible");
    expect(match().current_score_run_id).toBeNull();
    expect(db.tables.score_runs).toEqual([]);
    untouched(match());
  });

  it("a recruiter's 'failed' wins even with no run (the recompute flip cannot stick)", async () => {
    seed({
      answer: true,
      eligibility: "eligible",
      checks: [{ id: "rr1", qualifier_key: "recruiter_review:student_work_only", status: "failed" }],
    });
    const { executeScoring } = await import("@/lib/scoring-service.server");
    await executeScoring(MATCH, { force: true });
    expect(match().eligibility_status).toBe("not_eligible");
    // The decision row is read, never rewritten or removed.
    expect(checks().find((c) => c.id === "rr1")).toMatchObject({ status: "failed", qualifier_key: "recruiter_review:student_work_only" });
    expect(db.writes.some((w) => w.table === "eligibility_checks" && JSON.stringify(w.payload ?? "").includes("recruiter_review"))).toBe(false);
    // A decided question is not flagged as unverified; nothing else is.
    expect(db.tables.audit_events.some((a) => a.action === "scoring.eligibility_changed")).toBe(true);
  });

  it("a recruiter exception lifts the dealbreaker 'no' without a run", async () => {
    seed({
      answer: false,
      eligibility: "not_eligible",
      checks: [
        { id: "d1", qualifier_key: `disq:${Q_MUSHROOM}`, status: "failed" },
        { id: "rr1", qualifier_key: "recruiter_review:mushroom", status: "excepted", evidence: { question_id: Q_MUSHROOM } },
      ],
    });
    const { executeScoring } = await import("@/lib/scoring-service.server");
    await executeScoring(MATCH, { force: true });
    expect(match().eligibility_status).toBe("excepted");
    expect(checks().map((c) => c.qualifier_key)).toEqual(["recruiter_review:mushroom"]);
  });
});

describe("setEligibilityDecision: the admin control records recruiter decisions", () => {
  beforeEach(() => vi.resetModules());

  async function decide(check_id: string, status: string, reason = "Owner guidance, 2 Nov") {
    const { setEligibilityDecision } = await import("@/lib/scoring-review.functions");
    return (setEligibilityDecision as unknown as (a: unknown) => Promise<Row>)({
      data: { match_id: MATCH, check_id, status, reason },
      context: { userId: "0000aaaa-0000-4000-8000-000000000001" },
    });
  }
  const DISQ_ID = "aaaaaaaa-1111-4111-8111-111111111111";

  it("'excepted' on the engine's disq: row writes recruiter_review:<question> and the match reads 'excepted'", async () => {
    seed({
      answer: false,
      eligibility: "not_eligible",
      checks: [{ id: DISQ_ID, qualifier_key: `disq:${Q_MUSHROOM}`, qualifier_label: QUESTION, status: "failed", evidence: { question_id: Q_MUSHROOM, value: "no" } }],
    });
    const out = await decide(DISQ_ID, "excepted");
    expect(out).toMatchObject({ ok: true, eligibility_status: "excepted", rescore_needed: true });
    const rr = checks().find((c) => c.qualifier_key === `recruiter_review:${Q_MUSHROOM}`);
    expect(rr).toMatchObject({ status: "excepted", actor_user_id: "0000aaaa-0000-4000-8000-000000000001" });
    expect(rr!.evidence).toMatchObject({ question_id: Q_MUSHROOM, decided_by: "recruiter", screening_answer: "no" });
    // The engine row was never edited to carry the decision.
    expect(db.writes.filter((w) => w.table === "eligibility_checks" && w.op === "update")).toEqual([]);
    expect(match().eligibility_status).toBe("excepted");
    const audit = db.tables.audit_events.find((a) => a.action === "eligibility_decided");
    expect(audit?.after_state).toMatchObject({ decision_key: `recruiter_review:${Q_MUSHROOM}`, status: "excepted", eligibility_status: "excepted" });
    // No rescore, no approval, no visibility or stage change.
    expect(db.tables.score_runs).toEqual([]);
    untouched(match());
  });

  it("'passed' lifts the answer like 'excepted' and reads 'eligible'; the next rescore keeps it", async () => {
    seed({
      answer: false,
      eligibility: "not_eligible",
      checks: [{ id: DISQ_ID, qualifier_key: `disq:${Q_MUSHROOM}`, qualifier_label: QUESTION, status: "failed", evidence: { question_id: Q_MUSHROOM, value: "no" } }],
    });
    await decide(DISQ_ID, "passed");
    expect(match().eligibility_status).toBe("eligible");
    // A rescore (here the no-dated-roles path) reads the decision and keeps it.
    const { executeScoring } = await import("@/lib/scoring-service.server");
    await executeScoring(MATCH, { force: true });
    expect(match().eligibility_status).toBe("eligible");
    expect(checks().find((c) => c.qualifier_key === `recruiter_review:${Q_MUSHROOM}`)?.status).toBe("passed");
    expect(checks().some((c) => c.qualifier_key === `disq:${Q_MUSHROOM}`)).toBe(false);
  });

  it("a decision on the unverified flag clears the flag and records the decision", async () => {
    const FLAG_ID = "bbbbbbbb-2222-4222-8222-222222222222";
    seed({
      answer: true,
      eligibility: "eligible",
      checks: [
        {
          id: FLAG_ID,
          qualifier_key: `screening_claim_unverified:${Q_MUSHROOM}`,
          qualifier_label: `Screening claim unverified: ${QUESTION}`,
          qualifier_kind: "qualifier",
          status: "unknown",
          evidence: { question_id: Q_MUSHROOM, answer: "yes" },
        },
      ],
    });
    await decide(FLAG_ID, "failed", "Student placement only, no farm supervision");
    expect(checks().some((c) => c.id === FLAG_ID)).toBe(false);
    expect(checks().find((c) => c.qualifier_key === `recruiter_review:${Q_MUSHROOM}`)).toMatchObject({ status: "failed", qualifier_label: QUESTION });
    expect(match().eligibility_status).toBe("not_eligible");
  });

  it("refuses the old eligibility words the table never accepted", async () => {
    seed({ answer: false, eligibility: "not_eligible", checks: [{ id: DISQ_ID, qualifier_key: `disq:${Q_MUSHROOM}`, status: "failed" }] });
    await expect(decide(DISQ_ID, "eligible")).rejects.toThrow();
  });
});
