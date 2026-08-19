/**
 * @param scopeSuffix makes the idempotency key unique per *real* occurrence
 * (e.g. the new scheduled_at on a reschedule) so a repeat of the same action
 * never produces a second notification, but a genuine change does.
 */
export async function emitInterviewEvent(args) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { emitEventFromServer } = await import("./notifications.functions");
    const { data: interview } = await supabaseAdmin
        .from("interviews")
        .select("id, organization_id, position_id, candidate_match_id, candidate_submission_id, scheduled_at, timezone, status")
        .eq("id", args.interviewId)
        .maybeSingle();
    if (!interview)
        return { delivered: 0 };
    const iv = interview;
    const { data: match } = await supabaseAdmin
        .from("candidate_matches")
        .select("id, application_id, position_id, candidate_profile_id, candidate_profiles:candidate_profile_id(user_id)")
        .eq("id", iv.candidate_match_id)
        .maybeSingle();
    const candidateUserId = match?.candidate_profiles?.user_id ?? null;
    const applicationId = match?.application_id ?? null;
    const scope = `${iv.id}:${args.event}${args.scopeSuffix ? `:${args.scopeSuffix}` : ""}`;
    const payload = {
        interview_id: iv.id,
        status: iv.status,
        scheduled_at: iv.scheduled_at,
        timezone: iv.timezone,
    };
    // Org fanout (client + platform staff members of the organization).
    await emitEventFromServer({
        event: args.event,
        scope,
        organization_id: iv.organization_id,
        position_id: iv.position_id,
        application_id: applicationId,
        candidate_match_id: iv.candidate_match_id,
        candidate_profile_id: match?.candidate_profile_id ?? null,
        actor_user_id: args.actorUserId,
        link_path: `/client/interviews?interview=${iv.id}`,
        payload,
    });
    // Candidate delivery — separate scope, candidate-safe copy and deep link.
    if (candidateUserId && applicationId) {
        await emitEventFromServer({
            event: args.event,
            scope: `${scope}:candidate`,
            organization_id: iv.organization_id,
            position_id: iv.position_id,
            application_id: applicationId,
            candidate_match_id: iv.candidate_match_id,
            candidate_profile_id: match?.candidate_profile_id ?? null,
            actor_user_id: args.actorUserId,
            payload,
            recipients: [
                {
                    user_id: candidateUserId,
                    audience: "candidate",
                    link_path: `/me/applications/${applicationId}`,
                },
            ],
        });
    }
    return { delivered: 1 };
}
