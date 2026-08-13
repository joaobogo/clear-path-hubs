import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CV_DOWNLOAD_ACTION = "cv.download";

export type CvDownloadAuditEntry = {
  id: string;
  at: string;
  /** Display name of the person who fetched the file. */
  actor_name: string;
  actor_email: string | null;
  /** Which side the actor was acting from. */
  audience: "staff" | "client" | "candidate" | "unknown";
  /** Saved a copy vs. opened it in the browser. */
  action: "downloaded" | "previewed";
  candidate_name: string | null;
  match_id: string;
  filename: string | null;
};

/**
 * Audit trail of every signed CV link issued for a candidate match.
 *
 * Visibility mirrors the download gate itself:
 *  - platform staff see every access, including client-side reads
 *  - client members with `view_candidates` see only their own organization's reads
 *  - the candidate sees reads of their own document
 */
export const getCvDownloadAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string; limit?: number }) => {
    if (!input?.matchId || typeof input.matchId !== "string") throw new Error("matchId required");
    const limit = Number(input.limit ?? 50);
    return { matchId: input.matchId, limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50 };
  })
  .handler(async ({ data, context }): Promise<CvDownloadAuditEntry[]> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: match } = await supabaseAdmin
      .from("candidate_matches")
      .select("id, candidate_profile_id, organization_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) return [];

    const { data: staffRow } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", ["platform_admin", "operations"])
      .limit(1)
      .maybeSingle();

    let scope: "all" | "org" | "none" = staffRow ? "all" : "none";

    if (scope === "none") {
      const { data: own } = await supabaseAdmin
        .from("candidate_profiles")
        .select("id")
        .eq("id", match.candidate_profile_id as string)
        .eq("user_id", userId)
        .maybeSingle();
      if (own) scope = "all";
    }

    const orgId = match.organization_id as string | null;
    if (scope === "none" && orgId) {
      const { data: allowed } = await supabase.rpc("has_client_permission", {
        _user: userId,
        _org: orgId,
        _perm: "view_candidates",
      });
      if (allowed === true) scope = "org";
    }

    if (scope === "none") return [];

    let query = supabaseAdmin
      .from("audit_events")
      .select("id, created_at, actor_user_id, organization_id, after_state")
      .eq("entity_type", "candidate_matches")
      .eq("entity_id", data.matchId)
      .eq("action", CV_DOWNLOAD_ACTION)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (scope === "org") query = query.eq("organization_id", orgId as string);

    const { data: rows } = await query;
    const events = (rows ?? []) as Array<{
      id: string;
      created_at: string;
      actor_user_id: string | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      after_state: any;
    }>;
    if (events.length === 0) return [];

    const actorIds = Array.from(
      new Set(events.map((e) => e.actor_user_id).filter((v): v is string => !!v)),
    );
    const actorMap = new Map<string, { name: string; email: string | null }>();
    if (actorIds.length > 0) {
      const { data: people } = await supabaseAdmin
        .from("profiles")
        .select("auth_user_id, full_name, email")
        .in("auth_user_id", actorIds);
      for (const p of (people ?? []) as Array<{
        auth_user_id: string | null;
        full_name: string | null;
        email: string | null;
      }>) {
        if (p.auth_user_id) {
          actorMap.set(p.auth_user_id, {
            name: p.full_name?.trim() || p.email || "Unknown user",
            email: p.email ?? null,
          });
        }
      }
    }

    const { data: candidate } = await supabaseAdmin
      .from("candidate_profiles")
      .select("full_name")
      .eq("id", match.candidate_profile_id as string)
      .maybeSingle();

    return events.map((e) => {
      const actor = e.actor_user_id ? actorMap.get(e.actor_user_id) : undefined;
      const state = e.after_state ?? {};
      const audience = ["staff", "client", "candidate"].includes(String(state.audience))
        ? (state.audience as CvDownloadAuditEntry["audience"])
        : "unknown";
      return {
        id: String(e.id),
        at: String(e.created_at),
        actor_name: actor?.name ?? (e.actor_user_id ? "Unknown user" : "System"),
        actor_email: actor?.email ?? null,
        audience,
        action: state.disposition === "inline" ? ("previewed" as const) : ("downloaded" as const),
        candidate_name: (candidate?.full_name as string | null) ?? null,
        match_id: data.matchId,
        filename: (state.filename as string | null) ?? null,
      };
    });
  });
