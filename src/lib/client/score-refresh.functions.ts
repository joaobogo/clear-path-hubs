import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/**
 * Ask us to reassess a candidate against the current brief.
 *
 * Nothing is recomputed here: a stale assessment stays exactly as the client
 * last saw it, and the request lands with the recruiting team who own the run.
 * Requesting twice inside the same hour does not queue two asks.
 */
export const requestScoreRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string; reason?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        matchId: z.string().uuid(),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const s = context.supabase as AnyRow;
    const { data: match } = await s
      .from("candidate_matches")
      .select("id, position_id, organization_id, client_visibility")
      .eq("organization_id", data.orgId)
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match || (match as AnyRow).client_visibility !== "visible") throw new Error("match_not_found");

    const { data: me } = await s
      .from("profiles")
      .select("full_name")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const who = (me as AnyRow)?.full_name || "The client";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // One ask per match per hour — a second click is acknowledged, not queued.
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const { data: recent } = await (supabaseAdmin as AnyRow)
      .from("audit_events")
      .select("id")
      .eq("entity_id", data.matchId)
      .eq("action", "client.score_refresh_requested")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    await (supabaseAdmin as AnyRow).from("audit_events").insert({
      actor_user_id: context.userId,
      action: "client.score_refresh_requested",
      entity_type: "candidate_matches",
      entity_id: data.matchId,
      organization_id: data.orgId,
      after_state: { reason: data.reason ?? null } as never,
    });

    if (!recent) {
      await (supabaseAdmin as AnyRow).rpc("notify_platform_staff", {
        _organization_id: data.orgId,
        _event_type: "approval_needed",
        _title: `${who} asked for a candidate to be reassessed`,
        _body: data.reason
          ? `Reason given: ${data.reason}`
          : "The brief or the candidate's evidence changed after the last assessment.",
        _link_path: `/admin/scoring/review/${data.matchId}`,
      });
    }

    return { ok: true, duplicate: Boolean(recent) };
  });
