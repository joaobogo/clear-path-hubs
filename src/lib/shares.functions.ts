// Shortlist share server functions.
// Auth-scoped mutations use requireSupabaseAuth (RLS as the caller).
// Public token reads/writes use supabaseAdmin — the token itself is the capability.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { toClientCandidateDTO } from "@/lib/client-kpi.server";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const CANDIDATE_SELECT = `id, stage, delivered_at, position_id, application_id, candidate_profile_id, updated_at,
  candidate_profiles(id, full_name, headline, location, timezone, availability, years_experience, summary, experience, skills, education, languages, work_authorization, linkedin_url, portfolio_url, certifications, compensation_preferences),
  positions(id, title, location, work_model, requirements, preferred_requirements, compensation),
  applications(id, source, applied_at, created_at),
  score_runs:approved_score_run_id (score, fit_label, explanation, result, evidence, requirement_coverage, completed_at, engine_version, blueprint_version, contradiction_status, must_have_coverage, preferred_coverage)`;

export type ShareMode = "review" | "presentation" | "compare";

export type ShortlistShareSummary = {
  id: string;
  token: string;
  title: string | null;
  message: string | null;
  default_mode: ShareMode;
  allow_comments: boolean;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  position: { id: string; title: string } | null;
  candidate_count: number;
  comment_count: number;
  status: "active" | "expired" | "revoked";
};

export type PublicShareView = {
  share: {
    id: string;
    title: string | null;
    message: string | null;
    default_mode: ShareMode;
    allow_comments: boolean;
    expires_at: string;
    organization_name: string;
    position: { id: string; title: string; location: string | null } | null;
  };
  candidates: ClientCandidateDTO[];
  comments: Array<{
    id: string;
    match_id: string | null;
    author_name: string;
    body: string;
    sentiment: "positive" | "neutral" | "concern" | "request";
    created_at: string;
  }>;
};

// ─── Auth mutations ─────────────────────────────────────────────────────────

export const createShortlistShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    positionId?: string | null;
    matchIds: string[];
    title?: string;
    message?: string;
    defaultMode?: ShareMode;
    allowComments?: boolean;
    expiresInDays?: number;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        positionId: z.string().uuid().nullable().optional(),
        matchIds: z.array(z.string().uuid()).min(1).max(50),
        title: z.string().trim().max(160).optional(),
        message: z.string().trim().max(1200).optional(),
        defaultMode: z.enum(["review", "presentation", "compare"]).optional(),
        allowComments: z.boolean().optional(),
        expiresInDays: z.number().int().min(1).max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    // Verify all match IDs belong to the org and are visible to clients.
    const { data: rows, error } = await context.supabase
      .from("candidate_matches")
      .select("id, position_id")
      .eq("organization_id", data.orgId)
      .eq("client_visibility", "visible")
      .in("id", data.matchIds);
    if (error) throw new Error(error.message);
    const foundIds = new Set((rows as AnyRow[]).map((r) => r.id));
    const missing = data.matchIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new Error(
        "Some candidates are not available to share yet. Refresh the shortlist and try again.",
      );
    }

    const positionId = data.positionId ?? null;

    // Token: 32 random bytes → base64url, ~43 chars.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    const expiresInDays = data.expiresInDays ?? 14;
    const expires_at = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: inserted, error: insErr } = await context.supabase
      .from("shortlist_shares")
      .insert({
        organization_id: data.orgId,
        position_id: positionId,
        match_ids: data.matchIds,
        token,
        title: data.title ?? null,
        message: data.message ?? null,
        default_mode: data.defaultMode ?? "review",
        allow_comments: data.allowComments ?? true,
        expires_at,
        created_by: context.userId,
      })
      .select("id, token, expires_at, default_mode, allow_comments")
      .single();
    if (insErr) throw new Error(insErr.message);

    return {
      id: (inserted as AnyRow).id,
      token: (inserted as AnyRow).token,
      expires_at: (inserted as AnyRow).expires_at,
      default_mode: (inserted as AnyRow).default_mode as ShareMode,
      allow_comments: (inserted as AnyRow).allow_comments as boolean,
    };
  });

export const listShortlistShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<ShortlistShareSummary[]> => {
    const { data: shares, error } = await context.supabase
      .from("shortlist_shares")
      .select(
        "id, token, title, message, default_mode, allow_comments, expires_at, revoked_at, view_count, last_viewed_at, created_at, match_ids, positions:position_id(id, title)",
      )
      .eq("organization_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const rows = (shares as AnyRow[]) ?? [];
    const ids = rows.map((r) => r.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: comments } = await context.supabase
        .from("shortlist_share_comments")
        .select("share_id")
        .in("share_id", ids);
      for (const c of (comments as AnyRow[]) ?? []) {
        counts.set(c.share_id, (counts.get(c.share_id) ?? 0) + 1);
      }
    }
    const now = Date.now();
    return rows.map((r) => ({
      id: r.id,
      token: r.token,
      title: r.title,
      message: r.message,
      default_mode: r.default_mode as ShareMode,
      allow_comments: r.allow_comments,
      expires_at: r.expires_at,
      revoked_at: r.revoked_at,
      view_count: r.view_count ?? 0,
      last_viewed_at: r.last_viewed_at,
      created_at: r.created_at,
      position: r.positions ? { id: r.positions.id, title: r.positions.title } : null,
      candidate_count: Array.isArray(r.match_ids) ? r.match_ids.length : 0,
      comment_count: counts.get(r.id) ?? 0,
      status: r.revoked_at
        ? "revoked"
        : new Date(r.expires_at).getTime() < now
          ? "expired"
          : "active",
    }));
  });

export const revokeShortlistShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; orgId: string }) =>
    z.object({ id: z.string().uuid(), orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("shortlist_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const extendShortlistShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; orgId: string; days: number }) =>
    z
      .object({
        id: z.string().uuid(),
        orgId: z.string().uuid(),
        days: z.number().int().min(1).max(60),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const expires_at = new Date(
      Date.now() + data.days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { error } = await context.supabase
      .from("shortlist_shares")
      .update({ expires_at, revoked_at: null })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true as const, expires_at };
  });

// ─── Public token reads/writes ──────────────────────────────────────────────

async function loadShareByTokenAdmin(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: share, error } = await supabaseAdmin
    .from("shortlist_shares")
    .select(
      "id, organization_id, position_id, match_ids, title, message, default_mode, allow_comments, expires_at, revoked_at, organizations:organization_id(name), positions:position_id(id, title, location)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!share) return { supabaseAdmin, share: null as null };
  return { supabaseAdmin, share: share as AnyRow };
}

export const getShortlistShareByToken = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(20).max(80) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicShareView | { error: string }> => {
    const { supabaseAdmin, share } = await loadShareByTokenAdmin(data.token);
    if (!share) return { error: "This share link is invalid." };
    if (share.revoked_at) return { error: "This share link has been revoked." };
    if (new Date(share.expires_at).getTime() < Date.now())
      return { error: "This share link has expired." };

    const matchIds: string[] = Array.isArray(share.match_ids) ? share.match_ids : [];
    if (matchIds.length === 0) return { error: "This share is empty." };

    const [{ data: matches, error: mErr }, { data: comments }] = await Promise.all([
      supabaseAdmin
        .from("candidate_matches")
        .select(CANDIDATE_SELECT)
        .eq("organization_id", share.organization_id)
        // Re-check publish state at read time. If admin later hides/retracts a match,
        // an outstanding share token must not continue serving it. This closes the
        // leak where visibility was only validated at share-creation time.
        .eq("client_visibility", "visible")
        .in("id", matchIds),
      supabaseAdmin
        .from("shortlist_share_comments")
        .select("id, match_id, author_name, body, sentiment, created_at")
        .eq("share_id", share.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (mErr) throw new Error(mErr.message);

    const rowsById = new Map<string, AnyRow>();
    for (const m of (matches as AnyRow[]) ?? []) rowsById.set(m.id, m);

    // Load answers per application in one round trip so screening data is present.
    const appIds = ((matches as AnyRow[]) ?? [])
      .map((m) => m.application_id)
      .filter(Boolean);
    const answersByApp = new Map<string, AnyRow[]>();
    if (appIds.length > 0) {
      const { data: answers } = await supabaseAdmin
        .from("application_answers")
        .select("application_id, id, answer, screening_questions(question, display_order)")
        .in("application_id", appIds);
      for (const a of (answers as AnyRow[]) ?? []) {
        const list = answersByApp.get(a.application_id) ?? [];
        list.push(a);
        answersByApp.set(a.application_id, list);
      }
    }

    const candidates: ClientCandidateDTO[] = matchIds
      .map((id) => rowsById.get(id))
      .filter(Boolean)
      .map((row) => {
        const answers = answersByApp.get(row.application_id) ?? [];
        answers.sort(
          (a, b) =>
            (a.screening_questions?.display_order ?? 0) -
            (b.screening_questions?.display_order ?? 0),
        );
        return toClientCandidateDTO({
          ...row,
          application_answers: answers,
          audit_events: [],
        });
      });

    // Fire-and-forget view counter — never let it break the load.
    void supabaseAdmin
      .from("shortlist_shares")
      .update({
        view_count: (share.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", share.id);

    return {
      share: {
        id: share.id,
        title: share.title,
        message: share.message,
        default_mode: share.default_mode as ShareMode,
        allow_comments: share.allow_comments,
        expires_at: share.expires_at,
        organization_name: share.organizations?.name ?? "TaaSFlow client",
        position: share.positions
          ? {
              id: share.positions.id,
              title: share.positions.title,
              location: share.positions.location ?? null,
            }
          : null,
      },
      candidates,
      comments: ((comments as AnyRow[]) ?? []).map((c) => ({
        id: c.id,
        match_id: c.match_id,
        author_name: c.author_name,
        body: c.body,
        sentiment: c.sentiment,
        created_at: c.created_at,
      })),
    };
  });

export const addShareComment = createServerFn({ method: "POST" })
  .inputValidator((input: {
    token: string;
    matchId?: string | null;
    authorName: string;
    authorEmail?: string;
    body: string;
    sentiment?: "positive" | "neutral" | "concern" | "request";
  }) =>
    z
      .object({
        token: z.string().min(20).max(80),
        matchId: z.string().uuid().nullable().optional(),
        authorName: z.string().trim().min(1).max(120),
        authorEmail: z.string().email().max(240).optional(),
        body: z.string().trim().min(1).max(4000),
        sentiment: z
          .enum(["positive", "neutral", "concern", "request"])
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin, share } = await loadShareByTokenAdmin(data.token);
    if (!share) throw new Error("Share not found");
    if (share.revoked_at) throw new Error("This share has been revoked.");
    if (new Date(share.expires_at).getTime() < Date.now())
      throw new Error("This share has expired.");
    if (!share.allow_comments)
      throw new Error("Comments are turned off for this share.");
    if (data.matchId) {
      const matchIds: string[] = Array.isArray(share.match_ids) ? share.match_ids : [];
      if (!matchIds.includes(data.matchId)) {
        throw new Error("This candidate is not part of the shared shortlist.");
      }
    }
    const { error } = await supabaseAdmin.from("shortlist_share_comments").insert({
      share_id: share.id,
      match_id: data.matchId ?? null,
      author_name: data.authorName,
      author_email: data.authorEmail ?? null,
      body: data.body,
      sentiment: data.sentiment ?? "neutral",
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
