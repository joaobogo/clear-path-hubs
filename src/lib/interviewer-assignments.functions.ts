import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWorkspaceArea } from "@/lib/collaborator-roles.server";
import {
  assignmentBlockedReason,
  stageLabelFor,
  type AssignmentEndReason,
  type EligibleInterviewer,
  type InterviewerAssignment,
} from "@/lib/interviewer-assignments";

type ProfileRow = { auth_user_id: string; full_name: string | null; email: string | null };

function nameOf(p: ProfileRow | undefined, fallback = "Team member"): string {
  return p?.full_name?.trim() || p?.email?.trim() || fallback;
}

/**
 * Everyone assigned to this candidate, plus the team members who hold the
 * Interviewer role and could be assigned. Managers only — an interviewer never
 * sees who else is looking at a candidate.
 */
export const getCandidateInterviewerAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(raw),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      stage: string;
      blockedReason: string | null;
      assignments: InterviewerAssignment[];
      interviewers: EligibleInterviewer[];
    }> => {
      // Assigning access is a role-settings decision, not a candidate view.
      await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "role_settings");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: match, error: matchErr } = await supabaseAdmin
        .from("candidate_matches")
        .select("id, stage, organization_id, position_id")
        .eq("id", data.matchId)
        .eq("organization_id", data.orgId)
        .maybeSingle();
      if (matchErr) throw new Error(matchErr.message);
      if (!match) throw new Error("That candidate is not in this workspace.");

      const [{ data: rows, error: rowsErr }, { data: members, error: memErr }] = await Promise.all([
        supabaseAdmin
          .from("candidate_interviewer_assignments")
          .select(
            "id, interviewer_user_id, granted_by_user_id, stage_label, created_at, ended_at, ended_reason",
          )
          .eq("candidate_match_id", data.matchId)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("memberships")
          .select("user_id, role, status")
          .eq("organization_id", data.orgId)
          .eq("role", "client_viewer"),
      ]);
      if (rowsErr) throw new Error(rowsErr.message);
      if (memErr) throw new Error(memErr.message);

      const assignmentRows = rows ?? [];
      const memberRows = (members ?? []) as { user_id: string; status: string }[];
      const activeMembers = memberRows.filter((m) => m.status === "active");

      const userIds = Array.from(
        new Set([
          ...assignmentRows.flatMap((r) => [r.interviewer_user_id, r.granted_by_user_id]),
          ...activeMembers.map((m) => m.user_id),
        ]),
      ).filter(Boolean) as string[];

      const profiles = userIds.length
        ? ((
            await supabaseAdmin
              .from("profiles")
              .select("auth_user_id, full_name, email")
              .in("auth_user_id", userIds)
          ).data as ProfileRow[] | null) ?? []
        : [];
      const byId = new Map(profiles.map((p) => [p.auth_user_id, p]));

      const assignments: InterviewerAssignment[] = assignmentRows.map((r) => ({
        id: r.id as string,
        interviewerUserId: r.interviewer_user_id as string,
        interviewerName: nameOf(byId.get(r.interviewer_user_id as string), "Interviewer"),
        interviewerEmail: byId.get(r.interviewer_user_id as string)?.email ?? null,
        grantedByName: nameOf(byId.get(r.granted_by_user_id as string)),
        grantedAt: r.created_at as string,
        stageLabel: (r.stage_label as string | null) ?? null,
        endedAt: (r.ended_at as string | null) ?? null,
        endedReason: (r.ended_reason as AssignmentEndReason | null) ?? null,
      }));

      const activeIds = new Set(assignments.filter((a) => !a.endedAt).map((a) => a.interviewerUserId));
      const interviewers: EligibleInterviewer[] = activeMembers
        .map((m) => ({
          userId: m.user_id,
          name: nameOf(byId.get(m.user_id), "Interviewer"),
          email: byId.get(m.user_id)?.email ?? null,
          assigned: activeIds.has(m.user_id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        stage: match.stage as string,
        blockedReason: assignmentBlockedReason({ stage: match.stage as string }),
        assignments,
        interviewers,
      };
    },
  );

/**
 * Grants one interviewer read access to one candidate for the current stage.
 * Nothing is granted unless every check passes, so a failure leaves access
 * exactly as it was.
 */
export const assignInterviewerToCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string; matchId: string; interviewerUserId: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        matchId: z.string().uuid(),
        interviewerUserId: z.string().uuid(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "role_settings");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: match } = await supabaseAdmin
      .from("candidate_matches")
      .select("id, stage, position_id, organization_id")
      .eq("id", data.matchId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (!match) throw new Error("That candidate is not in this workspace.");

    const { data: member } = await supabaseAdmin
      .from("memberships")
      .select("status, role")
      .eq("organization_id", data.orgId)
      .eq("user_id", data.interviewerUserId)
      .maybeSingle();
    if (!member) throw new Error("That person is not on your team.");
    if (member.role !== "client_viewer") {
      throw new Error(
        "Only team members with the Interviewer role are assigned this way — Admins and hiring managers already see the role.",
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("candidate_interviewer_assignments")
      .select("id")
      .eq("candidate_match_id", data.matchId)
      .eq("interviewer_user_id", data.interviewerUserId)
      .is("ended_at", null)
      .maybeSingle();

    const blocked = assignmentBlockedReason({
      stage: match.stage as string,
      interviewerStatus: member.status as string,
      alreadyAssigned: Boolean(existing),
    });
    if (blocked) throw new Error(blocked);

    // The open interview for this candidate, when there is one, so the
    // assignment records which stage it was granted for.
    const { data: interview } = await supabaseAdmin
      .from("interviews")
      .select("id, status, requested_at")
      .eq("candidate_match_id", data.matchId)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("candidate_interviewer_assignments").insert({
      organization_id: data.orgId,
      candidate_match_id: data.matchId,
      position_id: match.position_id,
      interviewer_user_id: data.interviewerUserId,
      granted_by_user_id: context.userId,
      interview_id: interview?.id ?? null,
      stage_label: stageLabelFor(match.stage as string),
    });
    if (error) throw new Error(error.message);

    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "member_invited",
        scope: `interviewer_assigned:${data.matchId}:${data.interviewerUserId}`,
        organization_id: data.orgId,
        actor_user_id: context.userId,
        link_path: `/client/candidates/${data.matchId}`,
        payload: { stage: match.stage },
      });
    } catch (e) {
      console.error("[assignInterviewerToCandidate] emit failed", e);
    }

    return { ok: true };
  });

/** Ends an assignment early. Access stops immediately. */
export const revokeInterviewerAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { orgId: string; assignmentId: string }) =>
    z.object({ orgId: z.string().uuid(), assignmentId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "role_settings");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("candidate_interviewer_assignments")
      .update({ ended_at: new Date().toISOString(), ended_reason: "revoked" })
      .eq("id", data.assignmentId)
      .eq("organization_id", data.orgId)
      .is("ended_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That assignment has already ended.");
    return { ok: true };
  });
