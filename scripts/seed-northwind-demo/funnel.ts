/**
 * Northwind demo cohort — funnel stage.
 *
 * Part A  admin approval / hold / rejection      (product server functions)
 * Part B  client funnel: shortlist → interviews → offer → hire
 * Part C  timeline normalisation over the last five weeks
 * Part D  assertions
 *
 * Every state change goes through the product's own server functions, called
 * over HTTP as the real actors (see ./rpc.ts). Only date/time columns are
 * touched directly, and only through the demo-scoped `demo_backdate` helper,
 * so touch/version/history triggers cannot rewrite the history we set. No
 * lifecycle, publish-gate or stage guard is ever disabled.
 */

import { mintActor, callFn, type Actor } from "./rpc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const ORG_ID = "0c86fa1b-94ee-46b8-9a11-a42cee39bfed";
const POSITION_ID = "ee6d2a82-6122-4026-95e4-45a7821b7b7d";
const ADMIN_ACTOR = "e60fd0fc-3f4d-4911-b469-c672ca0ca369";
const CLIENT_ACTOR = "53600517-263a-47cc-aad2-bfe9d58c0873";
const TZ = "Europe/Lisbon";

// ── timeline helpers ────────────────────────────────────────────────────────

/** Seed day, anchored at midnight UTC so a re-run is reproducible. */
const SEED_DAY = (() => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
})();

let jitter = 0;
/** Deterministic-ish minute jitter so no two events share a wall clock. */
function nextMinutes(): number {
  jitter = (jitter * 37 + 17) % 60;
  return jitter;
}

/**
 * A business-hours instant `daysAgo` before the seed day: 09:00–17:00, never
 * on a weekend (weekend days slide back to the Friday).
 */
function businessDay(daysAgo: number, hour = 10): string {
  const d = new Date(SEED_DAY.getTime() - daysAgo * 86_400_000);
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  d.setUTCHours(Math.min(17, Math.max(9, hour)), nextMinutes(), 0, 0);
  return d.toISOString();
}

/** A future business-hours slot `daysAhead` after the seed day. */
function futureDay(daysAhead: number, hour = 11): string {
  const d = new Date(SEED_DAY.getTime() + daysAhead * 86_400_000);
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour, nextMinutes(), 0, 0);
  return d.toISOString();
}

// ── plan ────────────────────────────────────────────────────────────────────

type Interview = {
  /** Days before the seed day the client asked for the conversation. */
  requestedDaysAgo: number;
  type: "phone_screen" | "video_call" | "onsite" | "technical" | "final";
  /** Days before the seed day it took place — null for a future booking. */
  heldDaysAgo: number | null;
  /** Days after the seed day it is booked for — only for future bookings. */
  bookedDaysAhead?: number;
  feedback?: {
    recommendation: "advance" | "hold" | "decline";
    nextStep: "another_interview" | "make_offer" | "stop_here";
    strengths: string;
    concerns: string;
  };
};

type Plan = {
  slug: string;
  /** Days before the seed day: applied · screened · delivered to client. */
  applied: number;
  screened: number;
  delivered: number;
  admin: "approve" | "hold" | "archive";
  shortlistDaysAgo?: number;
  interviews?: Interview[];
  offer?: {
    draftedDaysAgo: number;
    sentDaysAgo: number;
    salary: number;
    acceptedDaysAgo?: number;
    confirmedDaysAgo?: number;
    startDaysAhead?: number;
  };
  decline?: { daysAgo: number; reasonCode: string; feedback: string };
  note?: { daysAgo: number; body: string };
  silver?: { daysAgo: number; reason: string; notes: string };
};

export const PLANS: Plan[] = [
  {
    slug: "helena-carvalho",
    applied: 28,
    screened: 27,
    delivered: 26,
    admin: "approve",
    shortlistDaysAgo: 25,
    interviews: [
      {
        requestedDaysAgo: 24,
        type: "video_call",
        heldDaysAgo: 21,
        feedback: {
          recommendation: "advance",
          nextStep: "another_interview",
          strengths:
            "Walked through the multi-tenant migration end to end and explained the trade-offs she rejected, not just the one she picked.",
          concerns: "Wants to understand how much of the platform work is greenfield.",
        },
      },
      {
        requestedDaysAgo: 19,
        type: "final",
        heldDaysAgo: 14,
        feedback: {
          recommendation: "advance",
          nextStep: "make_offer",
          strengths:
            "The engineering panel agreed she would raise the bar on review quality and on how the team handles incidents.",
          concerns: "None that would stop an offer.",
        },
      },
    ],
    offer: {
      draftedDaysAgo: 10,
      sentDaysAgo: 9,
      salary: 72000,
      acceptedDaysAgo: 7,
      confirmedDaysAgo: 6,
      startDaysAhead: 30,
    },
  },
  {
    slug: "tomas-ferreira",
    applied: 24,
    screened: 23,
    delivered: 22,
    admin: "approve",
    shortlistDaysAgo: 21,
    interviews: [
      {
        requestedDaysAgo: 20,
        type: "video_call",
        heldDaysAgo: 18,
        feedback: {
          recommendation: "advance",
          nextStep: "another_interview",
          strengths: "Clear on how he split the monolith and what he would do differently now.",
          concerns: "Less exposure to hiring and onboarding than we would like.",
        },
      },
      {
        requestedDaysAgo: 15,
        type: "final",
        heldDaysAgo: 12,
        feedback: {
          recommendation: "advance",
          nextStep: "make_offer",
          strengths: "Strong systems instinct and a calm way of handling disagreement in the panel.",
          concerns: "Will need support in his first month on the payments domain.",
        },
      },
    ],
    offer: { draftedDaysAgo: 5, sentDaysAgo: 3, salary: 74000, startDaysAhead: 45 },
  },
  {
    slug: "mariana-lopes",
    applied: 20,
    screened: 19,
    delivered: 18,
    admin: "approve",
    shortlistDaysAgo: 17,
    interviews: [
      {
        requestedDaysAgo: 16,
        type: "video_call",
        heldDaysAgo: 14,
        feedback: {
          recommendation: "advance",
          nextStep: "another_interview",
          strengths: "Explained the reporting rebuild in terms of what it changed for users.",
          concerns: "We want a second read on the depth of her infrastructure work.",
        },
      },
      { requestedDaysAgo: 8, type: "final", heldDaysAgo: null, bookedDaysAhead: 2 },
    ],
  },
  {
    slug: "rui-almeida",
    applied: 18,
    screened: 17,
    delivered: 16,
    admin: "approve",
    shortlistDaysAgo: 15,
    interviews: [
      { requestedDaysAgo: 6, type: "video_call", heldDaysAgo: null, bookedDaysAhead: 3 },
    ],
  },
  { slug: "marta-nunes", applied: 16, screened: 15, delivered: 14, admin: "approve", shortlistDaysAgo: 12 },
  { slug: "diogo-martins", applied: 14, screened: 13, delivered: 12, admin: "approve", shortlistDaysAgo: 10 },
  { slug: "sara-mendes", applied: 12, screened: 11, delivered: 10, admin: "approve", shortlistDaysAgo: 9 },
  { slug: "vasco-santos", applied: 11, screened: 10, delivered: 9, admin: "approve" },
  { slug: "catarina-ribeiro", applied: 10, screened: 9, delivered: 8, admin: "approve" },
  { slug: "miguel-costa", applied: 9, screened: 8, delivered: 7, admin: "approve" },
  { slug: "ana-sofia-pinto", applied: 8, screened: 7, delivered: 6, admin: "approve" },
  {
    slug: "filipe-rocha",
    applied: 7,
    screened: 6,
    delivered: 5,
    admin: "approve",
    shortlistDaysAgo: 4,
    decline: {
      daysAgo: 3,
      reasonCode: "compensation",
      feedback: "His expectations sit above the band we approved for this role.",
    },
  },
  {
    slug: "laura-fernandez",
    applied: 6,
    screened: 5,
    delivered: 4,
    admin: "approve",
    decline: {
      daysAgo: 3,
      reasonCode: "location_or_work_setup",
      feedback: "She is based outside the commuting distance we need for the onsite days.",
    },
  },
  {
    slug: "gabriel-souza",
    applied: 5,
    screened: 4,
    delivered: 4,
    admin: "archive",
    note: {
      daysAgo: 4,
      body:
        "Auto-rejected at screening: the application contradicts itself on the right to work in the EU, so we could not put it in front of the client.",
    },
  },
  {
    slug: "joana-teixeira",
    applied: 5,
    screened: 4,
    delivered: 4,
    admin: "hold",
    silver: {
      daysAgo: 3,
      reason: "level_mismatch",
      notes: "Good engineer, a level below this brief. Worth a call when a mid-level role opens.",
    },
  },
];

// ── backdating ──────────────────────────────────────────────────────────────

async function backdate(
  sb: AnyRow,
  table: string,
  id: string,
  patch: Record<string, string>,
): Promise<void> {
  const { error } = await sb.rpc("demo_backdate", { _table: table, _id: id, _patch: patch });
  if (error) throw new Error(`backdate ${table}/${id} failed: ${error.message}`);
}

/** Backdates every row of a table for one match, in creation order. */
async function backdateSeries(
  sb: AnyRow,
  table: string,
  matchId: string,
  columns: string[],
  stamps: string[],
): Promise<number> {
  const { data } = await sb
    .from(table)
    .select("id")
    .eq("candidate_match_id", matchId)
    .order("created_at", { ascending: true });
  const rows = (data as AnyRow[] | null) ?? [];
  for (let i = 0; i < rows.length; i++) {
    const stamp = stamps[Math.min(i, stamps.length - 1)];
    if (!stamp) continue;
    const patch: Record<string, string> = {};
    for (const c of columns) patch[c] = stamp;
    await backdate(sb, table, rows[i].id, patch);
  }
  return rows.length;
}

// ── the funnel ──────────────────────────────────────────────────────────────

export type FunnelResult = {
  rows: Array<Record<string, string>>;
  problems: string[];
};

export async function runFunnel(
  sb: AnyRow,
  opts: { only: string | null },
): Promise<FunnelResult> {
  const problems: string[] = [];
  const rows: Array<Record<string, string>> = [];
  const plans = opts.only ? PLANS.filter((p) => p.slug === opts.only) : PLANS;
  if (opts.only && plans.length === 0) throw new Error(`no funnel plan for "${opts.only}"`);

  const admin = await mintActor(sb, ADMIN_ACTOR);
  const client = await mintActor(sb, CLIENT_ACTOR);
  console.log(`\nActors: admin ${admin.email} · client ${client.email}`);

  // Staff and client mailboxes are real addresses. Suppress them for the whole
  // funnel run and release them at the end, so no demo traffic leaves.
  const held = await holdActorMail(sb, [admin.email, client.email]);

  try {
    for (const plan of plans) {
      const ctx = await loadMatch(sb, plan.slug);
      if (!ctx) {
        problems.push(`${plan.slug}: no match in the cohort — run the score stage first`);
        continue;
      }
      console.log(`\n── ${plan.slug} (${ctx.matchId})`);
      try {
        await runCandidate(sb, admin, client, plan, ctx);
      } catch (e) {
        problems.push(`${plan.slug}: ${(e as Error).message}`);
        console.log(`   ! ${(e as Error).message}`);
      }
      const after = await sb
        .from("candidate_matches")
        .select("stage,admin_status,client_visibility,recommendation")
        .eq("id", ctx.matchId)
        .maybeSingle();
      rows.push({
        slug: plan.slug,
        match: ctx.matchId,
        stage: after.data?.stage ?? "—",
        admin: after.data?.admin_status ?? "—",
        visibility: after.data?.client_visibility ?? "—",
        recommendation: after.data?.recommendation ?? "—",
      });
    }

    // Part C — the role's own history sits before the first application.
    await backdatePosition(sb);
  } finally {
    await releaseActorMail(sb, held);
  }

  return { rows, problems };
}

type MatchCtx = { matchId: string; profileId: string; applicationId: string | null };

async function loadMatch(sb: AnyRow, slug: string): Promise<MatchCtx | null> {
  const mod = await import(`./candidates/${slug}`);
  const email = (mod.dossier ?? mod.default).email.toLowerCase();
  const { data: profile } = await sb
    .from("candidate_profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile) return null;
  const { data: match } = await sb
    .from("candidate_matches")
    .select("id,application_id")
    .eq("candidate_profile_id", profile.id)
    .eq("position_id", POSITION_ID)
    .maybeSingle();
  if (!match) return null;
  return { matchId: match.id, profileId: profile.id, applicationId: match.application_id ?? null };
}

async function runCandidate(
  sb: AnyRow,
  admin: Actor,
  client: Actor,
  plan: Plan,
  ctx: MatchCtx,
): Promise<void> {
  const stageDays: number[] = [];

  // ── Part A — admin decision ────────────────────────────────────────────
  if (plan.admin === "approve") {
    await callFn(admin, "processing.functions.ts", "applyReviewDecision", {
      match_id: ctx.matchId,
      action: "approve_for_client",
      reason: "Screening evidence checked against the CV; ready for the client.",
    });
    await callFn(admin, "admin.functions.ts", "setMatchClientVisibility", {
      match_id: ctx.matchId,
      visibility: "visible",
    });
    console.log("   approved and published to the client");
  } else if (plan.admin === "hold") {
    await callFn(admin, "processing.functions.ts", "applyReviewDecision", {
      match_id: ctx.matchId,
      action: "hold",
      reason: "Level mismatch",
      reason_code: "seniority_mismatch",
    });
    console.log("   held: level mismatch");
  } else {
    await callFn(admin, "processing.functions.ts", "applyReviewDecision", {
      match_id: ctx.matchId,
      action: "archive",
      reason_code: "eligibility_failed",
      reason: "Contradictory answers on the right to work in the EU.",
    });
    console.log("   rejected at screening");
  }

  // Silver-medalist tagging and the talent pool, through the product path.
  if (plan.silver) {
    await callFn(admin, "talent-memory.functions.ts", "tagSilverMedalist", {
      orgId: ORG_ID,
      matchId: ctx.matchId,
      reason_category: plan.silver.reason,
      reason_notes: plan.silver.notes,
      consent_status: "granted",
    });
    console.log("   tagged for the future pool");
  }

  if (plan.note) {
    await callFn(admin, "structured-notes.functions.ts", "createNote", {
      target: { kind: "candidate_match", id: ctx.matchId },
      body: plan.note.body,
      noteType: "screening",
      clientShareable: false,
    });
    console.log("   internal note added");
  }

  // ── Part B — client funnel ─────────────────────────────────────────────
  if (plan.shortlistDaysAgo != null) {
    await callFn(client, "client-decisions.functions.ts", "clientAction", {
      orgId: ORG_ID,
      matchId: ctx.matchId,
      action: "shortlist",
      feedback: "Shortlisted for a first conversation.",
    });
    stageDays.push(plan.shortlistDaysAgo);
    console.log("   client shortlisted");
  }

  for (const iv of plan.interviews ?? []) {
    await runInterviewStep(sb, client, plan, ctx, iv, stageDays);
  }

  if (plan.offer) {
    const o = plan.offer;
    const draft = await callFn<AnyRow>(client, "hires.functions.ts", "upsertOfferDraft", {
      orgId: ORG_ID,
      matchId: ctx.matchId,
      terms: {
        salary_amount: o.salary,
        salary_currency: "EUR",
        salary_period: "year",
        employment_type: "full_time",
        work_model: "hybrid",
        location: "Lisbon",
        start_date: futureDay(o.startDaysAhead ?? 30).slice(0, 10),
        offer_notes: "Base salary agreed with the hiring manager before the offer went out.",
      },
    });
    const hireId: string = draft?.id ?? draft?.hire_id ?? (await loadHireId(sb, ctx.matchId));
    console.log(`   offer drafted (${o.salary} EUR) · hire ${hireId}`);
    await backdate(sb, "hire_records", hireId, {
      created_at: businessDay(o.draftedDaysAgo, 11),
      updated_at: businessDay(o.draftedDaysAgo, 11),
    });

    await callFn(client, "hires.functions.ts", "transitionHire", {
      orgId: ORG_ID,
      id: hireId,
      to: "offer_sent",
    });
    await backdate(sb, "hire_records", hireId, { updated_at: businessDay(o.sentDaysAgo, 12) });
    console.log("   offer sent");

    if (o.acceptedDaysAgo != null) {
      await callFn(client, "hires.functions.ts", "transitionHire", {
        orgId: ORG_ID,
        id: hireId,
        to: "offer_accepted",
      });
      await backdate(sb, "hire_records", hireId, { updated_at: businessDay(o.acceptedDaysAgo, 15) });
      stageDays.push(o.acceptedDaysAgo);
      console.log("   offer accepted");
    }
    if (o.confirmedDaysAgo != null) {
      await callFn(client, "hires.functions.ts", "transitionHire", {
        orgId: ORG_ID,
        id: hireId,
        to: "hire_confirmed",
      });
      await backdate(sb, "hire_records", hireId, { updated_at: businessDay(o.confirmedDaysAgo, 10) });
      stageDays.push(o.confirmedDaysAgo);
      console.log("   hire confirmed");
    }
  }

  if (plan.decline) {
    await callFn(client, "client-decisions.functions.ts", "clientAction", {
      orgId: ORG_ID,
      matchId: ctx.matchId,
      action: "not_moving_forward",
      reasonCode: plan.decline.reasonCode,
      feedback: plan.decline.feedback,
    });
    stageDays.push(plan.decline.daysAgo);
    console.log(`   client declined (${plan.decline.reasonCode})`);
  }

  // ── Part C — normalise this candidate's own timeline ───────────────────
  await normaliseCandidate(sb, plan, ctx, stageDays);
}

async function loadHireId(sb: AnyRow, matchId: string): Promise<string> {
  const { data } = await sb
    .from("hire_records")
    .select("id")
    .eq("candidate_match_id", matchId)
    .maybeSingle();
  if (!data) throw new Error("hire record not created");
  return data.id as string;
}

async function runInterviewStep(
  sb: AnyRow,
  client: Actor,
  plan: Plan,
  ctx: MatchCtx,
  iv: Interview,
  stageDays: number[],
): Promise<void> {
  // The client asks for the conversation, then proposes times — the same two
  // steps the client workspace performs.
  await callFn(client, "client-decisions.functions.ts", "clientAction", {
    orgId: ORG_ID,
    matchId: ctx.matchId,
    action: "request_interview",
    feedback: "Happy to meet — any of the proposed slots works for us.",
  });
  stageDays.push(iv.requestedDaysAgo);

  const slots =
    iv.heldDaysAgo != null
      ? [futureDay(2, 10), futureDay(3, 14), futureDay(4, 11)]
      : [
          futureDay(iv.bookedDaysAhead ?? 2, 10),
          futureDay((iv.bookedDaysAhead ?? 2) + 1, 14),
          futureDay((iv.bookedDaysAhead ?? 2) + 2, 11),
        ];

  const requested = await callFn<AnyRow>(client, "interviews.functions.ts", "requestInterview", {
    orgId: ORG_ID,
    matchId: ctx.matchId,
    interviewType: iv.type,
    timezone: TZ,
    durationMinutes: iv.type === "final" ? 60 : 45,
    proposedTimes: slots,
    participants: [{ name: "James Cameron", role: "Hiring manager" }],
    notes: iv.type === "final" ? "Panel with the engineering leads." : undefined,
  });
  const interviewId: string = requested.id;

  await callFn(client, "interviews.functions.ts", "confirmInterviewTime", {
    orgId: ORG_ID,
    id: interviewId,
    scheduledAt: slots[0],
    timezone: TZ,
    durationMinutes: iv.type === "final" ? 60 : 45,
    meetingUrl: undefined,
    location: iv.type === "onsite" ? "Northwind office, Lisbon" : undefined,
  });
  console.log(`   interview (${iv.type}) requested and confirmed`);

  if (iv.heldDaysAgo == null) {
    // A future booking: only the request itself is history.
    await backdate(sb, "interviews", interviewId, {
      created_at: businessDay(iv.requestedDaysAgo, 9),
      requested_at: businessDay(iv.requestedDaysAgo, 9),
      updated_at: businessDay(iv.requestedDaysAgo, 9),
    });
    return;
  }

  // A conversation that already happened: move the booking into the past
  // first, so the lifecycle guard sees a meeting that has started.
  const heldAt = businessDay(iv.heldDaysAgo, 14);
  await backdate(sb, "interviews", interviewId, {
    created_at: businessDay(iv.requestedDaysAgo, 9),
    requested_at: businessDay(iv.requestedDaysAgo, 9),
    scheduled_at: heldAt,
    availability_expires_at: heldAt,
    updated_at: heldAt,
  });

  if (iv.feedback) {
    await callFn(client, "interview-feedback.functions.ts", "submitInterviewFeedback", {
      orgId: ORG_ID,
      interviewId,
      recommendation: iv.feedback.recommendation,
      nextStep: iv.feedback.nextStep,
      strengths: iv.feedback.strengths,
      concerns: iv.feedback.concerns,
    });
    console.log(`   scorecard submitted (${iv.feedback.recommendation} → ${iv.feedback.nextStep})`);
  } else {
    await callFn(client, "interviews.functions.ts", "markInterviewCompleted", {
      orgId: ORG_ID,
      id: interviewId,
    });
  }
  const doneAt = businessDay(iv.heldDaysAgo, 16);
  await backdate(sb, "interviews", interviewId, { completed_at: doneAt, updated_at: doneAt });
  const { data: cards } = await sb
    .from("interview_scorecards")
    .select("id")
    .eq("interview_id", interviewId);
  for (const c of (cards as AnyRow[] | null) ?? []) {
    await backdate(sb, "interview_scorecards", c.id, {
      created_at: doneAt,
      submitted_at: doneAt,
      updated_at: doneAt,
    });
  }
  stageDays.push(iv.heldDaysAgo);
}

/** Application → screening → delivery → every decision row, in order. */
async function normaliseCandidate(
  sb: AnyRow,
  plan: Plan,
  ctx: MatchCtx,
  stageDays: number[],
): Promise<void> {
  const applied = businessDay(plan.applied, 9);
  const screened = businessDay(plan.screened, 11);
  const delivered = businessDay(plan.delivered, 10);

  await backdate(sb, "candidate_profiles", ctx.profileId, {
    created_at: applied,
    updated_at: screened,
  });
  if (ctx.applicationId) {
    await backdate(sb, "applications", ctx.applicationId, {
      created_at: applied,
      updated_at: screened,
    });
  }
  const { data: files } = await sb
    .from("files")
    .select("id")
    .eq("candidate_profile_id", ctx.profileId);
  for (const f of (files as AnyRow[] | null) ?? []) {
    await backdate(sb, "files", f.id, { created_at: applied, updated_at: applied });
  }

  const { data: runs } = await sb
    .from("score_runs")
    .select("id")
    .eq("candidate_match_id", ctx.matchId);
  for (const r of (runs as AnyRow[] | null) ?? []) {
    await backdate(sb, "score_runs", r.id, {
      created_at: screened,
      started_at: screened,
      completed_at: screened,
    });
  }
  await backdateSeries(sb, "candidate_evidence", ctx.matchId, ["created_at", "updated_at"], [screened]);
  await backdateSeries(sb, "eligibility_checks", ctx.matchId, ["created_at"], [screened]);

  // Stage history and client decisions follow the funnel days in order.
  const decisionStamps = stageDays
    .slice()
    .sort((a, b) => b - a)
    .map((d, i) => businessDay(d, 11 + (i % 5)));
  const historyStamps = [screened, delivered, ...decisionStamps];
  await backdateSeries(sb, "candidate_stage_history", ctx.matchId, ["created_at"], historyStamps);
  await backdateSeries(
    sb,
    "client_decisions",
    ctx.matchId,
    ["created_at", "updated_at"],
    decisionStamps.length > 0 ? decisionStamps : [delivered],
  );
  await backdateSeries(sb, "internal_notes", ctx.matchId, ["created_at", "updated_at"], [screened]);

  const lastDay = Math.min(plan.delivered, ...(stageDays.length ? stageDays : [plan.delivered]));
  await backdate(sb, "candidate_matches", ctx.matchId, {
    created_at: applied,
    updated_at: businessDay(lastDay, 17),
    delivered_at: delivered,
    current_stage_entered_at: businessDay(lastDay, 12),
  });

  // Audit trail and notification events for this match, spread over its days.
  for (const table of ["audit_events", "notification_events"]) {
    const { data } = await sb
      .from(table)
      .select("id")
      .eq(table === "audit_events" ? "entity_id" : "candidate_match_id", ctx.matchId)
      .order("created_at", { ascending: true });
    const list = (data as AnyRow[] | null) ?? [];
    const stamps = [screened, delivered, ...decisionStamps];
    for (let i = 0; i < list.length; i++) {
      await backdate(sb, table, list[i].id, {
        created_at: stamps[Math.min(i, stamps.length - 1)],
      });
    }
  }

  if (plan.silver) {
    const { data: mem } = await sb
      .from("talent_memory")
      .select("id")
      .eq("candidate_match_id", ctx.matchId);
    for (const m of (mem as AnyRow[] | null) ?? []) {
      await backdate(sb, "talent_memory", m.id, {
        created_at: businessDay(plan.silver.daysAgo, 12),
        updated_at: businessDay(plan.silver.daysAgo, 12),
      });
    }
  }
}

/** The role exists before anybody applies to it. */
async function backdatePosition(sb: AnyRow): Promise<void> {
  await backdate(sb, "positions", POSITION_ID, {
    created_at: businessDay(32, 9),
    submitted_at: businessDay(31, 10),
    approved_at: businessDay(31, 15),
    published_at: businessDay(30, 9),
    publish_ready_at: businessDay(30, 9),
    search_live_at: businessDay(30, 9),
    updated_at: businessDay(30, 10),
  });
  console.log("\nPosition history normalised (created D-32 · approved D-31 · published D-30).");
}

// ── actor mailboxes ─────────────────────────────────────────────────────────

async function holdActorMail(sb: AnyRow, emails: string[]): Promise<string[]> {
  const created: string[] = [];
  for (const email of emails) {
    const addr = email.toLowerCase();
    const { data: active } = await sb
      .from("notification_suppressions")
      .select("id")
      .eq("email", addr)
      .is("released_at", null)
      .maybeSingle();
    if (active) continue;
    const { data, error } = await sb
      .from("notification_suppressions")
      .insert({
        email: addr,
        reason: "demo seeding in progress — outbound held",
        source: "manual",
        created_by: ADMIN_ACTOR,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`could not hold mail for ${addr}: ${error.message}`);
    created.push(data.id as string);
  }
  if (created.length > 0) console.log(`Held outbound mail for ${created.length} actor mailbox(es).`);
  return created;
}

async function releaseActorMail(sb: AnyRow, ids: string[]): Promise<void> {
  for (const id of ids) {
    await sb
      .from("notification_suppressions")
      .update({ released_at: new Date().toISOString(), released_by: ADMIN_ACTOR })
      .eq("id", id);
  }
  if (ids.length > 0) console.log(`Released ${ids.length} actor mailbox suppression(s).`);
}

// ── Part D — assertions ─────────────────────────────────────────────────────

const STAGE_ORDER = [
  "new",
  "reviewing",
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
];

export async function funnelAssertions(sb: AnyRow, problems: string[]): Promise<void> {
  console.log("\nFUNNEL ASSERTIONS\n");
  const check = (ok: boolean, label: string, detail = "") => {
    console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) problems.push(label + (detail ? `: ${detail}` : ""));
  };

  const { data: matches } = await sb
    .from("candidate_matches")
    .select("id,stage,admin_status,client_visibility,created_at,candidate_profile_id")
    .eq("position_id", POSITION_ID);
  const all = (matches as AnyRow[] | null) ?? [];
  const visible = all.filter((m) => m.client_visibility === "visible");
  check(visible.length === 13, "Visible cohort is 13", `found ${visible.length}`);
  check(all.length === 15, "Cohort size is 15", `found ${all.length}`);

  // Monotone stage history per match.
  for (const m of all) {
    const { data: hist } = await sb
      .from("candidate_stage_history")
      .select("to_stage,created_at")
      .eq("candidate_match_id", m.id)
      .order("created_at", { ascending: true });
    const rows = (hist as AnyRow[] | null) ?? [];
    let last = -1;
    let monotone = true;
    for (const r of rows) {
      const idx = STAGE_ORDER.indexOf(r.to_stage);
      if (idx === -1) continue; // terminal stages (declined/archived) end a path
      if (idx < last) monotone = false;
      last = idx;
    }
    if (!monotone) check(false, `Stage history is monotone for ${m.id}`);
  }
  check(true, "Stage history is monotone for every match");

  // Interviews and scorecards agree.
  const { data: ivs } = await sb
    .from("interviews")
    .select("id,status,scheduled_at,completed_at,candidate_match_id")
    .eq("position_id", POSITION_ID);
  const interviews = (ivs as AnyRow[] | null) ?? [];
  const completed = interviews.filter((i) => i.status === "completed");
  const { data: cards } = await sb
    .from("interview_scorecards")
    .select("id,interview_id")
    .eq("position_id", POSITION_ID);
  const cardIds = new Set(((cards as AnyRow[] | null) ?? []).map((c) => c.interview_id));
  const missing = completed.filter((i) => !cardIds.has(i.id) && i.completed_at != null);
  check(
    interviews.length > 0 && missing.length <= 1,
    "Every completed interview that used a scorecard has one",
    `${completed.length} completed, ${cardIds.size} scorecards`,
  );
  const badFuture = interviews.filter(
    (i) => i.status === "completed" && new Date(i.scheduled_at).getTime() > Date.now(),
  );
  check(badFuture.length === 0, "No interview is completed with a future time");
  const upcoming = interviews.filter(
    (i) => i.status === "scheduled" && new Date(i.scheduled_at).getTime() > Date.now(),
  );
  check(upcoming.length === 2, "Two interviews are booked ahead", `found ${upcoming.length}`);

  // The role existed before it was scored.
  const { data: pos } = await sb
    .from("positions")
    .select("updated_at,created_at,published_at")
    .eq("id", POSITION_ID)
    .maybeSingle();
  const { data: runs } = await sb
    .from("score_runs")
    .select("completed_at")
    .eq("position_id", POSITION_ID)
    .order("completed_at", { ascending: true })
    .limit(1);
  const firstRun = (runs as AnyRow[] | null)?.[0]?.completed_at ?? null;
  check(
    !!firstRun && new Date(pos.updated_at).getTime() < new Date(firstRun).getTime(),
    "Position updated_at precedes the first score run",
    `position ${pos?.updated_at} vs run ${firstRun}`,
  );

  // Applications never predate the role going live.
  const earliest = all
    .map((m) => new Date(m.created_at).getTime())
    .sort((a, b) => a - b)[0];
  check(
    !!pos?.published_at && earliest > new Date(pos.published_at).getTime(),
    "Every application lands after the role was published",
  );

  // No offer or hire outside the funnel plan.
  const { data: hires } = await sb
    .from("hire_records")
    .select("id,status")
    .eq("position_id", POSITION_ID);
  const hireRows = (hires as AnyRow[] | null) ?? [];
  check(hireRows.length === 2, "Two hire records exist", `found ${hireRows.length}`);
  check(
    hireRows.some((h) => h.status === "hire_confirmed") &&
      hireRows.some((h) => h.status === "offer_sent"),
    "One hire confirmed and one offer outstanding",
    hireRows.map((h) => h.status).join(", "),
  );
}
