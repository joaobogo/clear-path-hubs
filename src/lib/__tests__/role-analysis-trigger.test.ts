import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Owner report (8 Oct): "I applied for a role, it picked up, it didn't
 * automatically analyze."
 *
 * The run was fired un-awaited from the intake request, claimed the job, and
 * was dropped when the response went out; every later trigger was told
 * "already running". These tests drive the real runner, the save handler and
 * the role-page trigger against an in-memory database.
 */

// ---- a tiny in-memory PostgREST-ish client --------------------------------
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const updates: Array<{ table: string; patch: Row }> = [];

function matches(row: Row, filters: Array<(r: Row) => boolean>) {
  return filters.every((f) => f(row));
}

function query(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  let op: { kind: "select" } | { kind: "update"; patch: Row } | { kind: "insert"; rows: Row[] } = {
    kind: "select",
  };
  let single = false;
  const api: Record<string, unknown> = {};
  const rows = () => (db[table] ??= []);
  const run = () => {
    if (op.kind === "insert") {
      rows().push(...op.rows);
      return { data: op.rows, error: null };
    }
    const hit = rows().filter((r) => matches(r, filters));
    if (op.kind === "update") {
      for (const r of hit) Object.assign(r, op.patch);
      updates.push({ table, patch: op.patch });
    }
    if (single) return { data: hit[0] ?? null, error: null };
    return { data: hit, error: null, count: hit.length };
  };
  Object.assign(api, {
    select: () => api,
    update: (patch: Row) => ((op = { kind: "update", patch }), api),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), api),
    delete: () => api,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
    lt: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "") < v), api),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), api),
    or: (expr: string) => {
      const m = /blueprint_status\.in\.\(([^)]*)\)/.exec(expr);
      const allowed = m ? m[1].split(",") : [];
      filters.push((r) => r.blueprint_status == null || allowed.includes(String(r.blueprint_status)));
      return api;
    },
    order: () => api,
    limit: () => api,
    ilike: () => api,
    maybeSingle: () => ((single = true), Promise.resolve(run())),
    single: () => ((single = true), Promise.resolve(run())),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(run()).then(res, rej),
  });
  return api;
}

const admin = {
  from: (t: string) => query(t),
  rpc: vi.fn(async () => ({ data: false })),
  storage: { from: () => ({ download: async () => ({ data: null, error: "none" }) }) },
  auth: { admin: { getUserById: async () => ({ data: { user: { email: "a@b.co" } } }) } },
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: admin }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/authz/workspace-access", () => ({
  assertWorkspaceAccess: vi.fn(async () => ({ allowed: true, isStaff: false, canWrite: true })),
  assertWorkspaceWrite: vi.fn(async () => ({ allowed: true, canWrite: true })),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const b: Record<string, unknown> = {};
    b.middleware = () => b;
    b.inputValidator = (v: (i: unknown) => unknown) => ((b._v = v), b);
    b.handler = (h: (a: unknown) => unknown) => {
      const fn = async (args: { data: unknown; context: unknown }) =>
        h({ ...args, data: (b._v as (i: unknown) => unknown)(args.data) });
      (fn as unknown as Record<string, unknown>).handler = h;
      return fn;
    };
    return b;
  },
}));
// The analysis itself (JD reading, LLM) is not under test here.
vi.mock("@/lib/blueprint-engine.server", () => ({
  readJobDescription: vi.fn(async () => ({ text: "", source: "none", reason: "no_job_description" })),
  researchCompany: vi.fn(),
  generateBlueprint: vi.fn(),
}));

const POS = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function seedPosition(extra: Row) {
  db.positions = [
    {
      id: POS,
      organization_id: ORG,
      title: "Clinical Operations Manager",
      description: "Run our clinics.",
      requirements: [{ label: "CQC inspection experience", kind: "must_have" }],
      preferred_requirements: [],
      dealbreakers: [],
      intake_context: {},
      compensation: {},
      work_authorization: {},
      location: null,
      work_model: "remote",
      blueprint_attempts: 0,
      updated_at: ago(0),
      ...extra,
    },
  ];
  db.intake_submissions = [];
  db.screening_questions = [];
  db.audit_events = [];
  updates.length = 0;
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  updates.length = 0;
});

describe("runBlueprintForPosition reclaims a dropped run", () => {
  it("a run stuck 'in progress' with no heartbeat for 10+ minutes is claimed again", async () => {
    seedPosition({ blueprint_status: "analyzing_jd", updated_at: ago(20), blueprint_attempts: 1 });
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    const res = await runBlueprintForPosition(POS);
    expect(res.reason).not.toBe("already_running");
    const claim = updates.find((u) => u.patch.blueprint_attempts === 2);
    expect(claim?.patch.blueprint_status).toBe("analyzing_jd");
  });

  it("a live run is left alone", async () => {
    seedPosition({ blueprint_status: "drafting_blueprint", updated_at: ago(1) });
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    const res = await runBlueprintForPosition(POS);
    expect(res.reason).toBe("already_running");
    expect(updates).toEqual([]);
  });

  it("a queued role is claimed", async () => {
    seedPosition({ blueprint_status: "queued" });
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    await runBlueprintForPosition(POS);
    expect(updates[0]?.patch).toMatchObject({ blueprint_status: "analyzing_jd", blueprint_attempts: 1 });
  });
});

describe("the role page starts the analysis by itself (ensureRoleAnalysis)", () => {
  const ctx = { userId: "33333333-3333-4333-8333-333333333333" };

  it("starts a queued role", async () => {
    seedPosition({ blueprint_status: "queued" });
    const { ensureRoleAnalysis } = await import("@/lib/blueprint.functions");
    const res = await ensureRoleAnalysis({ data: { positionId: POS }, context: ctx } as never);
    expect(res.state).toBe("waiting");
    expect(res.started).toBe(true);
    expect(updates.some((u) => u.patch.blueprint_status === "analyzing_jd")).toBe(true);
  });

  it("does not start a second run while one is alive", async () => {
    seedPosition({ blueprint_status: "researching_company", updated_at: ago(2) });
    const { ensureRoleAnalysis } = await import("@/lib/blueprint.functions");
    const res = await ensureRoleAnalysis({ data: { positionId: POS }, context: ctx } as never);
    expect(res.started).toBe(false);
    expect(updates).toEqual([]);
  });
});

describe("saving an edit queues the analysis", () => {
  const ctx = { userId: "33333333-3333-4333-8333-333333333333" };

  async function save(position: Row, change: Partial<Record<string, unknown>> = {}) {
    seedPosition(position);
    const { positionToEditForm } = await import("@/lib/positions/role-form");
    const { savePositionEdit } = await import("@/lib/position-edit.functions");
    const form = positionToEditForm(db.positions[0]);
    const { organization_id: _o, organization_name: _n, status: _s, visibility: _v, ...rest } = form;
    return savePositionEdit({
      data: { ...rest, headcount: 1, ...change },
      context: ctx,
    } as never) as Promise<{ ok: boolean; analysis: string }>;
  }

  it("a role whose analysis never ran is queued on save — with no city and no time zone", async () => {
    const res = await save({ blueprint_status: "analyzing_jd", updated_at: ago(30) }, {
      location: "",
      remote_timezones: [],
      remote_anywhere_in_country: false,
    });
    expect(res.ok).toBe(true);
    expect(res.analysis).toBe("queued");
    expect(db.positions[0].blueprint_status).toBe("queued");
    expect(db.positions[0].blueprint_attempts).toBe(0);
  });

  it("an analysed role is re-analysed when its job description changes", async () => {
    const res = await save({ blueprint_status: "ready" }, { description: "A different role entirely now." });
    expect(res.analysis).toBe("queued");
  });

  it("an analysed role is left alone when nothing the analysis reads changed", async () => {
    const res = await save({ blueprint_status: "ready" }, { department: "Ops" });
    expect(res.analysis).toBe("ready");
    expect(db.positions[0].blueprint_status).toBe("ready");
  });
});

describe("submit starts the analysis in a request that stays open", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("the intake handler no longer fires an un-awaited run that gets dropped", () => {
    const handler = read("src/routes/api/public/express-intake.ts");
    expect(handler).not.toMatch(/runBlueprintForPosition\(/);
    expect(handler).toContain("intakePayloadToPosition(");
  });

  it("the intake page triggers blueprint-run as soon as the submit succeeds", () => {
    const page = read("src/routes/intake.tsx");
    const ok = page.indexOf('setSubmitError(body?.message || "We couldn\'t submit that.');
    const trigger = page.indexOf('fetch("/api/public/blueprint-run"', ok);
    const tracking = page.indexOf("trackFgv(FGV_EVENTS.formSubmit", ok);
    expect(ok).toBeGreaterThan(0);
    expect(trigger).toBeGreaterThan(ok);
    expect(trigger).toBeLessThan(tracking);
  });

  it("blueprint-run hands the intake's role to the (stale-aware) runner", async () => {
    seedPosition({ blueprint_status: "analyzing_jd", updated_at: ago(30), blueprint_attempts: 1 });
    db.intake_submissions = [{ id: "44444444-4444-4444-8444-444444444444", position_id: POS }];
    const { Route } = await import("@/routes/api/public/blueprint-run");
    const post = (Route.options as unknown as {
      server: { handlers: { POST: (a: { request: Request }) => Promise<Response> } };
    }).server.handlers.POST;
    const res = await post({
      request: new Request("http://localhost/api/public/blueprint-run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intakeId: "44444444-4444-4444-8444-444444444444" }),
      }),
    });
    const body = (await res.json()) as { reason: string | null };
    expect(body.reason).not.toBe("already_running");
    expect(updates.some((u) => u.patch.blueprint_attempts === 2)).toBe(true);
  });
});

describe("analysisDecision", () => {
  it("names each state the role page shows", async () => {
    const { analysisDecision } = await import("@/lib/blueprint-trigger");
    expect(analysisDecision({ blueprint_status: "queued" }).shouldStart).toBe(true);
    expect(analysisDecision({ blueprint_status: "analyzing_jd", updated_at: ago(1) }).state).toBe("running");
    expect(analysisDecision({ blueprint_status: "analyzing_jd", updated_at: ago(30) }).state).toBe("stalled");
    expect(analysisDecision({ blueprint_status: "ready" }).shouldStart).toBe(false);
    expect(
      analysisDecision({ blueprint_status: "failed", blueprint_error: "rate_limited", blueprint_attempts: 1 })
        .shouldStart,
    ).toBe(true);
    expect(
      analysisDecision({ blueprint_status: "failed", blueprint_error: "job_description_unreadable", blueprint_attempts: 1 })
        .shouldStart,
    ).toBe(false);
  });

  it("surfaces a missing secret on the admin health page instead of failing silently", async () => {
    const { blueprintHealthNotes } = await import("@/lib/blueprint-trigger");
    const notes = blueprintHealthNotes({ hasAiKey: false, hasCronSecret: false, stuck: 2, waiting: 0, failed: 0 });
    expect(notes.map((n) => n.text).join(" ")).toMatch(/LOVABLE_API_KEY/);
    expect(notes.map((n) => n.text).join(" ")).toMatch(/CRON_INVOKE_SECRET/);
  });
});

describe("review fixes: no takeover, no analysis on live roles, no background retry of dead ends", () => {
  it("a forced 'Try again' never takes over a live run", async () => {
    seedPosition({ blueprint_status: "drafting_blueprint", updated_at: ago(1), blueprint_attempts: 1 });
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    const res = await runBlueprintForPosition(POS, { force: true });
    expect(res.reason).toBe("already_running");
    expect(updates).toEqual([]);
  });

  it("a forced retry reclaims a dead run, and only while it is still dead", async () => {
    seedPosition({ blueprint_status: "drafting_blueprint", updated_at: ago(30), blueprint_attempts: 1 });
    const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
    const res = await runBlueprintForPosition(POS, { force: true });
    expect(res.reason).not.toBe("already_running");
    expect(updates[0]?.patch.blueprint_status).toBe("analyzing_jd");
  });

  it("a row without a readable heartbeat is not called dead", async () => {
    const { isBlueprintStale, analysisDecision } = await import("@/lib/blueprint-trigger");
    expect(isBlueprintStale("analyzing_jd", null)).toBe(false);
    expect(analysisDecision({ blueprint_status: "analyzing_jd" }).state).toBe("running");
  });

  it("a live, paused or closed role is never analysed from a page view", async () => {
    const { analysisDecision } = await import("@/lib/blueprint-trigger");
    for (const status of ["active", "paused", "closed", "archived", "filled"]) {
      const d = analysisDecision({ status, blueprint_status: "queued" });
      expect(d.shouldStart, status).toBe(false);
      expect(d.state, status).toBe("skipped");
    }
    expect(analysisDecision({ status: "submitted", blueprint_status: "queued" }).shouldStart).toBe(true);

    seedPosition({ status: "active", blueprint_status: "queued" });
    const { ensureRoleAnalysis } = await import("@/lib/blueprint.functions");
    const res = (await ensureRoleAnalysis({
      data: { positionId: POS },
      context: { userId: "33333333-3333-4333-8333-333333333333" },
    } as never)) as { started: boolean; state: string };
    expect(res.started).toBe(false);
    expect(res.state).toBe("skipped");
    expect(updates).toEqual([]);
  });

  it("the drain leaves a dead-end failure to a person and skips a live role", async () => {
    seedPosition({ blueprint_status: "failed", blueprint_error: "job_description_unreadable", updated_at: ago(30), blueprint_attempts: 1 });
    db.positions.push({
      ...db.positions[0],
      id: "33333333-3333-4333-8333-333333333333",
      status: "active",
      blueprint_status: "queued",
      updated_at: ago(30),
    });
    const { drainStuckBlueprints } = await import("@/lib/blueprint-drain.server");
    const results = await drainStuckBlueprints(admin as never);
    expect(results.map((r) => r.result).sort()).toEqual(["skipped:failed", "skipped:skipped"]);
    expect(updates).toEqual([]);
  });

  it("an edit made while a run is in flight asks for one more run instead of being lost", async () => {
    seedPosition({ blueprint_status: "drafting_blueprint", updated_at: ago(1), blueprint_attempts: 1 });
    const { savePositionEdit } = await import("@/lib/position-edit.functions");
    const { positionToEditForm } = await import("@/lib/positions/role-form");
    const form = positionToEditForm(db.positions[0]);
    const { organization_id: _o, organization_name: _n, status: _s, visibility: _v, ...rest } = form;
    const res = (await savePositionEdit({
      data: { ...rest, headcount: 1, description: "Run our clinics across the whole region." },
      context: { userId: "33333333-3333-4333-8333-333333333333" },
    } as never)) as { analysis: string };
    expect(res.analysis).toBe("rerun_requested");
    const saved = db.positions[0].intake_context as Record<string, unknown>;
    expect(typeof saved.blueprint_rerun_requested_at).toBe("string");
    expect(db.positions[0].blueprint_status).toBe("drafting_blueprint");
  });
});
