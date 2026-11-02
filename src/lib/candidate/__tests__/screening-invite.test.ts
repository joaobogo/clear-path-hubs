/**
 * Owner item 6b (research, 2 Nov 2026): "Applications that arrive by direct
 * email (Adiya) get no screening questions; send the screening link
 * automatically."
 *
 * Adiya's CV reached the team by email and staff entered it as an application
 * (source 'staff_entry:direct-email-2026-11-01', source_channel 'direct_email',
 * consent without the form's stamp) on Hughes Mushrooms' Mushroom Harvesting
 * Manager role, which asks five questions. The record had zero answers and no
 * way for her to give them. These tests drive the rules, the automatic sweep,
 * the staff button and the candidate's own answer flow against an in-memory
 * database.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
/** "<table>:<select|insert|update|upsert>" -> the error that call returns. */
const failures: Record<string, { message: string; code?: string }> = {};
/** Every PostgREST `.or()` the code issues (the sweep must not need one). */
const orCalls: string[] = [];

function likeToRegExp(pattern: string): RegExp {
  const body = pattern
    .split("")
    .map((c) => (c === "%" ? ".*" : c === "_" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`^${body}$`);
}

function get(row: Row, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v == null ? v : (v as Row)[k]), row);
}

function query(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  let op:
    | { kind: "select" }
    | { kind: "update"; patch: Row }
    | { kind: "insert"; rows: Row[] }
    | { kind: "upsert"; rows: Row[]; conflict: string[]; ignore: boolean } = { kind: "select" };
  let single = false;
  let limit = Infinity;
  const rows = () => (db[table] ??= []);
  const run = () => {
    const fail = failures[`${table}:${op.kind}`];
    if (fail) return { data: null, error: fail };
    if (op.kind === "insert") {
      rows().push(...op.rows.map((r) => ({ ...r })));
      return { data: op.rows, error: null };
    }
    if (op.kind === "upsert") {
      const { conflict, ignore } = op;
      for (const r of op.rows) {
        const hit = rows().find((x) => conflict.every((k) => x[k] === r[k]));
        if (hit && !ignore) Object.assign(hit, r);
        if (!hit) rows().push({ ...r });
      }
      return { data: null, error: null };
    }
    const hit = rows()
      .filter((r) => filters.every((f) => f(r)))
      .slice(0, limit);
    if (op.kind === "update") for (const r of hit) Object.assign(r, op.patch);
    if (single) return { data: hit[0] ?? null, error: null };
    return { data: hit, error: null };
  };
  const api: Record<string, unknown> = {
    select: () => api,
    update: (patch: Row) => ((op = { kind: "update", patch }), api),
    insert: (r: Row | Row[]) => ((op = { kind: "insert", rows: Array.isArray(r) ? r : [r] }), api),
    upsert: (r: Row[], o: { onConflict: string; ignoreDuplicates?: boolean }) => (
      (op = {
        kind: "upsert",
        rows: r,
        conflict: o.onConflict.split(","),
        ignore: !!o.ignoreDuplicates,
      }),
      api
    ),
    eq: (k: string, v: unknown) => (filters.push((r) => get(r, k) === v), api),
    is: (k: string, v: unknown) => (filters.push((r) => (get(r, k) ?? null) === v), api),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(get(r, k))), api),
    gte: (k: string, v: string) => (filters.push((r) => String(get(r, k)) >= v), api),
    lte: (k: string, v: string) => (filters.push((r) => String(get(r, k)) <= v), api),
    like: (k: string, pattern: string) => (
      filters.push((r) => likeToRegExp(pattern).test(String(get(r, k) ?? ""))),
      api
    ),
    contains: (k: string, v: Row) => (
      filters.push((r) => {
        const have = (get(r, k) ?? {}) as Row;
        return Object.entries(v).every(([kk, vv]) => have[kk] === vv);
      }),
      api
    ),
    ilike: (k: string, v: string) => (
      filters.push((r) => String(get(r, k) ?? "").toLowerCase() === v.toLowerCase()),
      api
    ),
    or: (expr: string) => {
      // The sweep reads an allowlist with in/like; an `or` would mean a
      // "not the form" filter crept back in, which admits staff assignments.
      orCalls.push(expr);
      return api;
    },
    order: () => api,
    limit: (n: number) => ((limit = n), api),
    maybeSingle: () => ((single = true), Promise.resolve(run())),
    single: () => ((single = true), Promise.resolve(run())),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(run()).then(res, rej),
  };
  return api;
}

const admin = { from: (t: string) => query(t) };
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: admin }));
const sendTemplateEmail = vi.fn(async (..._args: unknown[]) => ({ sent: true as const }));
vi.mock("@/lib/email-templates/send-email", () => ({ sendTemplateEmail }));
// The drain tests import the pipeline runner: its scorer is a spy, so a held
// rescore can be proven never to reach it (and no score run is ever written).
const { executeScoring } = vi.hoisted(() => ({
  executeScoring: vi.fn(async (..._args: unknown[]) => {
    throw new Error("executeScoring must not run in these tests");
  }),
}));
vi.mock("@/lib/scoring-service.server", () => ({ executeScoring }));

import {
  SCREENING_INVITE_GRACE_MS,
  cameThroughApplyForm,
  decideAutomaticInvite,
  decideStaffInvite,
  lateAnswerRescoreBlock,
  prepareLateAnswers,
  screeningLinkSource,
  screeningStillOpen,
  unansweredQuestions,
} from "../screening-invite";
import { runScreeningInvites, sendScreeningInviteByStaff } from "../screening-invite.server";
import { answerScreeningByReference, loadScreeningByReference } from "../screening-answers.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

// ---- Hughes Mushrooms fixture (questions as stored for the live role) -------
const POS = "9466d8ac-0b74-4b14-94e9-0e9d56021fa2";
const ORG = "0a0a0a0a-0000-4000-8000-000000000001";
const ADIYA_APP = "8faaa385-59a0-45f5-8ded-5afbc73b37cc";
const ADIYA_MATCH = "b058712e-53c1-4072-9cf5-43c3d84b9801";
const ADIYA_EMAIL = "adiya.candidate@mail.co.uk";
const Q = {
  picking: "7da77185-54dc-4fd9-89ea-1f960fee0fdb",
  rota: "9816fc81-6e28-4d8e-815d-ee86f37b1f2c",
  english: "7b815ce0-7af7-45ba-a4b5-34e7044ded23",
  workAuth: "c5b1023e-0b34-40be-b352-ceda257589d6",
  haccp: "4b294949-8742-4fcd-847a-2e2823fca88a",
};
const QUESTIONS = [
  {
    id: Q.picking,
    position_id: POS,
    display_order: 0,
    answer_type: "boolean",
    required: true,
    dealbreaker: true,
    question:
      "Do you have direct, hands-on mushroom picking experience as well as supervisory experience on a commercial mushroom farm?",
    why_asked:
      "Both hands-on picking knowledge and farm supervisory experience are mandatory baseline requirements.",
  },
  {
    id: Q.rota,
    position_id: POS,
    display_order: 1,
    answer_type: "boolean",
    required: true,
    dealbreaker: true,
    question:
      "Are you able to work 100% onsite in Holme-on-Spalding-Moor on a 5-days-out-of-7 rota, including weekends and overtime during peak periods?",
    why_asked: "The facility runs 24/7 and demands flexible, site-based presence.",
  },
  {
    id: Q.english,
    position_id: POS,
    display_order: 2,
    answer_type: "boolean",
    required: true,
    dealbreaker: true,
    question:
      "Are you fluent in English, both written and spoken, to deliver staff training, disciplinary processes, and cross-departmental coordination?",
    why_asked:
      "English fluency is specified as required for operational and safety management across site teams.",
  },
  {
    id: Q.workAuth,
    position_id: POS,
    display_order: 3,
    answer_type: "single_choice",
    required: true,
    dealbreaker: false,
    question: "What is your current UK work authorization status?",
    why_asked:
      "Identifies immediate readiness to deploy versus candidates requiring the employer-offered visa sponsorship.",
  },
  {
    id: Q.haccp,
    position_id: POS,
    display_order: 4,
    answer_type: "boolean",
    required: false,
    dealbreaker: false,
    question:
      "Do you hold an Advanced Food Hygiene qualification or direct experience participating in HACCP/TACCP/VACCP food safety teams?",
    why_asked:
      "Advanced food safety knowledge is listed as desirable for site compliance leadership.",
  },
];

const NOW = new Date("2026-11-03T09:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
const ref = (id: string) => id.replace(/-/g, "").slice(0, 6).toUpperCase();

function staffEntryApp(over: Row = {}): Row {
  return {
    id: ADIYA_APP,
    created_at: minutesAgo(30),
    status: "submitted",
    withdrawn_at: null,
    is_test_record: false,
    source: "staff_entry:direct-email-2026-11-01",
    source_channel: "direct_email",
    source_kind: "inbound",
    consent: { terms: false, source: "cv_sent_to_staff", network_opt_in: false },
    position_id: POS,
    candidate_profile_id: "cp-adiya",
    screening_invite_status: null,
    candidate_profiles: { full_name: "Adiya Vatsa", email: ADIYA_EMAIL },
    positions: {
      title: "Mushroom Harvesting Manager",
      status: "active",
      organization_id: ORG,
      organizations: { name: "Hughes Mushrooms" },
    },
    ...over,
  };
}

const MACHINE_RUN = "aaaaaaaa-0000-4000-8000-000000000001";
const HUMAN_RUN = "13b0e499-46e3-4b24-bb75-30cce7082718";

function seed(apps: Row[], answers: Row[] = [], match: Row = {}) {
  for (const k of Object.keys(db)) delete db[k];
  db.applications = apps;
  db.screening_questions = QUESTIONS.map((q) => ({
    ...q,
    preferred_answer: q.answer_type === "boolean" ? true : null,
  }));
  db.application_answers = answers;
  db.organizations = [{ id: ORG, is_test_record: false, is_demo: false }];
  db.candidate_matches = [
    {
      id: ADIYA_MATCH,
      application_id: ADIYA_APP,
      organization_id: ORG,
      position_id: POS,
      candidate_profile_id: "cp-adiya",
      admin_status: "pending",
      stage: "new",
      client_visibility: "hidden",
      eligibility_status: "eligible",
      current_score_run_id: MACHINE_RUN,
      approved_score_run_id: null,
      ...match,
    },
  ];
  db.score_runs = [
    { id: MACHINE_RUN, evaluation_method: "deterministic" },
    { id: HUMAN_RUN, evaluation_method: "human_adjusted" },
  ];
  db.processing_jobs = [];
  db.audit_events = [];
  db.tasks = [];
}

beforeEach(() => {
  process.env.LOVABLE_API_KEY = "test-key";
  sendTemplateEmail.mockClear();
  for (const k of Object.keys(failures)) delete failures[k];
  orCalls.length = 0;
});

// ---------------------------------------------------------------------------
describe("which applications are invited automatically", () => {
  const base = { questionCount: 5, answerCount: 0, hasEmail: true, now: NOW };

  it("invites Adiya's direct-email application once the staff grace period has passed", () => {
    const app = staffEntryApp() as never;
    expect(cameThroughApplyForm(app)).toBe(false);
    expect(decideAutomaticInvite({ ...base, app })).toEqual({ action: "send" });
    const fresh = staffEntryApp({
      created_at: new Date(NOW.getTime() - SCREENING_INVITE_GRACE_MS + 60_000).toISOString(),
    });
    expect(decideAutomaticInvite({ ...base, app: fresh as never })).toEqual({ action: "wait" });
  });

  it("never sends retroactively: a row that existed before the migration is left alone", () => {
    const app = staffEntryApp({ screening_invite_status: "predates_feature" }) as never;
    expect(decideAutomaticInvite({ ...base, app })).toEqual({
      action: "skip",
      reason: "predates_feature",
    });
    const sent = staffEntryApp({ screening_invite_status: "sent" }) as never;
    expect(decideAutomaticInvite({ ...base, app: sent })).toEqual({
      action: "skip",
      reason: "already_decided",
    });
  });

  it("leaves applications the candidate filled in on the form alone", () => {
    for (const over of [
      { source_channel: "public_job_board", source: "public_job_board:abc" },
      {
        source_channel: null,
        source: "web",
        consent: { terms: true, question_version: 1793577600 },
      },
    ]) {
      const app = staffEntryApp(over) as never;
      expect(cameThroughApplyForm(app)).toBe(true);
      expect(decideAutomaticInvite({ ...base, app })).toEqual({
        action: "skip",
        reason: "form_application",
      });
    }
  });

  it("skips answered, closed, stale, test and address-less applications", () => {
    const skip = (over: Row, extra: Partial<typeof base> = {}) =>
      decideAutomaticInvite({ ...base, ...extra, app: staffEntryApp(over) as never });
    expect(skip({}, { answerCount: 1 })).toEqual({ action: "skip", reason: "already_answered" });
    expect(skip({}, { questionCount: 0 })).toEqual({ action: "skip", reason: "no_questions" });
    expect(skip({ status: "withdrawn", withdrawn_at: minutesAgo(5) })).toEqual({
      action: "skip",
      reason: "application_closed",
    });
    expect(skip({ status: "rejected" })).toEqual({ action: "skip", reason: "application_closed" });
    expect(skip({ created_at: minutesAgo(8 * 24 * 60) })).toEqual({
      action: "skip",
      reason: "outside_window",
    });
    expect(skip({ is_test_record: true })).toEqual({ action: "skip", reason: "test_record" });
    expect(skip({}, { hasEmail: false })).toEqual({ action: "skip", reason: "no_email" });
  });
});

describe("what still counts as unanswered", () => {
  it("is open with no answers, or with a required question left; done once only optional ones remain", () => {
    expect(screeningStillOpen(QUESTIONS, [])).toBe(true);
    expect(screeningStillOpen(QUESTIONS, [Q.picking, Q.rota])).toBe(true);
    expect(screeningStillOpen(QUESTIONS, [Q.picking, Q.rota, Q.english, Q.workAuth])).toBe(false);
    expect(screeningStillOpen([], [])).toBe(false);
    expect(unansweredQuestions(QUESTIONS, [Q.picking]).map((q) => q.id)).toEqual([
      Q.rota,
      Q.english,
      Q.workAuth,
      Q.haccp,
    ]);
  });

  it("validates a late submission like the apply form, without overwriting stored answers", () => {
    const open = unansweredQuestions(QUESTIONS, [Q.picking]);
    const missing = prepareLateAnswers(open, [{ question_id: Q.rota, value: true }]);
    expect(missing).toEqual({
      ok: false,
      message: `Please answer the required screening question: "${QUESTIONS[2].question}"`,
    });

    const ok = prepareLateAnswers(open, [
      { question_id: Q.picking, value: false }, // already answered: dropped, never overwritten
      { question_id: Q.rota, value: "yes" },
      { question_id: Q.english, value: true },
      { question_id: Q.workAuth, value: "  Needs employer visa sponsorship  " },
      { question_id: "00000000-0000-4000-8000-000000000000", value: "another role" },
    ]);
    expect(ok).toEqual({
      ok: true,
      rows: [
        { question_id: Q.rota, value: true },
        { question_id: Q.english, value: true },
        { question_id: Q.workAuth, value: "Needs employer visa sponsorship" },
      ],
    });

    expect(
      prepareLateAnswers(open, [
        { question_id: Q.rota, value: "maybe" },
        { question_id: Q.english, value: true },
        { question_id: Q.workAuth, value: "Settled status" },
      ]),
    ).toMatchObject({ ok: false, message: expect.stringContaining("Choose yes or no") });
    expect(
      prepareLateAnswers(open, [
        { question_id: Q.rota, value: true },
        { question_id: Q.english, value: true },
        { question_id: Q.workAuth, value: "x".repeat(1001) },
      ]),
    ).toMatchObject({ ok: false });
    expect(prepareLateAnswers([QUESTIONS[4]], [])).toEqual({
      ok: false,
      message: "Answer at least one question before sending.",
    });
  });

  it("lets staff send for any open allowlisted application with questions left, including old ones", () => {
    const adiya = staffEntryApp() as never as Parameters<typeof decideStaffInvite>[0]["app"];
    const go = (over: Partial<Parameters<typeof decideStaffInvite>[0]> = {}) =>
      decideStaffInvite({
        app: adiya,
        positionStatus: "active",
        questions: QUESTIONS,
        answeredIds: [],
        hasEmail: true,
        ...over,
      });
    expect(go()).toEqual({ ok: true });
    expect(go({ answeredIds: [Q.picking, Q.rota, Q.english, Q.workAuth] })).toMatchObject({
      ok: false,
    });
    expect(go({ app: { ...adiya, status: "archived" } })).toMatchObject({ ok: false });
    expect(go({ positionStatus: "filled" })).toMatchObject({ ok: false });
    expect(go({ hasEmail: false })).toMatchObject({ ok: false });
  });
});

// ---------------------------------------------------------------------------
describe("the automatic sweep", () => {
  it("emails Adiya once, records it, and never again", async () => {
    seed(
      [
        staffEntryApp(),
        // Created before the migration: never emailed automatically.
        staffEntryApp({
          id: "11111111-1111-4111-8111-111111111111",
          screening_invite_status: "predates_feature",
        }),
        // A form application with zero answers (all questions optional elsewhere).
        staffEntryApp({
          id: "22222222-2222-4222-8222-222222222222",
          source_channel: "public_job_board",
          source: "public_job_board:k",
        }),
        // A staff entry that already has answers.
        staffEntryApp({ id: "33333333-3333-4333-8333-333333333333" }),
      ],
      [
        {
          application_id: "33333333-3333-4333-8333-333333333333",
          question_id: Q.picking,
          answer: { value: true },
        },
      ],
    );

    const first = await runScreeningInvites(admin, { now: NOW });
    expect(first).toMatchObject({ sent: 1, failed: 0 });
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
    const [template, to, opts] = sendTemplateEmail.mock.calls[0] as [string, string, Row];
    expect(template).toBe("screening-questions");
    expect(to).toBe(ADIYA_EMAIL);
    expect(opts.idempotencyKey).toBe(`screening-invite-${ADIYA_APP}`);
    expect(opts.templateData).toMatchObject({
      candidateFirstName: "Adiya",
      positionTitle: "Mushroom Harvesting Manager",
      organizationName: "Hughes Mushrooms",
      reference: ref(ADIYA_APP),
      questionCount: 5,
      statusUrl: `https://taasflow.com/apply/status?ref=${ref(ADIYA_APP)}`,
    });

    const byId = (id: string) => db.applications.find((a) => a.id === id)!;
    expect(byId(ADIYA_APP).screening_invite_status).toBe("sent");
    expect(byId(ADIYA_APP).screening_invite_sent_at).toBeTruthy();
    expect(byId("11111111-1111-4111-8111-111111111111").screening_invite_status).toBe(
      "predates_feature",
    );
    expect(byId("22222222-2222-4222-8222-222222222222").screening_invite_status).toBeNull();
    expect(byId("33333333-3333-4333-8333-333333333333")).toMatchObject({
      screening_invite_status: "not_needed",
      screening_invite_error_code: "already_answered",
    });

    const second = await runScreeningInvites(admin, { now: new Date(NOW.getTime() + 2 * 60_000) });
    expect(second.sent).toBe(0);
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
    // Nothing about the match moved.
    expect(db.candidate_matches[0]).toMatchObject({
      admin_status: "pending",
      stage: "new",
      client_visibility: "hidden",
    });
  });

  it("waits out the grace period and records a held address as suppressed", async () => {
    seed([staffEntryApp({ created_at: minutesAgo(5) })]);
    expect((await runScreeningInvites(admin, { now: NOW })).considered).toBe(0);
    expect(sendTemplateEmail).not.toHaveBeenCalled();

    seed([staffEntryApp()]);
    sendTemplateEmail.mockResolvedValueOnce({
      sent: false,
      reason: "recipient_suppressed",
    } as never);
    expect(await runScreeningInvites(admin, { now: NOW })).toMatchObject({ suppressed: 1 });
    expect(db.applications[0]).toMatchObject({
      screening_invite_status: "suppressed",
      screening_invite_error_code: "recipient_suppressed",
    });
  });
});

describe("the staff button", () => {
  it("sends for an application that predates the feature and leaves an audit row", async () => {
    seed([staffEntryApp({ screening_invite_status: "predates_feature" })]);
    const out = await sendScreeningInviteByStaff(admin, {
      applicationId: ADIYA_APP,
      actorUserId: "staff-1",
      now: NOW,
    });
    expect(out).toMatchObject({ ok: true, status: "sent" });
    expect(sendTemplateEmail).toHaveBeenCalledTimes(1);
    expect((sendTemplateEmail.mock.calls[0] as [string, string, Row])[2].idempotencyKey).toBe(
      `screening-invite-${ADIYA_APP}-staff-${Math.floor(NOW.getTime() / 60_000)}`,
    );
    expect(db.applications[0].screening_invite_status).toBe("sent");
    expect(db.audit_events).toEqual([
      expect.objectContaining({
        actor_user_id: "staff-1",
        entity_id: ADIYA_APP,
        action: "screening_invite_sent_by_staff",
      }),
    ]);
  });

  it("refuses with a reason when there is nothing to answer", async () => {
    seed(
      [staffEntryApp()],
      [Q.picking, Q.rota, Q.english, Q.workAuth].map((question_id) => ({
        application_id: ADIYA_APP,
        question_id,
        answer: { value: true },
      })),
    );
    const out = await sendScreeningInviteByStaff(admin, {
      applicationId: ADIYA_APP,
      actorUserId: "staff-1",
    });
    expect(out).toMatchObject({ ok: false, status: "not_needed" });
    expect(out.message).toMatch(/already answered/);
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe("Adiya answers on the status page", () => {
  const creds = { reference: ref(ADIYA_APP), email: ADIYA_EMAIL };

  it("is verified by reference and the email on the application", async () => {
    seed([staffEntryApp()]);
    expect(await loadScreeningByReference(creds.reference, "someone.else@mail.co.uk")).toBeNull();
    expect(
      await answerScreeningByReference({ ...creds, email: "someone.else@mail.co.uk", answers: [] }),
    ).toEqual({ ok: false, message: "We couldn't match that reference and email." });
    expect(db.application_answers).toHaveLength(0);
  });

  it("stores her answers, queues the match like a new application, and changes nothing else", async () => {
    seed([staffEntryApp()]);
    const before = await loadScreeningByReference(creds.reference, creds.email);
    expect(before?.open).toBe(true);
    expect(before?.questions.map((q) => q.id)).toEqual([
      Q.picking,
      Q.rota,
      Q.english,
      Q.workAuth,
      Q.haccp,
    ]);
    expect(before?.questions[0]).toMatchObject({ answer_type: "boolean", required: true });

    const res = await answerScreeningByReference({
      ...creds,
      answers: [
        { question_id: Q.picking, value: false },
        { question_id: Q.rota, value: true },
        { question_id: Q.english, value: true },
        { question_id: Q.workAuth, value: "Graduate visa; would need sponsorship" },
        { question_id: Q.haccp, value: null },
      ],
    });
    expect(res).toEqual({ ok: true, message: "Thanks — your answers are with the review team." });
    expect(db.application_answers).toEqual([
      { application_id: ADIYA_APP, question_id: Q.picking, answer: { value: false } },
      { application_id: ADIYA_APP, question_id: Q.rota, answer: { value: true } },
      { application_id: ADIYA_APP, question_id: Q.english, answer: { value: true } },
      {
        application_id: ADIYA_APP,
        question_id: Q.workAuth,
        answer: { value: "Graduate visa; would need sponsorship" },
      },
    ]);
    expect(db.processing_jobs).toEqual([
      expect.objectContaining({
        entity_type: "application",
        entity_id: ADIYA_APP,
        job_type: "parse_and_score",
        status: "queued",
        // Tagged so the drain re-checks the review state before it runs.
        trace_id: expect.stringMatching(/^screening_answers:[0-9a-f-]{36}$/),
      }),
    ]);
    // Eligibility is the scorer's job on the rescore; nothing is approved,
    // staged or published from here.
    expect(db.candidate_matches[0]).toMatchObject({
      admin_status: "pending",
      stage: "new",
      client_visibility: "hidden",
      eligibility_status: "eligible",
    });

    const after = await loadScreeningByReference(creds.reference, creds.email);
    expect(after).toEqual({ open: false, questions: [], reason: null });
    expect(
      await answerScreeningByReference({
        ...creds,
        answers: [{ question_id: Q.haccp, value: true }],
      }),
    ).toMatchObject({ ok: false });
  });

  it("says so when the application or the role has closed", async () => {
    seed([staffEntryApp({ status: "withdrawn", withdrawn_at: minutesAgo(1) })]);
    expect(await loadScreeningByReference(creds.reference, creds.email)).toEqual({
      open: false,
      questions: [],
      reason: "This application is closed, so there is nothing to answer.",
    });
    seed([
      staffEntryApp({
        positions: { title: "Mushroom Harvesting Manager", status: "filled", organization_id: ORG },
      }),
    ]);
    expect((await loadScreeningByReference(creds.reference, creds.email))?.reason).toMatch(
      /role has closed/,
    );
  });
});

describe("the email", () => {
  it("is a candidate template (replies reach the direct inbox) carrying the link and reference", async () => {
    const entry = TEMPLATES["screening-questions"];
    expect(entry).toBeDefined();
    expect(entry.internal).toBeFalsy();
    expect(entry.to).toBeUndefined();
    const data = {
      candidateFirstName: "Adiya",
      positionTitle: "Mushroom Harvesting Manager",
      organizationName: "Hughes Mushrooms",
      reference: ref(ADIYA_APP),
      questionCount: 5,
      statusUrl: `https://taasflow.com/apply/status?ref=${ref(ADIYA_APP)}`,
    };
    const html = await render(React.createElement(entry.component, data));
    expect(html).toContain(`href="${data.statusUrl}"`);
    expect(html).toContain(ref(ADIYA_APP));
    expect(html).toContain("5 short questions");
    expect(html).not.toContain("undefined");
    expect(typeof entry.subject === "function" ? entry.subject(data) : entry.subject).toBe(
      "A few questions about your application — Mushroom Harvesting Manager",
    );
  });
});

// ---------------------------------------------------------------------------
// Review follow-ups (adversarial review of the screening-link branch).
// ---------------------------------------------------------------------------
const ASSIGNED_APP = "44444444-4444-4444-8444-444444444444";
const RPC_ASSIGNED_APP = "55555555-5555-4555-8555-555555555555";
const FORM_APP = "66666666-6666-4666-8666-666666666666";
const WEB_APP = "77777777-7777-4777-8777-777777777777";
const STAFF_NULL_CHANNEL_APP = "88888888-8888-4888-8888-888888888888";
const IMPORT_APP = "99999999-9999-4999-8999-999999999999";

/** The row both bulk "Assign to role" paths write (execAssign and the RPC). */
function assignedApp(id: string, email: string): Row {
  return staffEntryApp({
    id,
    source: "admin_assignment",
    source_channel: null,
    source_kind: null,
    consent: {},
    candidate_profiles: { full_name: "Pool Candidate", email },
  });
}

describe("only allowlisted sources are ever asked (high: no email to bulk-assigned candidates)", () => {
  const base = { questionCount: 5, answerCount: 0, hasEmail: true, now: NOW };

  it("classifies sources as an allowlist, not 'anything but the form'", () => {
    expect(screeningLinkSource(staffEntryApp() as never)).toEqual({ ok: true });
    expect(
      screeningLinkSource({ source: "staff_entry:x", source_channel: null, consent: {} }),
    ).toEqual({ ok: true });
    expect(
      screeningLinkSource({ source: null, source_channel: "applicant_import", consent: {} }),
    ).toEqual({ ok: true });
    expect(
      screeningLinkSource({
        source: "applicant_import:ats-2026-11",
        source_channel: null,
        consent: {},
      }),
    ).toEqual({ ok: true });
    expect(
      screeningLinkSource({ source: "admin_assignment", source_channel: null, consent: {} }),
    ).toEqual({ ok: false, reason: "admin_assignment" });
    // Even a contradictory channel never lets an assignment through.
    expect(
      screeningLinkSource({
        source: "admin_assignment",
        source_channel: "direct_email",
        consent: {},
      }),
    ).toEqual({ ok: false, reason: "admin_assignment" });
    expect(
      screeningLinkSource({
        source: "public_job_board:k",
        source_channel: "public_job_board",
        consent: {},
      }),
    ).toEqual({ ok: false, reason: "form_application" });
    for (const other of [
      { source: "web", source_channel: null },
      { source: null, source_channel: null },
      { source: "referral", source_channel: "linkedin" },
    ]) {
      expect(screeningLinkSource({ ...other, consent: {} })).toEqual({
        ok: false,
        reason: "source_not_allowed",
      });
    }
  });

  it("decideAutomaticInvite skips an admin assignment and any unlisted source", () => {
    expect(
      decideAutomaticInvite({
        ...base,
        app: assignedApp(ASSIGNED_APP, "pool@mail.co.uk") as never,
      }),
    ).toEqual({ action: "skip", reason: "admin_assignment" });
    expect(
      decideAutomaticInvite({
        ...base,
        app: staffEntryApp({ source: "web", source_channel: null, consent: {} }) as never,
      }),
    ).toEqual({ action: "skip", reason: "source_not_allowed" });
  });

  it("the sweep emails direct-email, staff-entry and import rows only — never bulk-assigned or form rows", async () => {
    seed([
      staffEntryApp(),
      assignedApp(ASSIGNED_APP, "pool.one@mail.co.uk"),
      assignedApp(RPC_ASSIGNED_APP, "pool.two@mail.co.uk"),
      staffEntryApp({
        id: FORM_APP,
        source: "public_job_board:k",
        source_channel: "public_job_board",
        consent: { terms: true, question_version: 1793577600 },
        candidate_profiles: { full_name: "Form Applicant", email: "form@mail.co.uk" },
      }),
      staffEntryApp({
        id: WEB_APP,
        source: "web",
        source_channel: null,
        consent: {},
        candidate_profiles: { full_name: "Web Row", email: "web@mail.co.uk" },
      }),
      staffEntryApp({
        id: STAFF_NULL_CHANNEL_APP,
        source: "staff_entry:phone-2026-11-02",
        source_channel: null,
        candidate_profiles: { full_name: "Phone Entry", email: "phone@mail.co.uk" },
      }),
      staffEntryApp({
        id: IMPORT_APP,
        source: "applicant_import:ats-2026-11",
        source_channel: "applicant_import",
        candidate_profiles: { full_name: "Imported Applicant", email: "import@mail.co.uk" },
      }),
    ]);

    const out = await runScreeningInvites(admin, { now: NOW });
    expect(out).toMatchObject({ sent: 3, failed: 0 });
    expect(orCalls).toEqual([]);
    const recipients = sendTemplateEmail.mock.calls.map((c) => c[1]).sort();
    expect(recipients).toEqual([ADIYA_EMAIL, "import@mail.co.uk", "phone@mail.co.uk"].sort());
    for (const never of [
      "pool.one@mail.co.uk",
      "pool.two@mail.co.uk",
      "form@mail.co.uk",
      "web@mail.co.uk",
    ]) {
      expect(recipients).not.toContain(never);
    }
    // Rows outside the allowlist are never read, so never written either.
    const byId = (id: string) => db.applications.find((a) => a.id === id)!;
    for (const id of [ASSIGNED_APP, RPC_ASSIGNED_APP, FORM_APP, WEB_APP]) {
      expect(byId(id).screening_invite_status).toBeNull();
    }

    // Later sweeps change nothing for them.
    sendTemplateEmail.mockClear();
    await runScreeningInvites(admin, { now: new Date(NOW.getTime() + 60 * 60_000) });
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("the staff button refuses bulk-assigned and form applications", async () => {
    seed([
      assignedApp(ASSIGNED_APP, "pool.one@mail.co.uk"),
      staffEntryApp({
        id: FORM_APP,
        source: "public_job_board:k",
        source_channel: "public_job_board",
        screening_invite_status: "predates_feature",
      }),
    ]);
    const assigned = await sendScreeningInviteByStaff(admin, {
      applicationId: ASSIGNED_APP,
      actorUserId: "staff-1",
      now: NOW,
    });
    expect(assigned).toMatchObject({ ok: false, status: "not_needed" });
    expect(assigned.message).toMatch(/never applied/);
    const form = await sendScreeningInviteByStaff(admin, {
      applicationId: FORM_APP,
      actorUserId: "staff-1",
      now: NOW,
    });
    expect(form).toMatchObject({ ok: false, status: "not_needed" });
    expect(form.message).toMatch(/job page/);
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });

  it("the status page offers no questions to a form applicant or an assigned candidate (low: scope)", async () => {
    seed([
      staffEntryApp({
        source: "public_job_board:k",
        source_channel: "public_job_board",
        consent: { terms: true, question_version: 1793577600 },
      }),
    ]);
    const creds = { reference: ref(ADIYA_APP), email: ADIYA_EMAIL };
    expect(await loadScreeningByReference(creds.reference, creds.email)).toEqual({
      open: false,
      questions: [],
      reason: null,
    });
    expect(
      await answerScreeningByReference({
        ...creds,
        answers: [{ question_id: Q.rota, value: true }],
      }),
    ).toMatchObject({ ok: false });

    seed([assignedApp(ADIYA_APP, ADIYA_EMAIL)]);
    expect((await loadScreeningByReference(creds.reference, creds.email))?.open).toBe(false);
    expect(db.application_answers).toHaveLength(0);
  });
});

describe("late answers never replace a reviewed or approved score (medium)", () => {
  const creds = { reference: ref(ADIYA_APP), email: ADIYA_EMAIL };
  const answers = [
    { question_id: Q.picking, value: false }, // a dealbreaker answered "No"
    { question_id: Q.rota, value: true },
    { question_id: Q.english, value: true },
    { question_id: Q.workAuth, value: "Graduate visa; would need sponsorship" },
  ];

  it("decides from the current run's method and the approval", () => {
    const m = { admin_status: "pending", approved_score_run_id: null };
    expect(lateAnswerRescoreBlock({ ...m, current_run_method: "deterministic" })).toBeNull();
    expect(lateAnswerRescoreBlock({ ...m, current_run_method: null })).toBeNull();
    expect(lateAnswerRescoreBlock({ ...m, current_run_method: "human_adjusted" })).toBe(
      "human_adjusted",
    );
    expect(lateAnswerRescoreBlock({ ...m, current_run_method: "human_verified" })).toBe(
      "human_adjusted",
    );
    expect(
      lateAnswerRescoreBlock({
        ...m,
        admin_status: "approved",
        current_run_method: "deterministic",
      }),
    ).toBe("approved");
    expect(
      lateAnswerRescoreBlock({
        ...m,
        approved_score_run_id: MACHINE_RUN,
        current_run_method: "semantic",
      }),
    ).toBe("approved");
  });

  it("Adiya today (approved, human-adjusted run): answers stored, no rescore, one re-review task", async () => {
    seed([staffEntryApp()], [], {
      admin_status: "approved",
      current_score_run_id: HUMAN_RUN,
      approved_score_run_id: HUMAN_RUN,
      client_visibility: "visible",
      stage: "submitted_to_client",
    });
    const before = { ...db.candidate_matches[0] };
    const res = await answerScreeningByReference({ ...creds, answers });
    expect(res).toEqual({ ok: true, message: "Thanks — your answers are with the review team." });
    expect(db.application_answers).toHaveLength(4);
    // No machine rescore is queued, and nothing about the match moved.
    expect(db.processing_jobs).toEqual([]);
    expect(db.candidate_matches[0]).toEqual(before);
    expect(db.tasks).toEqual([
      expect.objectContaining({
        organization_id: ORG,
        position_id: POS,
        candidate_match_id: ADIYA_MATCH,
        candidate_profile_id: "cp-adiya",
        task_type: "candidate_review",
        title: "Screening answers received, re-review",
        status: "open",
        priority: "high",
        metadata: expect.objectContaining({
          source: "screening_answers",
          reason: "human_adjusted",
          application_id: ADIYA_APP,
          question_ids: [Q.picking, Q.rota, Q.english, Q.workAuth],
          dealbreaker_question_ids: [Q.picking],
        }),
      }),
    ]);
    const task = db.tasks[0] as { description: string };
    expect(task.description).toMatch(/published score is unchanged/);
    expect(task.description).toContain(QUESTIONS[0].question);
    expect(task.description).toMatch(/Eligibility was not changed/);
    expect(db.audit_events).toEqual([
      expect.objectContaining({
        action: "candidate_screening_answers_public",
        after_state: expect.objectContaining({
          follow_up: "re_review_task",
          rescore_blocked_by: "human_adjusted",
        }),
      }),
    ]);
  });

  it("an approved match on a machine run is not rescored either, and the task is not duplicated", async () => {
    seed([staffEntryApp()], [], { admin_status: "approved", approved_score_run_id: MACHINE_RUN });
    db.tasks.push({
      id: "t-open",
      candidate_match_id: ADIYA_MATCH,
      task_type: "candidate_review",
      status: "open",
      deleted_at: null,
      metadata: { source: "screening_answers" },
    });
    const res = await answerScreeningByReference({
      ...creds,
      answers: answers.map((a) => (a.question_id === Q.picking ? { ...a, value: true } : a)),
    });
    expect(res.ok).toBe(true);
    expect(db.processing_jobs).toEqual([]);
    expect(db.tasks).toHaveLength(1);
  });

  it("an unreviewed match is rescored as before and gets no task", async () => {
    seed([staffEntryApp()]);
    await answerScreeningByReference({ ...creds, answers });
    expect(db.processing_jobs).toHaveLength(1);
    expect(db.tasks).toEqual([]);
  });

  it("stores nothing when the score's review state cannot be read", async () => {
    seed([staffEntryApp()]);
    failures["score_runs:select"] = { message: "timeout" };
    const res = await answerScreeningByReference({ ...creds, answers });
    expect(res).toMatchObject({ ok: false });
    expect(db.application_answers).toEqual([]);
    expect(db.processing_jobs).toEqual([]);
  });
});

describe("the drain re-checks the review state before a late-answer rescore runs (re-review blocker)", () => {
  const creds = { reference: ref(ADIYA_APP), email: ADIYA_EMAIL };
  const answers = [
    { question_id: Q.picking, value: false }, // a dealbreaker answered "No"
    { question_id: Q.rota, value: true },
    { question_id: Q.english, value: true },
    { question_id: Q.workAuth, value: "Graduate visa; would need sponsorship" },
  ];
  const JOB = "job-screening-1";
  // The drain's backoff reads the wall clock, not the fixture's NOW.
  const wallMinutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

  /** Answer on an unreviewed match; give the queued job the DB's defaults. */
  async function answerWhileUnreviewed() {
    seed([staffEntryApp()]);
    const res = await answerScreeningByReference({ ...creds, answers });
    expect(res.ok).toBe(true);
    expect(db.tasks).toEqual([]);
    expect(db.processing_jobs).toHaveLength(1);
    Object.assign(db.processing_jobs[0], {
      id: JOB,
      attempts: 0,
      created_at: wallMinutesAgo(1),
      started_at: null,
    });
  }

  async function drain() {
    const { drainApplicationJobs } = await import("@/lib/pipeline-runner.server");
    return drainApplicationJobs({ limit: 5 });
  }

  beforeEach(() => {
    executeScoring.mockClear();
  });

  it("staff adjust the score after the answers arrive: the job is cancelled, no new run, one task", async () => {
    await answerWhileUnreviewed();
    // A reviewer applies reviewed verdicts before the next drain picks it up.
    db.candidate_matches[0].current_score_run_id = HUMAN_RUN;
    const matchBefore = { ...db.candidate_matches[0] };
    const runsBefore = db.score_runs.map((r) => ({ ...r }));

    const out = await drain();

    expect(out).toEqual([
      expect.objectContaining({
        job_id: JOB,
        application_id: ADIYA_APP,
        status: "cancelled",
        error_code: "reviewed_score_kept",
      }),
    ]);
    expect(db.processing_jobs[0]).toMatchObject({
      status: "cancelled",
      error_code: "reviewed_score_kept",
      error_message: expect.stringMatching(/adjusted by a reviewer.*reviewed score is kept/),
    });
    // No machine rescore: the scorer never ran, no run was written, and the
    // reviewed run is still the current (published) one.
    expect(executeScoring).not.toHaveBeenCalled();
    expect(db.score_runs).toEqual(runsBefore);
    expect(db.candidate_matches[0]).toEqual(matchBefore);
    expect(db.tasks).toEqual([
      expect.objectContaining({
        organization_id: ORG,
        position_id: POS,
        candidate_match_id: ADIYA_MATCH,
        candidate_profile_id: "cp-adiya",
        task_type: "candidate_review",
        title: "Screening answers received, re-review",
        status: "open",
        priority: "high",
        metadata: expect.objectContaining({
          source: "screening_answers",
          reason: "human_adjusted",
          held_at: "drain",
          processing_job_id: JOB,
          application_id: ADIYA_APP,
          question_ids: [Q.picking, Q.rota, Q.english, Q.workAuth],
          dealbreaker_question_ids: [Q.picking],
        }),
      }),
    ]);
    const task = db.tasks[0] as { description: string };
    expect(task.description).toMatch(/Adiya Vatsa answered screening questions for Mushroom/);
    expect(task.description).toMatch(/rescore was cancelled and the published score is unchanged/);
    expect(task.description).toContain(QUESTIONS[0].question);

    // A second drain finds nothing to do: the job is terminal.
    expect(await drain()).toEqual([]);
    expect(db.tasks).toHaveLength(1);
  });

  it("approval in the window holds it too, and an open re-review task is reused", async () => {
    await answerWhileUnreviewed();
    Object.assign(db.candidate_matches[0], {
      admin_status: "approved",
      approved_score_run_id: MACHINE_RUN,
    });
    db.tasks.push({
      id: "t-open",
      candidate_match_id: ADIYA_MATCH,
      task_type: "candidate_review",
      status: "open",
      deleted_at: null,
      metadata: { source: "screening_answers" },
    });
    const out = await drain();
    expect(out[0]).toMatchObject({ status: "cancelled", error_code: "reviewed_score_kept" });
    expect(db.processing_jobs[0]).toMatchObject({
      status: "cancelled",
      error_message: expect.stringMatching(/approved after the answers arrived/),
    });
    expect(executeScoring).not.toHaveBeenCalled();
    expect(db.tasks).toHaveLength(1);
  });

  it("a score still unreviewed at drain time goes on to the pipeline, with no task", async () => {
    await answerWhileUnreviewed();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const out = await drain();
    err.mockRestore();
    // The pipeline ran (the in-memory record has no CV file, so it stops at
    // manual review); what matters is that the job was not held.
    expect(out).toEqual([
      expect.objectContaining({ status: "completed", final_state: "manual_review_required" }),
    ]);
    expect(db.processing_jobs[0]).toMatchObject({ status: "completed", error_code: null });
    expect(
      db.tasks.filter(
        (t) => (t.metadata as { source?: string } | undefined)?.source === "screening_answers",
      ),
    ).toEqual([]);
  });

  it("jobs without the prefix (new applications, CV re-reads) are not gated", async () => {
    seed([staffEntryApp()], [], { current_score_run_id: HUMAN_RUN });
    db.processing_jobs.push({
      id: "job-new-application",
      entity_type: "application",
      entity_id: ADIYA_APP,
      job_type: "parse_and_score",
      status: "queued",
      attempts: 0,
      created_at: wallMinutesAgo(1),
      trace_id: "5d6f3c1e-8f7a-4b1d-9a8e-2f3c4d5e6f70",
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const out = await drain();
    err.mockRestore();
    // Not held: the pipeline ran even though the current run is human_adjusted.
    expect(out).toEqual([
      expect.objectContaining({ status: "completed", final_state: "manual_review_required" }),
    ]);
    expect(
      db.tasks.filter(
        (t) => (t.metadata as { source?: string } | undefined)?.source === "screening_answers",
      ),
    ).toEqual([]);
  });

  it("never rescores blind: an unreadable review state or a failed task insert re-arms the job", async () => {
    await answerWhileUnreviewed();
    db.candidate_matches[0].current_score_run_id = HUMAN_RUN;
    failures["score_runs:select"] = { message: "timeout" };
    let out = await drain();
    expect(out[0]).toMatchObject({ status: "skipped", error_code: "worker_error" });
    expect(db.processing_jobs[0]).toMatchObject({ status: "queued", attempts: 1 });
    expect(executeScoring).not.toHaveBeenCalled();
    expect(db.tasks).toEqual([]);

    delete failures["score_runs:select"];
    failures["tasks:insert"] = { message: "tasks down" };
    db.processing_jobs[0].started_at = wallMinutesAgo(3); // past the first backoff
    out = await drain();
    expect(out[0]).toMatchObject({
      status: "skipped",
      error_code: "worker_error",
      error_message: expect.stringMatching(/re_review_task_failed: tasks down/),
    });
    expect(db.processing_jobs[0]).toMatchObject({ status: "queued", attempts: 2 });
    expect(executeScoring).not.toHaveBeenCalled();

    delete failures["tasks:insert"];
    db.processing_jobs[0].started_at = wallMinutesAgo(11);
    out = await drain();
    expect(out[0]).toMatchObject({ status: "cancelled", error_code: "reviewed_score_kept" });
    expect(db.tasks).toHaveLength(1);
    expect(executeScoring).not.toHaveBeenCalled();
  });
});

describe("late answers are stored in the apply form's shape for every answer type (low)", () => {
  const typed = (id: string, answer_type: string) => ({
    id,
    question: `Q ${answer_type}`,
    answer_type,
    required: false,
    display_order: 0,
  });

  it("keeps the type the apply form stores: boolean, number, and a string for every text-like type", () => {
    // What each apply-form widget sends, which apply.server stores as { value }.
    const cases: Array<[string, unknown, unknown]> = [
      ["boolean", true, true],
      ["boolean", false, false],
      ["number", 7, 7],
      ["text", "Ran the Leeds site", "Ran the Leeds site"],
      ["long_text", "Two farms.\nNight shifts.", "Two farms.\nNight shifts."],
      ["single_choice", "Settled status", "Settled status"],
      // multi_choice renders as a text box on both forms: the string is kept,
      // never wrapped into ["Retail, Hospitality"].
      ["multi_choice", "Retail, Hospitality", "Retail, Hospitality"],
    ];
    for (const [type, input, stored] of cases) {
      const q = typed(`00000000-0000-4000-8000-00000000000${type.length % 10}`, type);
      const out = prepareLateAnswers([q], [{ question_id: q.id, value: input as never }]);
      expect(out, type).toEqual({ ok: true, rows: [{ question_id: q.id, value: stored }] });
      expect(typeof (out as { rows: Array<{ value: unknown }> }).rows[0].value).toBe(typeof stored);
    }
    // A real list (as the apply schema also accepts) stays a list of strings.
    const mq = typed("00000000-0000-4000-8000-0000000000aa", "multi_choice");
    expect(
      prepareLateAnswers([mq], [{ question_id: mq.id, value: [" Retail ", "Hospitality", ""] }]),
    ).toEqual({ ok: true, rows: [{ question_id: mq.id, value: ["Retail", "Hospitality"] }] });
    // Typed strings from a non-UI caller still land in the canonical type.
    const bq = typed("00000000-0000-4000-8000-0000000000bb", "boolean");
    const nq = typed("00000000-0000-4000-8000-0000000000cc", "number");
    expect(
      prepareLateAnswers(
        [bq, nq],
        [
          { question_id: bq.id, value: "yes" },
          { question_id: nq.id, value: " 12 " },
        ],
      ),
    ).toEqual({
      ok: true,
      rows: [
        { question_id: bq.id, value: true },
        { question_id: nq.id, value: 12 },
      ],
    });
  });
});

describe("job and audit insert failures are surfaced (low)", () => {
  const creds = { reference: ref(ADIYA_APP), email: ADIYA_EMAIL };
  const answers = [
    { question_id: Q.picking, value: true },
    { question_id: Q.rota, value: true },
    { question_id: Q.english, value: true },
    { question_id: Q.workAuth, value: "Settled status" },
  ];

  it("a failed rescore enqueue opens a 'rescore not queued' task instead of going quiet", async () => {
    seed([staffEntryApp()]);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    failures["processing_jobs:insert"] = { message: "permission denied" };
    const res = await answerScreeningByReference({ ...creds, answers });
    expect(res).toEqual({ ok: true, message: "Thanks — your answers are with the review team." });
    expect(db.application_answers).toHaveLength(4);
    expect(db.tasks).toEqual([
      expect.objectContaining({
        title: "Screening answers received, rescore not queued",
        candidate_match_id: ADIYA_MATCH,
        metadata: expect.objectContaining({ reason: "rescore_not_queued" }),
      }),
    ]);
    expect(db.audit_events[0]).toMatchObject({
      after_state: { follow_up: "rescore_not_queued_task", problems: ["job: permission denied"] },
    });
    expect(err).toHaveBeenCalledWith(
      "[screening-answers] follow-up failed",
      ADIYA_APP,
      "job: permission denied",
    );
    err.mockRestore();
  });

  it("tells the candidate to email the team when neither a job nor a task could be written", async () => {
    seed([staffEntryApp()]);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    failures["processing_jobs:insert"] = { message: "down" };
    failures["tasks:insert"] = { message: "down" };
    const res = await answerScreeningByReference({ ...creds, answers });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/could not alert the review team/);
    expect(res.message).toMatch(/@/);
    err.mockRestore();
  });

  it("logs a failed candidate audit insert", async () => {
    seed([staffEntryApp()]);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    failures["audit_events:insert"] = { message: "audit down" };
    expect((await answerScreeningByReference({ ...creds, answers })).ok).toBe(true);
    expect(db.processing_jobs).toHaveLength(1);
    expect(err).toHaveBeenCalledWith(
      "[screening-answers] audit insert failed",
      ADIYA_APP,
      "audit down",
    );
    err.mockRestore();
  });

  it("the staff button reports a failed audit insert or outcome record in its message", async () => {
    seed([staffEntryApp({ screening_invite_status: "predates_feature" })]);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    failures["audit_events:insert"] = { message: "audit down" };
    failures["applications:update"] = { message: "update down" };
    const out = await sendScreeningInviteByStaff(admin, {
      applicationId: ADIYA_APP,
      actorUserId: "staff-1",
      now: NOW,
    });
    expect(out).toMatchObject({ ok: true, status: "sent" });
    expect(out.message).toMatch(/audit record could not be written \(audit down\)/);
    expect(out.message).toMatch(/outcome could not be saved/);
    err.mockRestore();
  });
});

describe("before migration 0013 (low: operator note)", () => {
  it("the staff button says the migration is pending and sends nothing; the sweep sends nothing", async () => {
    seed([staffEntryApp()]);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    failures["applications:select"] = {
      code: "42703",
      message: "column applications.screening_invite_status does not exist",
    };
    const out = await sendScreeningInviteByStaff(admin, {
      applicationId: ADIYA_APP,
      actorUserId: "staff-1",
      now: NOW,
    });
    expect(out).toMatchObject({ ok: false, reason: "migration_pending" });
    expect(out.message).toMatch(/migration 0013/);
    expect(await runScreeningInvites(admin, { now: NOW })).toMatchObject({
      considered: 0,
      sent: 0,
    });
    expect(sendTemplateEmail).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("migration 0013_screening_invites", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../../../..", p), "utf8");

  it("follows main's 0012 (numbered 0013, snapshot chained) and never marks old rows for sending", () => {
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === "0013_screening_invites");
    expect(entry).toMatchObject({ idx: 13 });
    // 0012 is main's 0012_reviewed_verdicts_recruiter_exception (when 1793664000000).
    expect(entry!.when).toBeGreaterThan(1793664000000);
    expect(journal.entries.some((e) => e.tag === "0012_screening_invites")).toBe(false);
    const snap = JSON.parse(read("drizzle/migrations/meta/0013_snapshot.json")) as {
      prevId: string;
    };
    expect(snap.prevId).toBe("1071c33a-2d3b-4b64-9a97-d4dbb9c8fdef");

    const sql = read("drizzle/migrations/0013_screening_invites.sql");
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS screening_invite_status text DEFAULT 'predates_feature'/,
    );
    expect(sql).toMatch(/ALTER COLUMN screening_invite_status DROP DEFAULT/);
    expect(sql).not.toMatch(/^\s*UPDATE\b/im);
    expect(sql).toMatch(/deploy the code first, then run this migration/i);
  });
});
