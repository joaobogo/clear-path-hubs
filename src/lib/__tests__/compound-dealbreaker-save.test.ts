import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The role editor save (savePositionEdit) against an in-memory database:
 * a new bundled dealbreaker is refused before anything is written, and the
 * Hughes role's stored bundled dealbreaker does not block an unrelated edit.
 */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const writes: Array<{ table: string; kind: "update" | "insert" | "delete" }> = [];

function query(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  let op:
    | { kind: "select" | "delete" }
    | { kind: "update"; patch: Row }
    | { kind: "insert"; rows: Row[] } = {
    kind: "select",
  };
  let single = false;
  const api: Record<string, unknown> = {};
  const rows = () => (db[table] ??= []);
  const run = () => {
    if (op.kind === "insert") {
      writes.push({ table, kind: "insert" });
      rows().push(...op.rows);
      return { data: op.rows, error: null };
    }
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (op.kind === "update") {
      writes.push({ table, kind: "update" });
      for (const r of hit) Object.assign(r, op.patch);
    }
    if (op.kind === "delete") {
      writes.push({ table, kind: "delete" });
      db[table] = rows().filter((r) => !hit.includes(r));
    }
    if (single) return { data: hit[0] ?? null, error: null };
    return { data: hit, error: null, count: hit.length };
  };
  Object.assign(api, {
    select: () => api,
    update: (patch: Row) => ((op = { kind: "update", patch }), api),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), api),
    delete: () => ((op = { kind: "delete" }), api),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), api),
    order: () => api,
    limit: () => api,
    maybeSingle: () => ((single = true), Promise.resolve(run())),
    single: () => ((single = true), Promise.resolve(run())),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(run()).then(res, rej),
  });
  return api;
}

const admin = { from: (t: string) => query(t), rpc: vi.fn(async () => ({ data: null })) };

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: admin }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/authz/workspace-access", () => ({
  assertWorkspaceAccess: vi.fn(async () => ({ allowed: true, isStaff: true, canWrite: true })),
  assertWorkspaceWrite: vi.fn(async () => ({ allowed: true, canWrite: true })),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b: Record<string, unknown> = {};
    b.middleware = () => b;
    b.inputValidator = (v: (i: unknown) => unknown) => ((b._v = v), b);
    b.handler = (h: (a: unknown) => unknown) => async (args: { data: unknown; context: unknown }) =>
      h({ ...args, data: (b._v as (i: unknown) => unknown)(args.data) });
    return b;
  },
}));
// The rescore after a criteria change is not under test here.
vi.mock("@/lib/scoring/requirement-change-rescore.server", () => ({
  rescoreAfterCriteriaChange: vi.fn(async () => ({ queued: 0, changed: false })),
}));

const POS = "9466d8ac-0b74-4b14-94e9-0e9d56021fa2";
const ORG = "22222222-2222-4222-8222-222222222222";
const BUNDLED_ID = "7da77185-54dc-4fd9-89ea-1f960fee0fdb";
const BUNDLED =
  "Do you have direct, hands-on mushroom picking experience as well as supervisory experience on a commercial mushroom farm?";

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  writes.length = 0;
  db.positions = [
    {
      id: POS,
      organization_id: ORG,
      title: "Mushroom Harvesting Manager",
      description: "Lead the harvesting team at a commercial mushroom farm in East Yorkshire.",
      requirements: [{ label: "Hands-on mushroom picking", kind: "must_have" }],
      preferred_requirements: [],
      dealbreakers: [],
      intake_context: {},
      compensation: {},
      work_authorization: {},
      location: "Holme-on-Spalding-Moor",
      work_model: "onsite",
      status: "active",
      blueprint_status: "ready",
      blueprint_attempts: 0,
      updated_at: new Date().toISOString(),
    },
  ];
  db.screening_questions = [
    {
      id: BUNDLED_ID,
      position_id: POS,
      question: BUNDLED,
      answer_type: "boolean",
      required: true,
      dealbreaker: true,
      display_order: 0,
      must_have:
        "Hands-on mushroom picking experience and supervisory experience on a mushroom farm",
      why_asked: "Both are mandatory baseline requirements.",
    },
  ];
  db.audit_events = [];
});

async function save(change: (form: Record<string, unknown>) => Record<string, unknown>) {
  const { positionToEditForm } = await import("@/lib/positions/role-form");
  const { savePositionEdit } = await import("@/lib/position-edit.functions");
  const form = positionToEditForm(db.positions[0], db.screening_questions) as unknown as Record<
    string,
    unknown
  >;
  const { organization_id: _o, organization_name: _n, status: _s, visibility: _v, ...rest } = form;
  return savePositionEdit({
    data: change({ ...rest, headcount: 1 }),
    context: { userId: "33333333-3333-4333-8333-333333333333" },
  } as never) as Promise<{ ok: boolean }>;
}

describe("role editor save", () => {
  it("an unrelated edit saves while the stored bundled dealbreaker is unchanged", async () => {
    const res = await save((f) => ({ ...f, department: "Harvesting" }));
    expect(res.ok).toBe(true);
    expect(db.positions[0]!.department).toBe("Harvesting");
    expect(db.screening_questions.find((q) => q.id === BUNDLED_ID)?.question).toBe(BUNDLED);
  });

  it("a new bundled dealbreaker is refused with its split and nothing is written", async () => {
    const err = await save((f) => ({
      ...f,
      department: "Harvesting",
      screening_questions: [
        ...(f.screening_questions as Row[]),
        {
          question: "Do you have both a forklift licence and a CSCS card?",
          answer_type: "boolean",
          required: false,
          dealbreaker: true,
          must_have: "Site licences",
          why_asked: "Needed on site.",
        },
      ],
    })).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/^compound_dealbreaker: /);
    expect((err as Error).message).toContain(
      '"Do you have a forklift licence?" and "Do you have a CSCS card?"',
    );
    expect(writes).toEqual([]);
    expect(db.positions[0]!.department).toBeUndefined();
  });

  it("rewording the stored bundled dealbreaker without splitting it is refused", async () => {
    const err = await save((f) => ({
      ...f,
      screening_questions: (f.screening_questions as Row[]).map((q) =>
        q.id === BUNDLED_ID
          ? { ...q, question: BUNDLED.replace("commercial", "large commercial") }
          : q,
      ),
    })).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/^compound_dealbreaker: .* Screening question 1 \(/);
    expect(writes).toEqual([]);
  });

  it("the applied split saves: the original stays (answers kept) as a non-dealbreaker", async () => {
    const { applyDealbreakerSplit, findCompoundDealbreakers } =
      await import("@/lib/positions/compound-dealbreaker");
    const res = await save((f) => {
      const qs = f.screening_questions as Array<{
        id?: string;
        question: string;
        dealbreaker: boolean;
        required: boolean;
      }>;
      const [finding] = findCompoundDealbreakers(qs);
      return { ...f, screening_questions: applyDealbreakerSplit(qs, finding!) };
    });
    expect(res.ok).toBe(true);
    expect(db.screening_questions.map((q) => [q.question, q.dealbreaker])).toEqual([
      [BUNDLED, false],
      ["Do you have direct, hands-on mushroom picking experience?", true],
      ["Do you have supervisory experience on a commercial mushroom farm?", true],
    ]);
    expect(writes.filter((w) => w.table === "screening_questions" && w.kind === "delete")).toEqual(
      [],
    );
  });
});
