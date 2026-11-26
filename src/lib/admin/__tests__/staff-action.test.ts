/**
 * The internal staff-action route runs a screen's own handler for a named
 * staff member: non-staff are refused, the handler sees the actor as its
 * caller, its own validation applies, and nothing can make a role public.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const seen: Array<{ data: unknown; context: { userId: string } }> = [];

const published: unknown[] = [];
vi.mock("@/lib/position-edit.functions", () => ({
  publishPositionValidate: (i: unknown) => i,
  publishPositionHandler: async (a: { data: unknown }) => {
    published.push(a.data);
    return { ok: true };
  },
}));
const statusCalls: unknown[] = [];
vi.mock("@/lib/admin.functions", () => ({
  createPositionForClientValidate: (i: unknown) =>
    z.object({ organization_id: z.string().uuid(), title: z.string().min(2) }).parse(i),
  createPositionForClientHandler: async (a: { data: unknown; context: { userId: string } }) => {
    seen.push(a);
    return { ok: true, position: { id: "p1", status: "draft" } };
  },
  setPositionStatusValidate: (i: unknown) => i,
  setPositionStatusHandler: async (a: { data: unknown }) => {
    statusCalls.push(a.data);
    return { ok: true };
  },
}));
const exemptions: unknown[] = [];
vi.mock("@/lib/admin-payments.functions", () => ({
  grantPositionPaymentExemptionValidate: (i: unknown) => i,
  grantPositionPaymentExemptionHandler: async (a: { data: unknown }) => {
    exemptions.push(a.data);
    return { ok: true };
  },
}));

const reviews: unknown[] = [];
const recomputes: unknown[] = [];
const onBehalf: unknown[] = [];
const acknowledgements: unknown[] = [];
vi.mock("@/lib/candidate/answers-on-behalf.functions", () => ({
  recordAnswersOnBehalfValidate: (i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        source_note: z.string(),
        answers: z.array(z.object({ question_id: z.string().uuid(), value: z.unknown() })).min(1),
      })
      .parse(i),
  recordAnswersOnBehalfHandler: async (a: { data: unknown; context: { userId: string } }) => {
    onBehalf.push({ data: a.data, by: a.context.userId });
    return { ok: true, saved: 1, corrected: 0 };
  },
  acknowledgeRecruiterAnswersValidate: (i: unknown) =>
    z.object({ match_id: z.string().uuid() }).parse(i),
  acknowledgeRecruiterAnswersHandler: async (a: { data: unknown; context: { userId: string } }) => {
    acknowledgements.push({ data: a.data, by: a.context.userId });
    return { ok: true, pending: 1 };
  },
}));
vi.mock("@/lib/scoring-review.functions", () => ({
  submitHumanAdjustmentValidate: (i: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        reason: z.string().min(8),
        verdicts: z
          .array(
            z.object({
              requirement_id: z.string(),
              verdict: z.enum(["met", "partial", "not_met", "not_applicable"]),
              reason: z.string().min(8),
            }),
          )
          .min(1),
      })
      .parse(i),
  submitHumanAdjustmentHandler: async (a: { data: unknown; context: { userId: string } }) => {
    reviews.push({ data: a.data, by: a.context.userId });
    return { ok: true, final_score: 81.7 };
  },
  recomputeScoreValidate: (i: unknown) => z.object({ match_id: z.string().uuid() }).parse(i),
  recomputeScoreHandler: async (a: { data: unknown; context: { userId: string } }) => {
    recomputes.push({ data: a.data, by: a.context.userId });
    return { ok: true, reused: false };
  },
}));

const STAFF = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const admin = (staff: boolean) => ({ rpc: async () => ({ data: staff, error: null }) });

describe("runStaffAction", () => {
  it("refuses an actor who is not platform staff", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "create_position_for_client",
        input: { organization_id: ORG, title: "Role" },
      },
      { admin: admin(false) },
    );
    expect(out).toMatchObject({ ok: false, status: 403, error: "actor_not_staff" });
  });

  it("runs the screen's handler with the actor as the caller", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "create_position_for_client",
        input: { organization_id: ORG, title: "Enterprise Sales Director" },
      },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: true, result: { position: { status: "draft" } } });
    expect(seen.at(-1)!.context.userId).toBe(STAFF);
    expect(seen.at(-1)!.data).toEqual({ organization_id: ORG, title: "Enterprise Sales Director" });
  });

  it("applies the handler's own validation", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "create_position_for_client",
        input: { organization_id: "x", title: "R" },
      },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
  });

  it("runs only the status steps that take a role live", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    for (const action of ["submit", "approve", "activate"]) {
      const out = await runStaffAction(
        { actor_user_id: STAFF, op: "set_position_status", input: { id: ORG, action } },
        { admin: admin(true) },
      );
      expect(out.ok).toBe(true);
    }
    expect(statusCalls).toHaveLength(3);
    for (const action of ["pause", "close", "archive", "mark_filled", "reopen"]) {
      const out = await runStaffAction(
        { actor_user_id: STAFF, op: "set_position_status", input: { id: ORG, action } },
        { admin: admin(true) },
      );
      expect(out).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
    }
    expect(statusCalls).toHaveLength(3);
  });

  it("a payment waiver needs a written reason", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const short = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "grant_payment_exemption",
        input: { positionId: ORG, reason: "ok" },
      },
      { admin: admin(true) },
    );
    expect(short).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
    const ok = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "grant_payment_exemption",
        input: { positionId: ORG, reason: "Free trial" },
      },
      { admin: admin(true) },
    );
    expect(ok.ok).toBe(true);
    expect(exemptions).toEqual([{ positionId: ORG, reason: "Free trial" }]);
  });

  it("publishing names the job board; the posting save still cannot publish", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const none = await runStaffAction(
      { actor_user_id: STAFF, op: "publish_position", input: { id: ORG } },
      { admin: admin(true) },
    );
    expect(none).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
    const out = await runStaffAction(
      { actor_user_id: STAFF, op: "publish_position", input: { id: ORG, visibility: "public" } },
      { admin: admin(true) },
    );
    expect(out.ok).toBe(true);
    expect(published).toEqual([{ id: ORG, visibility: "public" }]);
  });

  it("records a reviewer's verdicts, Partial included, as the named staff member", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const input = {
      match_id: ORG,
      reason: "Recruiter call recorded",
      verdicts: [
        { requirement_id: "req-3", verdict: "partial", reason: "Adjacent experience only" },
      ],
    };
    const out = await runStaffAction(
      { actor_user_id: STAFF, op: "record_review", input },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: true, result: { final_score: 81.7 } });
    expect(reviews).toEqual([{ data: input, by: STAFF }]);
    const bad = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "record_review",
        input: {
          ...input,
          verdicts: [{ requirement_id: "req-3", verdict: "maybe", reason: "No such verdict" }],
        },
      },
      { admin: admin(true) },
    );
    expect(bad).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
    expect(reviews).toHaveLength(1);
  });

  it("recomputes a score through the review screen's own action", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      { actor_user_id: STAFF, op: "recompute_score", input: { match_id: ORG } },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: true, result: { reused: false } });
    expect(recomputes).toEqual([{ data: { match_id: ORG }, by: STAFF }]);
    const refused = await runStaffAction(
      { actor_user_id: STAFF, op: "recompute_score", input: { match_id: ORG } },
      { admin: admin(false) },
    );
    expect(refused).toMatchObject({ ok: false, status: 403, error: "actor_not_staff" });
    expect(recomputes).toHaveLength(1);
  });

  it("enters answers on a candidate's behalf and acknowledges them as the named staff member", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const input = {
      match_id: ORG,
      source_note: "Phone call with the candidate, 26 Nov",
      answers: [{ question_id: ORG, value: "yes" }],
    };
    const out = await runStaffAction(
      { actor_user_id: STAFF, op: "record_answers_on_behalf", input },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: true, result: { saved: 1 } });
    expect(onBehalf).toEqual([{ data: input, by: STAFF }]);

    const ack = await runStaffAction(
      { actor_user_id: STAFF, op: "acknowledge_recruiter_answers", input: { match_id: ORG } },
      { admin: admin(true) },
    );
    expect(ack).toMatchObject({ ok: true, result: { pending: 1 } });
    expect(acknowledgements).toEqual([{ data: { match_id: ORG }, by: STAFF }]);

    // A non-staff actor, or an entry with no answers, stores nothing.
    const refused = await runStaffAction(
      { actor_user_id: STAFF, op: "record_answers_on_behalf", input },
      { admin: admin(false) },
    );
    expect(refused).toMatchObject({ ok: false, status: 403, error: "actor_not_staff" });
    const bad = await runStaffAction(
      { actor_user_id: STAFF, op: "record_answers_on_behalf", input: { ...input, answers: [] } },
      { admin: admin(true) },
    );
    expect(bad).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
    expect(onBehalf).toHaveLength(1);
  });

  it("never makes a role public from the posting save", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      { actor_user_id: STAFF, op: "save_posting", input: { id: ORG, visibility: "public" } },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: false, status: 400, error: "visibility_not_allowed" });
  });
});
