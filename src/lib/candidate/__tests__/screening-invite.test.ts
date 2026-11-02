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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};

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
    ilike: (k: string, v: string) => (
      filters.push((r) => String(get(r, k) ?? "").toLowerCase() === v.toLowerCase()),
      api
    ),
    or: (expr: string) => {
      // Only the sweep's channel filter is used here.
      expect(expr).toBe("source_channel.is.null,source_channel.neq.public_job_board");
      filters.push((r) => r.source_channel == null || r.source_channel !== "public_job_board");
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

import {
  SCREENING_INVITE_GRACE_MS,
  cameThroughApplyForm,
  decideAutomaticInvite,
  decideStaffInvite,
  prepareLateAnswers,
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

function seed(apps: Row[], answers: Row[] = []) {
  for (const k of Object.keys(db)) delete db[k];
  db.applications = apps;
  db.screening_questions = QUESTIONS.map((q) => ({ ...q }));
  db.application_answers = answers;
  db.organizations = [{ id: ORG, is_test_record: false, is_demo: false }];
  db.candidate_matches = [
    {
      id: ADIYA_MATCH,
      application_id: ADIYA_APP,
      admin_status: "pending",
      stage: "new",
      client_visibility: "hidden",
      eligibility_status: "eligible",
    },
  ];
  db.processing_jobs = [];
  db.audit_events = [];
}

beforeEach(() => {
  process.env.LOVABLE_API_KEY = "test-key";
  sendTemplateEmail.mockClear();
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

  it("lets staff send for any open application with questions left, including old ones", () => {
    const go = (over: Partial<Parameters<typeof decideStaffInvite>[0]> = {}) =>
      decideStaffInvite({
        app: { status: "submitted", withdrawn_at: null },
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
    expect(go({ app: { status: "archived", withdrawn_at: null } })).toMatchObject({ ok: false });
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
