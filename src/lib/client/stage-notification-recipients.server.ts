import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Resolve recipient identities only after the caller has passed its canonical
 * workspace edit guard. Never infer a recipient from a client-supplied email.
 * Candidate contact details stay private; only the account's user ID is used.
 */
export async function stageNotificationRecipients(input: {
  orgId: string;
  matchId: string;
  candidateProfileId: string | null;
  applicationId: string | null;
}) {
  const [staffResult, clientResult, candidateResult] = await Promise.all([
    supabaseAdmin
      .from("memberships")
      .select("user_id")
      .in("role", ["platform_admin", "operations"])
      .eq("status", "active"),
    supabaseAdmin
      .from("memberships")
      .select("user_id")
      .eq("organization_id", input.orgId)
      .eq("status", "active")
      .in("role", ["client_admin", "client_editor", "client_viewer"]),
    input.candidateProfileId
      ? supabaseAdmin
          .from("candidate_profiles")
          .select("user_id")
          .eq("id", input.candidateProfileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [staffResult, clientResult, candidateResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const staff = (staffResult.data ?? []).map((member) => ({
    user_id: member.user_id,
    audience: "admin" as const,
    link_path: "/admin/candidates",
  }));
  const clients = (clientResult.data ?? []).map((member) => ({
    user_id: member.user_id,
    audience: "client" as const,
    link_path: `/client/candidates/${input.matchId}`,
  }));
  const candidateUserId = candidateResult.data?.user_id;
  const candidates = candidateUserId
    ? [
        {
          user_id: candidateUserId,
          audience: "candidate" as const,
          link_path: input.applicationId ? `/me/applications/${input.applicationId}` : "/me",
        },
      ]
    : [];
  return [...staff, ...clients, ...candidates];
}
