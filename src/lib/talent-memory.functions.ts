// Silver Medalist / Talent Memory server functions.
// Every read + write is scoped to the caller's organization via RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const REASON_ENUM = [
  "role_filled",
  "timing",
  "comp_gap",
  "level_mismatch",
  "geo",
  "better_fit_selected",
  "skills_gap",
  "other",
] as const;
export type SilverReason = (typeof REASON_ENUM)[number];

const CONSENT_ENUM = ["granted", "pending", "declined", "withdrawn"] as const;
export type SilverConsent = (typeof CONSENT_ENUM)[number];

export const REASON_LABELS: Record<SilverReason, string> = {
  role_filled: "Role was filled",
  timing: "Timing didn't match",
  comp_gap: "Compensation gap",
  level_mismatch: "Level mismatch",
  geo: "Location / work model",
  better_fit_selected: "Better fit selected",
  skills_gap: "Skill gap for this role",
  other: "Other",
};

export type TalentMemoryDTO = {
  id: string;
  organization_id: string;
  candidate_profile_id: string;
  source_match_id: string | null;
  source_position_id: string | null;
  reason_category: SilverReason;
  reason_notes: string | null;
  headline_snapshot: string | null;
  seniority_snapshot: string | null;
  role_title_snapshot: string | null;
  skills_snapshot: string[];
  score_snapshot: number | null;
  owner_user_id: string | null;
  owner_name: string | null;
  consent_status: SilverConsent;
  consent_updated_at: string | null;
  consent_expires_at: string | null;
  status: "active" | "archived";
  last_resurfaced_at: string | null;
  last_reengaged_at: string | null;
  tagged_by: string | null;
  tagged_by_name: string | null;
  tagged_at: string;
  candidate: {
    display_name: string;
    email_masked: string;
    headline: string | null;
    seniority: string | null;
    location: string | null;
  };
};

export type TalentMemoryEventDTO = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_name: string | null;
  position_id: string | null;
  notes: string | null;
  created_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertOrgEditor(supabase: AnyRow, userId: string, orgId: string) {
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (staff === true) return;
  const { data } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  if (!["client_admin", "client_editor"].includes((data as AnyRow).role))
    throw new Error("Read-only role");
}

function maskEmail(email: string | null | undefined) {
  if (!email) return "";
  const [u, d] = String(email).split("@");
  if (!d) return "";
  return `${u.slice(0, 1)}•••@${d}`;
}

function displayName(row: AnyRow): string {
  const full = row?.full_name ? String(row.full_name).trim() : "";
  if (full) {
    const parts = full.split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`;
    return parts[0] ?? "Candidate";
  }
  if (row?.email) {
    const local = String(row.email).split("@")[0] ?? "";
    return local || "Member";
  }
  return "Candidate";
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      typeof x === "string"
        ? x
        : x && typeof x === "object" && "name" in (x as AnyRow)
          ? String((x as AnyRow).name ?? "")
          : "",
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeSkill(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9+#. ]/g, "").replace(/\s+/g, " ").trim();
}

async function decorateMemories(
  supabase: AnyRow,
  rows: AnyRow[],
): Promise<TalentMemoryDTO[]> {
  if (rows.length === 0) return [];
  const profileIds = Array.from(new Set(rows.map((r) => r.candidate_profile_id)));
  const userIds = Array.from(
    new Set(rows.flatMap((r) => [r.tagged_by, r.owner_user_id]).filter(Boolean)),
  );

  const [{ data: profiles }, { data: profileProfiles }] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select("id, first_name, last_name, email, headline, seniority, location")
      .in("id", profileIds),
    userIds.length
      ? supabase
          .from("profiles")
          .select("auth_user_id, first_name, last_name, email")
          .in("auth_user_id", userIds)
      : Promise.resolve({ data: [] as AnyRow[] }),
  ]);

  const profMap = new Map<string, AnyRow>();
  for (const p of (profiles as AnyRow[]) ?? []) profMap.set(p.id, p);
  const userMap = new Map<string, string>();
  for (const p of (profileProfiles as AnyRow[]) ?? []) {
    userMap.set(p.auth_user_id, displayName(p) || p.email || "Member");
  }

  return rows.map((r) => {
    const p = profMap.get(r.candidate_profile_id) ?? {};
    return {
      id: r.id,
      organization_id: r.organization_id,
      candidate_profile_id: r.candidate_profile_id,
      source_match_id: r.source_match_id,
      source_position_id: r.source_position_id,
      reason_category: r.reason_category,
      reason_notes: r.reason_notes,
      headline_snapshot: r.headline_snapshot,
      seniority_snapshot: r.seniority_snapshot,
      role_title_snapshot: r.role_title_snapshot,
      skills_snapshot: toStringArray(r.skills_snapshot),
      score_snapshot: r.score_snapshot != null ? Number(r.score_snapshot) : null,
      owner_user_id: r.owner_user_id,
      owner_name: r.owner_user_id ? (userMap.get(r.owner_user_id) ?? null) : null,
      consent_status: r.consent_status,
      consent_updated_at: r.consent_updated_at,
      consent_expires_at: r.consent_expires_at,
      status: r.status,
      last_resurfaced_at: r.last_resurfaced_at,
      last_reengaged_at: r.last_reengaged_at,
      tagged_by: r.tagged_by,
      tagged_by_name: r.tagged_by ? (userMap.get(r.tagged_by) ?? null) : null,
      tagged_at: r.tagged_at,
      candidate: {
        display_name: displayName(p),
        email_masked: maskEmail(p.email),
        headline: p.headline ?? r.headline_snapshot ?? null,
        seniority: p.seniority ?? r.seniority_snapshot ?? null,
        location: p.location ?? null,
      },
    };
  });
}

// ─── Tag silver medalist ─────────────────────────────────────────────────────

export const tagSilverMedalist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    matchId: string;
    reason_category: SilverReason;
    reason_notes?: string;
    consent_status?: SilverConsent;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        matchId: z.string().uuid(),
        reason_category: z.enum(REASON_ENUM),
        reason_notes: z.string().max(2000).optional(),
        consent_status: z.enum(CONSENT_ENUM).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgEditor(context.supabase, context.userId, data.orgId);

    const { data: match, error: mErr } = await context.supabase
      .from("candidate_matches")
      .select(
        "id, organization_id, candidate_profile_id, position_id, approved_score_run_id",
      )
      .eq("id", data.matchId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!match) throw new Error("Match not found");
    if ((match as AnyRow).organization_id !== data.orgId)
      throw new Error("Forbidden");

    const [{ data: profile }, { data: position }, { data: run }] =
      await Promise.all([
        context.supabase
          .from("candidate_profiles")
          .select("headline, seniority, skills")
          .eq("id", (match as AnyRow).candidate_profile_id)
          .maybeSingle(),
        context.supabase
          .from("positions")
          .select("title")
          .eq("id", (match as AnyRow).position_id)
          .maybeSingle(),
        (match as AnyRow).approved_score_run_id
          ? context.supabase
              .from("score_runs")
              .select("final_score")
              .eq("id", (match as AnyRow).approved_score_run_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const payload = {
      organization_id: data.orgId,
      candidate_profile_id: (match as AnyRow).candidate_profile_id,
      source_match_id: (match as AnyRow).id,
      source_position_id: (match as AnyRow).position_id,
      reason_category: data.reason_category,
      reason_notes: data.reason_notes ?? null,
      headline_snapshot: (profile as AnyRow)?.headline ?? null,
      seniority_snapshot: (profile as AnyRow)?.seniority ?? null,
      role_title_snapshot: (position as AnyRow)?.title ?? null,
      skills_snapshot: (profile as AnyRow)?.skills ?? [],
      score_snapshot: (run as AnyRow)?.final_score ?? null,
      owner_user_id: context.userId,
      consent_status: data.consent_status ?? "pending",
      consent_updated_at: data.consent_status ? new Date().toISOString() : null,
      tagged_by: context.userId,
      status: "active",
    };

    const { data: upserted, error: upErr } = await context.supabase
      .from("talent_memory")
      .upsert(payload, { onConflict: "organization_id,candidate_profile_id" })
      .select("*")
      .single();
    if (upErr) throw new Error(upErr.message);

    await context.supabase.from("talent_memory_events").insert({
      talent_memory_id: (upserted as AnyRow).id,
      organization_id: data.orgId,
      event_type: "tagged",
      actor_user_id: context.userId,
      position_id: (match as AnyRow).position_id,
      notes: data.reason_notes ?? null,
      metadata: { reason_category: data.reason_category },
    });

    return { ok: true, id: (upserted as AnyRow).id };
  });

// ─── List silver medalists ───────────────────────────────────────────────────

export const listSilverMedalists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    status?: "active" | "archived" | "all";
    reason?: SilverReason;
    q?: string;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        status: z.enum(["active", "archived", "all"]).optional(),
        reason: z.enum(REASON_ENUM).optional(),
        q: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const status = data.status ?? "active";
    let q = context.supabase
      .from("talent_memory")
      .select("*")
      .eq("organization_id", data.orgId)
      .order("tagged_at", { ascending: false })
      .limit(500);
    if (status !== "all") q = q.eq("status", status);
    if (data.reason) q = q.eq("reason_category", data.reason);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const decorated = await decorateMemories(context.supabase, (rows as AnyRow[]) ?? []);
    const term = data.q?.trim().toLowerCase();
    const filtered = term
      ? decorated.filter((m) => {
          const hay = [
            m.candidate.display_name,
            m.candidate.headline ?? "",
            m.role_title_snapshot ?? "",
            m.reason_notes ?? "",
            ...m.skills_snapshot,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(term);
        })
      : decorated;
    return { memories: filtered };
  });

// ─── Get one silver medalist + event history ─────────────────────────────────

export const getSilverMedalist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; id: string }) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("talent_memory")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    const [memory] = await decorateMemories(context.supabase, [row as AnyRow]);

    const { data: events } = await context.supabase
      .from("talent_memory_events")
      .select("id, event_type, actor_user_id, position_id, notes, created_at")
      .eq("talent_memory_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const actorIds = Array.from(
      new Set(((events as AnyRow[]) ?? []).map((e) => e.actor_user_id).filter(Boolean)),
    );
    const positionIds = Array.from(
      new Set(((events as AnyRow[]) ?? []).map((e) => e.position_id).filter(Boolean)),
    );
    const [{ data: actors }, { data: positions }] = await Promise.all([
      actorIds.length
        ? context.supabase
            .from("profiles")
            .select("auth_user_id, first_name, last_name, email")
            .in("auth_user_id", actorIds)
        : Promise.resolve({ data: [] as AnyRow[] }),
      positionIds.length
        ? context.supabase
            .from("positions")
            .select("id, title")
            .in("id", positionIds)
        : Promise.resolve({ data: [] as AnyRow[] }),
    ]);
    const actorMap = new Map<string, string>();
    for (const a of (actors as AnyRow[]) ?? [])
      actorMap.set(a.auth_user_id, displayName(a) || a.email || "Member");
    const posMap = new Map<string, string>();
    for (const p of (positions as AnyRow[]) ?? []) posMap.set(p.id, p.title);

    const eventsOut: TalentMemoryEventDTO[] = ((events as AnyRow[]) ?? []).map((e) => ({
      id: e.id,
      event_type: e.event_type,
      actor_user_id: e.actor_user_id,
      actor_name: e.actor_user_id ? (actorMap.get(e.actor_user_id) ?? null) : null,
      position_id: e.position_id,
      notes: e.notes,
      created_at: e.created_at,
    }));

    // Prior match history for the candidate (all matches in this org)
    const { data: history } = await context.supabase
      .from("candidate_matches")
      .select("id, position_id, stage, delivered_at, created_at, updated_at")
      .eq("organization_id", data.orgId)
      .eq("candidate_profile_id", memory.candidate_profile_id)
      .order("created_at", { ascending: false });
    const historyPositionIds = Array.from(
      new Set(((history as AnyRow[]) ?? []).map((h) => h.position_id)),
    );
    const { data: histPositions } = historyPositionIds.length
      ? await context.supabase
          .from("positions")
          .select("id, title")
          .in("id", historyPositionIds)
      : { data: [] as AnyRow[] };
    const histPosMap = new Map<string, string>();
    for (const p of (histPositions as AnyRow[]) ?? []) histPosMap.set(p.id, p.title);
    const matchHistory = ((history as AnyRow[]) ?? []).map((h) => ({
      match_id: h.id,
      position_id: h.position_id,
      position_title: histPosMap.get(h.position_id) ?? "Untitled role",
      stage: h.stage as string,
      created_at: h.created_at as string,
      updated_at: h.updated_at as string,
    }));

    return { memory, events: eventsOut, match_history: matchHistory };
  });

// ─── Update: consent, ownership, archive, notes ──────────────────────────────

export const updateSilverMedalist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    id: string;
    consent_status?: SilverConsent;
    owner_user_id?: string | null;
    status?: "active" | "archived";
    reason_notes?: string;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
        consent_status: z.enum(CONSENT_ENUM).optional(),
        owner_user_id: z.string().uuid().nullable().optional(),
        status: z.enum(["active", "archived"]).optional(),
        reason_notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgEditor(context.supabase, context.userId, data.orgId);
    const patch: AnyRow = {};
    const events: Array<{ event_type: string; notes: string | null; metadata: AnyRow }> = [];

    if (data.consent_status) {
      patch.consent_status = data.consent_status;
      patch.consent_updated_at = new Date().toISOString();
      events.push({
        event_type: "consent_changed",
        notes: null,
        metadata: { consent_status: data.consent_status },
      });
    }
    if (data.owner_user_id !== undefined) {
      patch.owner_user_id = data.owner_user_id;
      events.push({
        event_type: "ownership_changed",
        notes: null,
        metadata: { owner_user_id: data.owner_user_id },
      });
    }
    if (data.status) {
      patch.status = data.status;
      events.push({
        event_type: data.status === "archived" ? "archived" : "reopened",
        notes: null,
        metadata: {},
      });
    }
    if (data.reason_notes !== undefined) {
      patch.reason_notes = data.reason_notes;
      events.push({
        event_type: "note",
        notes: data.reason_notes,
        metadata: {},
      });
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("talent_memory")
      .update(patch)
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);

    if (events.length) {
      await context.supabase.from("talent_memory_events").insert(
        events.map((e) => ({
          talent_memory_id: data.id,
          organization_id: data.orgId,
          event_type: e.event_type,
          actor_user_id: context.userId,
          notes: e.notes,
          metadata: e.metadata,
        })),
      );
    }
    return { ok: true };
  });

// ─── Log a re-engagement or note event ───────────────────────────────────────

export const logReengagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    id: string;
    notes?: string;
    position_id?: string;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
        notes: z.string().max(2000).optional(),
        position_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgEditor(context.supabase, context.userId, data.orgId);
    const now = new Date().toISOString();
    const { error: uErr } = await context.supabase
      .from("talent_memory")
      .update({ last_reengaged_at: now })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (uErr) throw new Error(uErr.message);
    await context.supabase.from("talent_memory_events").insert({
      talent_memory_id: data.id,
      organization_id: data.orgId,
      event_type: "reengaged",
      actor_user_id: context.userId,
      position_id: data.position_id ?? null,
      notes: data.notes ?? null,
      metadata: {},
    });
    return { ok: true };
  });

// ─── Resurface silver medalists for a position ───────────────────────────────

export const resurfaceForPosition = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string; limit?: number }) =>
    z
      .object({
        orgId: z.string().uuid(),
        positionId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: position, error: pErr } = await context.supabase
      .from("positions")
      .select("id, title, requirements, preferred_requirements, seniority, organization_id")
      .eq("id", data.positionId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!position || (position as AnyRow).organization_id !== data.orgId)
      throw new Error("Position not found");

    const reqSkills = toStringArray((position as AnyRow).requirements)
      .concat(toStringArray((position as AnyRow).preferred_requirements))
      .map(normalizeSkill)
      .filter(Boolean);
    const reqSet = new Set(reqSkills);

    const { data: memories, error: mErr } = await context.supabase
      .from("talent_memory")
      .select("*")
      .eq("organization_id", data.orgId)
      .eq("status", "active")
      .order("tagged_at", { ascending: false })
      .limit(200);
    if (mErr) throw new Error(mErr.message);

    const decorated = await decorateMemories(context.supabase, (memories as AnyRow[]) ?? []);
    // Exclude candidates already matched to this position.
    const { data: existing } = await context.supabase
      .from("candidate_matches")
      .select("candidate_profile_id")
      .eq("organization_id", data.orgId)
      .eq("position_id", data.positionId);
    const exclude = new Set(
      ((existing as AnyRow[]) ?? []).map((r) => r.candidate_profile_id),
    );

    const scored = decorated
      .filter((m) => !exclude.has(m.candidate_profile_id))
      .map((m) => {
        const skills = m.skills_snapshot.map(normalizeSkill).filter(Boolean);
        const overlap = skills.filter((s) => reqSet.has(s));
        const overlap_count = overlap.length;
        const match_score = reqSet.size
          ? Math.round((overlap_count / reqSet.size) * 100)
          : 0;
        const seniorityBoost =
          m.seniority_snapshot &&
          (position as AnyRow).seniority &&
          String(m.seniority_snapshot).toLowerCase() ===
            String((position as AnyRow).seniority).toLowerCase()
            ? 10
            : 0;
        return {
          memory: m,
          overlap_skills: overlap,
          overlap_count,
          match_score: Math.min(100, match_score + seniorityBoost),
        };
      })
      .filter((r) => r.overlap_count > 0 || r.memory.seniority_snapshot)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, data.limit ?? 8);

    return {
      position: { id: (position as AnyRow).id, title: (position as AnyRow).title },
      candidates: scored,
    };
  });

// ─── Log a resurface event when the UI reveals suggestions ───────────────────

export const noteResurface = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; id: string; position_id: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
        position_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgEditor(context.supabase, context.userId, data.orgId);
    await context.supabase
      .from("talent_memory")
      .update({ last_resurfaced_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    await context.supabase.from("talent_memory_events").insert({
      talent_memory_id: data.id,
      organization_id: data.orgId,
      event_type: "resurfaced",
      actor_user_id: context.userId,
      position_id: data.position_id,
      metadata: {},
    });
    return { ok: true };
  });

// ─── Check if a candidate is already tagged (for candidate detail UI) ───────

export const getMemoryByMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; matchId: string }) =>
    z.object({ orgId: z.string().uuid(), matchId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: match } = await context.supabase
      .from("candidate_matches")
      .select("candidate_profile_id, organization_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match || (match as AnyRow).organization_id !== data.orgId) return null;
    const { data: row } = await context.supabase
      .from("talent_memory")
      .select("*")
      .eq("organization_id", data.orgId)
      .eq("candidate_profile_id", (match as AnyRow).candidate_profile_id)
      .maybeSingle();
    if (!row) return null;
    const [decorated] = await decorateMemories(context.supabase, [row as AnyRow]);
    return decorated;
  });
