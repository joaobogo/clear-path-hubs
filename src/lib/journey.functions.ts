// Candidate journey timeline — unified event stream for a candidate_match.
// Read-only. RLS enforced via requireSupabaseAuth (caller must be org member).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type JourneyEventKind =
  | "sourced"
  | "applied"
  | "screened"
  | "enriched"
  | "ranked"
  | "delivered"
  | "shortlisted"
  | "interviewed"
  | "offer_sent"
  | "hired"
  | "passed"
  | "withdrawn"
  | "rediscovered"
  | "outreach_sent"
  | "outreach_replied";

export interface JourneyEvent {
  kind: JourneyEventKind;
  label: string;
  at: string; // ISO
  detail?: string | null;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

const TONE: Record<JourneyEventKind, JourneyEvent["tone"]> = {
  sourced: "info",
  applied: "info",
  screened: "neutral",
  enriched: "neutral",
  ranked: "info",
  delivered: "info",
  shortlisted: "success",
  interviewed: "success",
  offer_sent: "success",
  hired: "success",
  passed: "warning",
  withdrawn: "warning",
  rediscovered: "info",
  outreach_sent: "neutral",
  outreach_replied: "info",
};

const LABEL: Record<JourneyEventKind, string> = {
  sourced: "Sourced",
  applied: "Applied",
  screened: "Screened",
  enriched: "Enriched",
  ranked: "Ranked",
  delivered: "Delivered to client",
  shortlisted: "Shortlisted",
  interviewed: "Interviewed",
  offer_sent: "Offer sent",
  hired: "Hired",
  passed: "Passed",
  withdrawn: "Withdrawn",
  rediscovered: "Rediscovered",
  outreach_sent: "Outreach sent",
  outreach_replied: "Outreach reply",
};

export const getCandidateJourney = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        applicationId: z.string().uuid().optional(),
        candidateMatchId: z.string().uuid().optional(),
      })
      .refine((v) => v.applicationId || v.candidateMatchId, {
        message: "applicationId or candidateMatchId required",
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ events: JourneyEvent[] }> => {
    const supabase = context.supabase as Any;

    // Resolve applicationId + candidateProfileId + positionId
    let applicationId = data.applicationId ?? null;
    let candidateMatchId = data.candidateMatchId ?? null;
    let candidateProfileId: string | null = null;
    let positionId: string | null = null;
    let organizationId: string | null = null;

    if (candidateMatchId && !applicationId) {
      const { data: m } = await supabase
        .from("candidate_matches")
        .select("id, application_id, candidate_profile_id, position_id, organization_id, client_visibility")
        .eq("id", candidateMatchId)
        .maybeSingle();
      if (!m) return { events: [] };
      applicationId = m.application_id;
      candidateProfileId = m.candidate_profile_id;
      positionId = m.position_id;
      organizationId = m.organization_id;
    }

    // Load application
    const { data: app } = await supabase
      .from("applications")
      .select(
        "id, candidate_profile_id, position_id, organization_id, source, source_kind, source_channel, applied_at, withdrawn_at, outreach_sent_at, outreach_replied_at, created_at",
      )
      .eq("id", applicationId!)
      .maybeSingle();
    if (!app) return { events: [] };
    candidateProfileId = candidateProfileId ?? app.candidate_profile_id;
    positionId = positionId ?? app.position_id;
    organizationId = organizationId ?? app.organization_id;

    // Tenant/role gate. Staff can read any journey; non-staff must be a member of
    // the owning org AND (for non-editors) the underlying match must be visible.
    if (organizationId) {
      const [{ data: isStaff }, { data: isMember }] = await Promise.all([
        supabase.rpc("is_platform_staff", { _user: context.userId }),
        supabase.rpc("is_org_member", { _user: context.userId, _org: organizationId }),
      ]);
      if (!isStaff && !isMember) return { events: [] };
      if (!isStaff) {
        const { data: isEditor } = await supabase.rpc("is_org_editor", {
          _user: context.userId,
          _org: organizationId,
        });
        if (!isEditor) {
          // Viewer role: only expose journey when the match is client-visible.
          const { data: vm } = await supabase
            .from("candidate_matches")
            .select("id, client_visibility")
            .eq("application_id", applicationId!)
            .eq("client_visibility", "visible")
            .maybeSingle();
          if (!vm) return { events: [] };
        }
      }
    }

    // Load match (screened/enriched/delivered/stage)
    const { data: match } = await supabase
      .from("candidate_matches")
      .select(
        "id, stage, admin_status, client_visibility, processing_state, delivered_at, created_at, updated_at, processing_updated_at, current_score_run_id",
      )
      .eq("application_id", applicationId!)
      .maybeSingle();
    if (match && !candidateMatchId) candidateMatchId = match.id;

    // Score runs → ranked events
    const { data: runs } = candidateMatchId
      ? await supabase
          .from("score_runs")
          .select("id, completed_at, final_score, fit_band, status")
          .eq("candidate_match_id", candidateMatchId)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: true })
      : { data: [] as Any[] };

    // Hire record → offer/hire
    const { data: hire } = candidateMatchId
      ? await supabase
          .from("hire_records")
          .select("status, sent_at, accepted_at, declined_at, hired_at, closed_at, close_reason")
          .eq("candidate_match_id", candidateMatchId)
          .maybeSingle()
      : { data: null };

    // Outreach touches
    const { data: touches } = await supabase
      .from("outreach_touches")
      .select("channel, state, sent_at, replied_at, reply_category")
      .eq("application_id", applicationId!)
      .order("sent_at", { ascending: true });

    // Talent memory (rediscovery)
    const { data: memoryEvents } = candidateProfileId
      ? await supabase
          .from("talent_memory_events")
          .select("event_type, notes, created_at, position_id, talent_memory:talent_memory_id(candidate_profile_id)")
          .in("event_type", ["rediscovered", "reopened", "re_engaged"])
          .order("created_at", { ascending: true })
      : { data: [] as Any[] };

    const events: JourneyEvent[] = [];
    const push = (kind: JourneyEventKind, at: string | null | undefined, detail?: string | null) => {
      if (!at) return;
      events.push({ kind, label: LABEL[kind], tone: TONE[kind], at, detail: detail ?? null });
    };

    // Sourced vs applied
    if (app.source_kind === "sourced" || app.source_kind === "outbound") {
      push("sourced", app.outreach_sent_at ?? app.created_at, app.source_channel ?? app.source ?? null);
    } else {
      push("applied", app.applied_at ?? app.created_at, app.source_channel ?? app.source ?? null);
    }

    // Outreach
    for (const t of (touches ?? []) as Any[]) {
      if (t.sent_at) push("outreach_sent", t.sent_at, t.channel ?? null);
      if (t.replied_at) push("outreach_replied", t.replied_at, t.reply_category ?? t.channel ?? null);
    }

    // Screened / enriched — inferred from processing state timestamps
    if (match) {
      const state = match.processing_state as string | null;
      const psu = match.processing_updated_at as string | null;
      if (state && ["ready_to_score", "scored", "enriching"].includes(state)) {
        push("screened", match.created_at, "CV parsed and validated");
      }
      if (state && ["ready_to_score", "scored"].includes(state)) {
        push("enriched", psu ?? match.updated_at, "Evidence assembled");
      }
    }

    // Ranked — every completed score run
    for (const r of (runs ?? []) as Any[]) {
      const label =
        r.fit_band != null
          ? `Score ${r.final_score ?? "—"} · ${r.fit_band}`
          : r.final_score != null
            ? `Score ${r.final_score}`
            : null;
      push("ranked", r.completed_at, label);
    }

    // Delivered
    if (match?.delivered_at) push("delivered", match.delivered_at, "Visible to client");

    // Stage transitions (best-effort from current stage)
    if (match?.stage === "shortlisted" || match?.stage === "interview_process" || match?.stage === "offer" || match?.stage === "hired") {
      push("shortlisted", match.updated_at ?? match.delivered_at ?? match.created_at);
    }
    if (match?.stage === "interview_process" || match?.stage === "offer" || match?.stage === "hired") {
      push("interviewed", match.updated_at ?? match.created_at);
    }
    if (match?.stage === "not_moving_forward") {
      push("passed", match.updated_at ?? match.created_at);
    }

    // Hire pipeline
    if (hire) {
      push("offer_sent", hire.sent_at, hire.status);
      push("hired", hire.hired_at ?? hire.accepted_at, hire.status);
      if (hire.declined_at) push("passed", hire.declined_at, "Offer declined");
      if (hire.closed_at && hire.close_reason && !hire.hired_at) {
        push("passed", hire.closed_at, hire.close_reason);
      }
    }

    // Withdrawn
    if (app.withdrawn_at) push("withdrawn", app.withdrawn_at);

    // Rediscovery
    for (const e of (memoryEvents ?? []) as Any[]) {
      const tm = Array.isArray(e.talent_memory) ? e.talent_memory[0] : e.talent_memory;
      if (tm?.candidate_profile_id !== candidateProfileId) continue;
      push("rediscovered", e.created_at, e.notes ?? null);
    }

    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { events };
  });
