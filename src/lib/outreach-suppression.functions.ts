import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BLOCK_EXPLANATION,
  BLOCK_LABEL,
  CHANNEL_LABEL,
  SUPPRESSION_CHANNELS,
  SUPPRESSION_QUALIFIER_KEY,
  SUPPRESSION_QUALIFIER_LABEL,
  failClosedVerdict,
  type ChannelVerdict,
  type ContactStatus,
  type OptOutEntry,
  type SuppressionChannel,
  type SuppressionException,
} from "@/lib/outreach-suppression";
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function assertMember(supabase: Db, userId: string, org: string) {
  await assertWorkspaceAccess(supabase, userId, org);
}

async function assertGrantor(supabase: Db, userId: string, org: string) {
  const { data: admin } = await supabase.rpc("is_org_admin", { _user: userId, _org: org });
  if (admin) return;
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (!staff) throw new Error("Only an admin can grant a contact exception.");
}

/**
 * Read the contact status for one person, exactly as the database sees it.
 * Every channel verdict comes from `outreach_contact_allowed` — the same
 * function the insert trigger runs — so the UI can never be more permissive
 * than enforcement.
 */
export const getContactStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        candidate_profile_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ContactStatus> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertMember(supabase, userId, data.organization_id);

    const { data: profile } = await supabase
      .from("candidate_profiles")
      .select("email")
      .eq("id", data.candidate_profile_id)
      .maybeSingle();

    const email = (profile as Db)?.email ?? null;

    let optOutRows: Db[] = [];
    const byProfile = await supabase
      .from("outreach_opt_outs")
      .select("id, channel, organization_id, reason, created_at, candidate_profile_id, email")
      .eq("candidate_profile_id", data.candidate_profile_id);
    if (byProfile.error) throw byProfile.error;
    optOutRows = byProfile.data ?? [];

    if (email) {
      const byEmail = await supabase
        .from("outreach_opt_outs")
        .select("id, channel, organization_id, reason, created_at, candidate_profile_id, email")
        .eq("email", email);
      if (byEmail.error) throw byEmail.error;
      for (const row of byEmail.data ?? []) {
        if (!optOutRows.some((r) => r.id === row.id)) optOutRows.push(row);
      }
    }

    const optOuts: OptOutEntry[] = optOutRows
      .filter(
        (r) => r.organization_id === null || r.organization_id === data.organization_id,
      )
      .map((r) => ({
        id: r.id as string,
        channel: (r.channel as string | null) ?? null,
        channelLabel: r.channel
          ? (CHANNEL_LABEL[r.channel as string] ?? (r.channel as string))
          : "All channels",
        scope: (r.organization_id === null ? "global" : "organization") as
          | "global"
          | "organization",
        reason: (r.reason as string | null) ?? null,
        created_at: r.created_at as string,
        matched_by: (r.candidate_profile_id === data.candidate_profile_id
          ? "profile"
          : "email") as "profile" | "email",
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    // Exceptions granted against this person, in this workspace.
    const { data: matchRows } = await supabase
      .from("candidate_matches")
      .select("id")
      .eq("candidate_profile_id", data.candidate_profile_id)
      .eq("organization_id", data.organization_id);

    const matchIds = (matchRows ?? []).map((m: Db) => m.id as string);

    let exceptions: SuppressionException[] = [];
    if (matchIds.length > 0) {
      const { data: exRows, error: exErr } = await supabase
        .from("eligibility_exceptions")
        .select(
          "id, reason, created_at, expires_at, revoked_at, eligibility_checks:eligibility_check_id(qualifier_key)",
        )
        .eq("organization_id", data.organization_id)
        .in("candidate_match_id", matchIds);
      if (exErr) throw exErr;
      exceptions = (exRows ?? [])
        .filter(
          (r: Db) => r.eligibility_checks?.qualifier_key === SUPPRESSION_QUALIFIER_KEY,
        )
        .map((r: Db) => ({
          id: r.id as string,
          reason: (r.reason as string) ?? "",
          granted_at: r.created_at as string,
          expires_at: (r.expires_at as string | null) ?? null,
          revoked_at: (r.revoked_at as string | null) ?? null,
        }))
        .sort((a: SuppressionException, b: SuppressionException) =>
          a.granted_at < b.granted_at ? 1 : -1,
        );
    }

    const verdicts: ChannelVerdict[] = [];
    for (const channel of SUPPRESSION_CHANNELS) {
      const { data: verdict, error } = await supabase.rpc("outreach_contact_allowed", {
        _org: data.organization_id,
        _candidate_profile_id: data.candidate_profile_id,
        _channel: channel,
      });
      if (error || !verdict) {
        // Fail closed: an unreadable verdict blocks sending.
        verdicts.push(failClosedVerdict(channel as SuppressionChannel));
        continue;
      }
      const v = verdict as { allowed: boolean; reason: string | null };
      verdicts.push({
        channel: channel as SuppressionChannel,
        label: CHANNEL_LABEL[channel] ?? channel,
        allowed: !!v.allowed,
        reason: v.reason ?? null,
        reasonLabel: v.reason ? (BLOCK_LABEL[v.reason] ?? v.reason) : null,
        explanation: v.reason ? (BLOCK_EXPLANATION[v.reason] ?? null) : null,
      });
    }

    return {
      candidate_profile_id: data.candidate_profile_id,
      organization_id: data.organization_id,
      suppressed: optOuts.length > 0,
      optOuts,
      exceptions,
      verdicts,
      fullyBlocked: verdicts.every((v) => !v.allowed),
    };
  });

/**
 * Grant a contact exception through the existing eligibility-exception path.
 * The database only lets outreach past a suppression when a record like this
 * exists, is unrevoked and unexpired — there is no soft override.
 */
export const requestContactException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        candidate_match_id: z.string().uuid(),
        reason: z.string().trim().min(20).max(1000),
        expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };

    const { data: match, error: matchErr } = await supabase
      .from("candidate_matches")
      .select("id, organization_id, position_id, candidate_profile_id")
      .eq("id", data.candidate_match_id)
      .maybeSingle();
    if (matchErr) throw matchErr;
    if (!match) throw new Error("Candidate not found.");

    const org = (match as Db).organization_id as string;
    await assertGrantor(supabase, userId, org);

    // Reuse or create the qualifier this exception hangs off.
    const { data: existingCheck } = await supabase
      .from("eligibility_checks")
      .select("id")
      .eq("candidate_match_id", data.candidate_match_id)
      .eq("qualifier_key", SUPPRESSION_QUALIFIER_KEY)
      .maybeSingle();

    let checkId = (existingCheck as Db)?.id as string | undefined;
    if (!checkId) {
      const { data: inserted, error: checkErr } = await supabase
        .from("eligibility_checks")
        .insert({
          candidate_match_id: data.candidate_match_id,
          organization_id: org,
          position_id: (match as Db).position_id,
          qualifier_key: SUPPRESSION_QUALIFIER_KEY,
          qualifier_label: SUPPRESSION_QUALIFIER_LABEL,
          qualifier_kind: "disqualifier",
          status: "excepted",
          reason: "This person opted out of outreach.",
          actor_user_id: userId,
        })
        .select("id")
        .single();
      if (checkErr) throw checkErr;
      checkId = (inserted as Db).id as string;
    } else {
      await supabase
        .from("eligibility_checks")
        .update({ status: "excepted", actor_user_id: userId })
        .eq("id", checkId);
    }

    const expiresAt =
      data.expires_in_days != null
        ? new Date(Date.now() + data.expires_in_days * 86400000).toISOString()
        : null;

    const { data: exception, error: exErr } = await supabase
      .from("eligibility_exceptions")
      .insert({
        eligibility_check_id: checkId,
        candidate_match_id: data.candidate_match_id,
        organization_id: org,
        granted_by: userId,
        reason: data.reason,
        expires_at: expiresAt,
      })
      .select("id, created_at, expires_at")
      .single();
    if (exErr) throw exErr;

    await supabase.from("audit_events").insert({
      actor_user_id: userId,
      organization_id: org,
      entity_type: "candidate_match",
      entity_id: data.candidate_match_id,
      action: "outreach_suppression_exception_granted",
      after_state: {
        exception_id: (exception as Db).id,
        candidate_profile_id: (match as Db).candidate_profile_id,
        reason: data.reason,
        expires_at: expiresAt,
      },
    });

    return {
      id: (exception as Db).id as string,
      granted_at: (exception as Db).created_at as string,
      expires_at: expiresAt,
    };
  });
