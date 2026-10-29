/**
 * B2: a criteria change through the normal save path rescores every match on
 * the role through the existing queue, recomputes eligibility when a
 * dealbreaker moved, and notifies admins once. It never approves anything or
 * changes client visibility.
 */
import { describe, expect, it } from "vitest";
import {
  criteriaSignature,
  describeCriteriaChange,
  rescoreSummary,
  selectMatchesToRequeue,
  type CriteriaSnapshot,
} from "@/lib/scoring/requirement-change";
import { rescoreAfterCriteriaChange } from "@/lib/scoring/requirement-change-rescore.server";

const base: CriteriaSnapshot = {
  requirements: [
    { label: "10+ years of marketing", kind: "must_have", filters: true, rank: 1 },
    { label: "Experience in the Korean market", kind: "must_have", filters: true, rank: 2 },
  ],
  preferred_requirements: [{ label: "Arabic language skills", kind: "nice_to_have" }],
  dealbreakers: [{ label: "Cannot start within six weeks" }],
  screening_questions: [
    { id: "q1", question: "Can you start within six weeks?", answer_type: "boolean", dealbreaker: true, required: true },
    { id: "q2", question: "Do you speak Arabic?", answer_type: "boolean", dealbreaker: false },
  ],
};

describe("describeCriteriaChange", () => {
  it("no change when only order, case, rank or spacing differ", () => {
    const same: CriteriaSnapshot = {
      ...base,
      requirements: [
        { label: "experience in the korean  market", kind: "must_have", filters: true, rank: 9 },
        { label: "10+ years of marketing", kind: "must_have", filters: true, rank: 1 },
      ],
    };
    expect(describeCriteriaChange(base, same).changed).toBe(false);
    expect(criteriaSignature(base)).toBe(criteriaSignature(same));
  });

  it("names what moved", () => {
    const after: CriteriaSnapshot = {
      ...base,
      requirements: [{ label: "10+ years of marketing", kind: "must_have" }, { label: "Experience in the GCC", kind: "must_have" }],
      dealbreakers: [],
    };
    const c = describeCriteriaChange(base, after);
    expect(c.changed).toBe(true);
    expect(c.parts).toEqual(["must-haves +1 −1", "deal-breakers −1"]);
    expect(c.eligibilityAffected).toBe(false);
  });

  it("a dealbreaker question change affects eligibility; a plain question does not", () => {
    const flipped = {
      ...base,
      screening_questions: base.screening_questions!.map((q) => (q.id === "q1" ? { ...q, dealbreaker: false } : q)),
    };
    expect(describeCriteriaChange(base, flipped).eligibilityAffected).toBe(true);
    const reworded = {
      ...base,
      screening_questions: base.screening_questions!.map((q) =>
        q.id === "q2" ? { ...q, question: "Do you read and write Arabic?" } : q,
      ),
    };
    const c = describeCriteriaChange(base, reworded);
    expect(c.changed).toBe(true);
    expect(c.eligibilityAffected).toBe(false);
  });

  it("a must-have moved to nice-to-have is a change", () => {
    const moved: CriteriaSnapshot = {
      ...base,
      requirements: [{ label: "10+ years of marketing", kind: "must_have", filters: true }],
      preferred_requirements: [
        { label: "Arabic language skills", kind: "nice_to_have" },
        { label: "Experience in the Korean market", kind: "nice_to_have", filters: false },
      ],
    };
    expect(describeCriteriaChange(base, moved).parts).toEqual(["must-haves −1", "preferred requirements +1"]);
  });
});

describe("selectMatchesToRequeue", () => {
  it("queues scored and reviewable matches, leaves in-flight, unreadable-CV and closed ones", () => {
    const out = selectMatchesToRequeue(
      [
        { id: "a", processing_state: "scored", stage: "reviewing" },
        { id: "b", processing_state: "manual_review_required", stage: "new" },
        { id: "c", processing_state: "scoring", stage: "new" },
        { id: "d", processing_state: "ocr_required", stage: "new" },
        { id: "e", processing_state: "scored", stage: "hired" },
        { id: "f", processing_state: "queued", stage: "new" },
        { id: "g", processing_state: "ready_to_score", rescore_queued_at: "2026-10-29T12:00:00Z" },
      ],
      "2026-10-29T11:00:00Z",
    );
    expect(out.queue).toEqual(["a", "b", "f"]);
    expect(out.skipped).toEqual([
      { id: "c", reason: "in_flight" },
      { id: "d", reason: "cv_needs_staff" },
      { id: "e", reason: "closed_stage" },
      { id: "g", reason: "already_queued" },
    ]);
  });
});

describe("rescoreSummary", () => {
  it("is one short line that promises nothing is approved", () => {
    const s = rescoreSummary({ title: "Group Marketing Manager", parts: ["must-haves +1"], queued: 3, skipped: 1 });
    expect(s.title).toBe("Requirements changed — Group Marketing Manager");
    expect(s.body).toMatch(/^must-haves \+1\. 3 candidates queued for rescoring through the full pipeline\./);
    expect(s.body).toMatch(/nothing is approved or shown to the client/);
  });
});

/** A minimal stand-in for the service client: records every write. */
function fakeAdmin(opts: { matches: Array<Record<string, unknown>>; existingEvent?: boolean; staff?: string[] }) {
  const writes: Array<{ table: string; op: string; payload: unknown; filter?: unknown }> = [];
  const rpcs: Array<{ fn: string; args: unknown }> = [];
  const builder = (table: string) => {
    let op = "select";
    let payload: unknown = null;
    let filter: unknown = null;
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      in: (_c: string, v: unknown) => {
        filter = v;
        return b;
      },
      update: (p: unknown) => {
        op = "update";
        payload = p;
        return b;
      },
      insert: (p: unknown) => {
        op = "insert";
        payload = p;
        writes.push({ table, op, payload });
        return b;
      },
      maybeSingle: async () => ({ data: table === "notification_events" && opts.existingEvent ? { id: "ev0" } : null }),
      single: async () => ({ data: { id: "ev1" }, error: null }),
      then: (resolve: (v: unknown) => void) => {
        if (op === "update") writes.push({ table, op, payload, filter });
        const data =
          table === "candidate_matches"
            ? opts.matches
            : table === "memberships"
              ? (opts.staff ?? []).map((user_id) => ({ user_id }))
              : [];
        resolve({ data, error: null });
      },
    };
    return b;
  };
  return {
    client: {
      from: builder,
      rpc: async (fn: string, args: unknown) => {
        rpcs.push({ fn, args });
        return { data: null, error: null };
      },
    },
    writes,
    rpcs,
  };
}

describe("rescoreAfterCriteriaChange", () => {
  const after: CriteriaSnapshot = {
    ...base,
    screening_questions: base.screening_questions!.map((q) => (q.id === "q1" ? { ...q, dealbreaker: false } : q)),
    requirements: [...(base.requirements as unknown[]), { label: "Retail experience", kind: "must_have" }],
  };
  const call = (admin: unknown, b = base, a = after) =>
    rescoreAfterCriteriaChange({
      admin,
      positionId: "pos-1",
      organizationId: "org-1",
      title: "Group Marketing Manager",
      before: b,
      after: a,
      actorUserId: "staff-1",
      savedAt: "2026-10-29T10:00:00Z",
      trace_id: "t1",
    });

  it("does nothing at all when the criteria did not change", async () => {
    const f = fakeAdmin({ matches: [{ id: "m1", processing_state: "scored" }] });
    const out = await call(f.client, base, { ...base });
    expect(out).toMatchObject({ changed: false, queued: 0 });
    expect(f.writes).toEqual([]);
    expect(f.rpcs).toEqual([]);
  });

  it("marks stale, queues through the existing queue, recomputes eligibility and notifies other admins", async () => {
    const f = fakeAdmin({
      matches: [
        { id: "m1", processing_state: "scored", stage: "reviewing" },
        { id: "m2", processing_state: "enriching", stage: "new" },
      ],
      staff: ["staff-1", "staff-2"],
    });
    const out = await call(f.client);
    expect(out).toMatchObject({ changed: true, queued: 1, skipped: 1, notified: 1, eligibility_recomputed: true });
    expect(f.rpcs.map((r) => r.fn)).toEqual(["mark_position_scores_stale", "recompute_screening_eligibility"]);
    expect(f.rpcs[1]!.args).toEqual({ p_position_id: "pos-1", p_apply: true });
    const queueWrite = f.writes.find((w) => w.table === "candidate_matches" && w.op === "update");
    expect(queueWrite?.filter).toEqual(["m1"]);
    expect(Object.keys(queueWrite?.payload as object).sort()).toEqual(["processing_state", "rescore_queued_at"]);
    expect((queueWrite?.payload as Record<string, unknown>).processing_state).toBe("ready_to_score");
    // Never approval, visibility or stage.
    for (const w of f.writes) {
      const p = JSON.stringify(w.payload);
      expect(p).not.toMatch(/client_visibility|admin_status|approved_score_run_id|"stage"/);
    }
    const notes = f.writes.find((w) => w.table === "notifications")?.payload as Array<Record<string, unknown>>;
    expect(notes.map((n) => n.recipient_user_id)).toEqual(["staff-2"]);
    expect(notes[0]!.audience).toBe("admin");
    expect(String(notes[0]!.body)).toMatch(/1 candidate queued for rescoring/);
  });

  it("a repeated delivery of the same save notifies once", async () => {
    const f = fakeAdmin({ matches: [{ id: "m1", processing_state: "scored" }], existingEvent: true, staff: ["s2"] });
    const out = await call(f.client);
    expect(out.notified).toBe(0);
    expect(f.writes.some((w) => w.table === "notifications")).toBe(false);
  });
});
