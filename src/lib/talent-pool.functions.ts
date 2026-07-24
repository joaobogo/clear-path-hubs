// Talent Pool + Rediscovery server functions.
// All reads/writes scoped to the caller's organization via RLS.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;
const sel = (s: string): string => s;

const GOOD_FOR_FUTURE_KEY = "good_for_future";

export type TalentPoolDTO = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  system_key: string | null;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type RediscoveryCandidateDTO = {
  candidate_profile_id: string;
  display_name: string;
  email_masked: string;
  headline: string | null;
  seniority: string | null;
  location: string | null;
  skills: string[];
  last_stage: string | null;
  last_role_title: string | null;
  last_position_id: string | null;
  last_activity_at: string;
  match_count: number;
  is_silver: boolean;
  silver_reason: string | null;
  is_good_for_future: boolean;
  pool_ids: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function assertOrgMember(supabase: AnyRow, userId: string, orgId: string) {
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (staff === true) return "staff";
  const { data } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
  return (data as AnyRow).role as string;
}

function assertEditor(role: string) {
  if (!["client_admin", "client_editor", "staff", "platform_admin", "operations"].includes(role)) {
    throw new Error("Read-only role");
  }
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
    return local || "Candidate";
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

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9+#. ]/g, "").replace(/\s+/g, " ").trim();
}

// ─── Ensure "Good for future" system pool exists ─────────────────────────────

async function ensureGoodForFuturePool(
  supabase: AnyRow,
  userId: string,
  orgId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("talent_pools")
    .select("id")
    .eq("organization_id", orgId)
    .eq("system_key", GOOD_FOR_FUTURE_KEY)
    .maybeSingle();
  if (existing) return (existing as AnyRow).id as string;
  const { data: created, error } = await supabase
    .from("talent_pools")
    .insert({
      organization_id: orgId,
      name: "Good for future",
      description: "Candidates worth revisiting on future roles.",
      is_system: true,
      system_key: GOOD_FOR_FUTURE_KEY,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (created as AnyRow).id as string;
}

// ─── List pools with member counts ───────────────────────────────────────────

export const listPools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgMember(context.supabase, context.userId, data.orgId);
    // Ensure system pool exists so it always shows up (safe to try; RLS will
    // allow only editors to insert — fallback silently for viewers).
    try {
      await ensureGoodForFuturePool(context.supabase, context.userId, data.orgId);
    } catch {
      /* viewer role — skip creation */
    }

    const { data: pools, error } = await context.supabase
      .from("talent_pools")
      .select(sel("id, organization_id, name, description, is_system, system_key, created_at, updated_at"))
      .eq("organization_id", data.orgId)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = ((pools as AnyRow[]) ?? []).map((p) => p.id as string);
    let counts = new Map<string, number>();
    if (ids.length) {
      const { data: members } = await context.supabase
        .from("talent_pool_members")
        .select("pool_id")
        .in("pool_id", ids);
      counts = new Map();
      for (const m of (members as AnyRow[]) ?? []) {
        counts.set(m.pool_id, (counts.get(m.pool_id) ?? 0) + 1);
      }
    }
    const out: TalentPoolDTO[] = ((pools as AnyRow[]) ?? []).map((p) => ({
      id: p.id,
      organization_id: p.organization_id,
      name: p.name,
      description: p.description,
      is_system: p.is_system,
      system_key: p.system_key,
      member_count: counts.get(p.id) ?? 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
    return { pools: out };
  });

// ─── Create / rename / delete pool ───────────────────────────────────────────

export const createPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; name: string; description?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const role = await assertOrgMember(context.supabase, context.userId, data.orgId);
    assertEditor(role);
    const { data: pool, error } = await context.supabase
      .from("talent_pools")
      .insert({
        organization_id: data.orgId,
        name: data.name.trim(),
        description: data.description ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (pool as AnyRow).id as string };
  });

export const updatePool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; id: string; name?: string; description?: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const role = await assertOrgMember(context.supabase, context.userId, data.orgId);
    assertEditor(role);
    const patch: AnyRow = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.description !== undefined) patch.description = data.description;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("talent_pools")
      .update(patch)
      .eq("id", data.id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; id: string }) =>
    z.object({ orgId: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const role = await assertOrgMember(context.supabase, context.userId, data.orgId);
    assertEditor(role);
    const { error } = await context.supabase
      .from("talent_pools")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.orgId)
      .eq("is_system", false); // RLS also enforces; belt & suspenders.
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Add / remove members ────────────────────────────────────────────────────

export const addToPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    poolId: string;
    candidate_profile_ids: string[];
    notes?: string;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        poolId: z.string().uuid(),
        candidate_profile_ids: z.array(z.string().uuid()).min(1).max(200),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const role = await assertOrgMember(context.supabase, context.userId, data.orgId);
    assertEditor(role);
    const rows = data.candidate_profile_ids.map((id) => ({
      pool_id: data.poolId,
      organization_id: data.orgId,
      candidate_profile_id: id,
      notes: data.notes ?? null,
      added_by: context.userId,
    }));
    const { error } = await context.supabase
      .from("talent_pool_members")
      .upsert(rows, { onConflict: "pool_id,candidate_profile_id" });
    if (error) throw new Error(error.message);
    return { ok: true, added: rows.length };
  });

export const removeFromPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; poolId: string; candidate_profile_id: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        poolId: z.string().uuid(),
        candidate_profile_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const role = await assertOrgMember(context.supabase, context.userId, data.orgId);
    assertEditor(role);
    const { error } = await context.supabase
      .from("talent_pool_members")
      .delete()
      .eq("pool_id", data.poolId)
      .eq("candidate_profile_id", data.candidate_profile_id)
      .eq("organization_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── "Good for future" toggle ───────────────────────────────────────────────

export const toggleGoodForFuture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    candidate_profile_id: string;
    on: boolean;
    notes?: string;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        candidate_profile_id: z.string().uuid(),
        on: z.boolean(),
        notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const role = await assertOrgMember(context.supabase, context.userId, data.orgId);
    assertEditor(role);
    const poolId = await ensureGoodForFuturePool(
      context.supabase,
      context.userId,
      data.orgId,
    );
    if (data.on) {
      const { error } = await context.supabase.from("talent_pool_members").upsert(
        {
          pool_id: poolId,
          organization_id: data.orgId,
          candidate_profile_id: data.candidate_profile_id,
          notes: data.notes ?? null,
          added_by: context.userId,
        },
        { onConflict: "pool_id,candidate_profile_id" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("talent_pool_members")
        .delete()
        .eq("pool_id", poolId)
        .eq("candidate_profile_id", data.candidate_profile_id)
        .eq("organization_id", data.orgId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ─── Rediscovery search ──────────────────────────────────────────────────────
// Search all past candidates in the org, filterable by skill, stage, role,
// geography, seniority, recency window, or pool membership.

export const searchRediscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    orgId: string;
    q?: string;
    skills?: string[];
    stage?: string;
    positionId?: string;
    geo?: string;
    seniority?: string;
    recencyDays?: number;
    poolId?: string;
    goodForFutureOnly?: boolean;
    silverOnly?: boolean;
    limit?: number;
  }) =>
    z
      .object({
        orgId: z.string().uuid(),
        q: z.string().optional(),
        skills: z.array(z.string()).max(20).optional(),
        stage: z.string().optional(),
        positionId: z.string().uuid().optional(),
        geo: z.string().optional(),
        seniority: z.string().optional(),
        recencyDays: z.number().int().min(1).max(3650).optional(),
        poolId: z.string().uuid().optional(),
        goodForFutureOnly: z.boolean().optional(),
        silverOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgMember(context.supabase, context.userId, data.orgId);
    const limit = data.limit ?? 100;

    // 1) Fetch candidate_matches in this org, optionally filtered by
    //    position/stage/recency. This anchors past-candidate history.
    let matchesQ = context.supabase
      .from("candidate_matches")
      .select(sel("id, candidate_profile_id, position_id, stage, delivered_at, created_at, updated_at"))
      .eq("organization_id", data.orgId)
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (data.positionId) matchesQ = matchesQ.eq("position_id", data.positionId);
    if (data.stage) matchesQ = matchesQ.eq("stage", data.stage as never);
    if (data.recencyDays) {
      const since = new Date(Date.now() - data.recencyDays * 86400_000).toISOString();
      matchesQ = matchesQ.gte("updated_at", since);
    }
    const { data: matches, error: mErr } = await matchesQ;
    if (mErr) throw new Error(mErr.message);
    const matchRows = (matches as AnyRow[]) ?? [];
    if (matchRows.length === 0) return { candidates: [], total: 0 };

    // Roll up per candidate: last activity + last stage + counts.
    const perCandidate = new Map<
      string,
      { last: AnyRow; count: number; last_activity_at: string }
    >();
    for (const m of matchRows) {
      const key = m.candidate_profile_id as string;
      const cur = perCandidate.get(key);
      const stamp = (m.updated_at ?? m.created_at) as string;
      if (!cur || stamp > cur.last_activity_at) {
        perCandidate.set(key, {
          last: m,
          count: (cur?.count ?? 0) + 1,
          last_activity_at: stamp,
        });
      } else {
        cur.count += 1;
      }
    }
    const cpIds = Array.from(perCandidate.keys());

    // 2) Fetch candidate profiles.
    const { data: profiles, error: pErr } = await context.supabase
      .from("candidate_profiles")
      .select(sel("id, full_name, email, headline, location, seniority, skills"))
      .in("id", cpIds);
    if (pErr) throw new Error(pErr.message);
    const profMap = new Map<string, AnyRow>();
    for (const p of (profiles as AnyRow[]) ?? []) profMap.set(p.id, p);

    // 3) Fetch position titles referenced.
    const positionIds = Array.from(
      new Set(matchRows.map((m) => m.position_id as string).filter(Boolean)),
    );
    const posTitleMap = new Map<string, string>();
    if (positionIds.length) {
      const { data: positions } = await context.supabase
        .from("positions")
        .select("id, title")
        .in("id", positionIds);
      for (const p of (positions as AnyRow[]) ?? []) posTitleMap.set(p.id, p.title);
    }

    // 4) Silver-medalist overlay.
    const { data: silvers } = await context.supabase
      .from("talent_memory")
      .select("candidate_profile_id, reason_category, status")
      .eq("organization_id", data.orgId)
      .in("candidate_profile_id", cpIds);
    const silverMap = new Map<string, string>();
    for (const s of (silvers as AnyRow[]) ?? []) {
      if ((s as AnyRow).status === "active") {
        silverMap.set((s as AnyRow).candidate_profile_id, (s as AnyRow).reason_category);
      }
    }

    // 5) Pool membership overlay.
    const { data: poolMembers } = await context.supabase
      .from("talent_pool_members")
      .select("pool_id, candidate_profile_id")
      .eq("organization_id", data.orgId)
      .in("candidate_profile_id", cpIds);
    const cpPools = new Map<string, string[]>();
    for (const pm of (poolMembers as AnyRow[]) ?? []) {
      const arr = cpPools.get(pm.candidate_profile_id) ?? [];
      arr.push(pm.pool_id);
      cpPools.set(pm.candidate_profile_id, arr);
    }
    const { data: gffPool } = await context.supabase
      .from("talent_pools")
      .select("id")
      .eq("organization_id", data.orgId)
      .eq("system_key", GOOD_FOR_FUTURE_KEY)
      .maybeSingle();
    const gffId = (gffPool as AnyRow)?.id as string | undefined;

    // Optional: restrict cpIds by pool.
    let allowed = new Set(cpIds);
    if (data.poolId) {
      const inPool = new Set(
        ((poolMembers as AnyRow[]) ?? [])
          .filter((pm) => pm.pool_id === data.poolId)
          .map((pm) => pm.candidate_profile_id as string),
      );
      allowed = new Set([...cpIds].filter((id) => inPool.has(id)));
    } else if (data.goodForFutureOnly && gffId) {
      const inGff = new Set(
        ((poolMembers as AnyRow[]) ?? [])
          .filter((pm) => pm.pool_id === gffId)
          .map((pm) => pm.candidate_profile_id as string),
      );
      allowed = new Set([...cpIds].filter((id) => inGff.has(id)));
    }
    if (data.silverOnly) {
      allowed = new Set([...allowed].filter((id) => silverMap.has(id)));
    }

    // 6) Build DTOs + apply text/skill/geo/seniority filters in-memory
    //    (small volumes; keeps SQL simple and RLS-safe).
    const skillFilter = (data.skills ?? []).map(norm).filter(Boolean);
    const geoFilter = data.geo?.trim().toLowerCase() ?? "";
    const sen = data.seniority?.trim().toLowerCase() ?? "";
    const term = data.q?.trim().toLowerCase() ?? "";

    const out: RediscoveryCandidateDTO[] = [];
    for (const id of allowed) {
      const roll = perCandidate.get(id);
      if (!roll) continue;
      const p = profMap.get(id) ?? {};
      const skills = toStringArray((p as AnyRow).skills);
      const skillsNorm = skills.map(norm);
      if (skillFilter.length && !skillFilter.every((s) => skillsNorm.includes(s))) continue;
      if (geoFilter && !String((p as AnyRow).location ?? "").toLowerCase().includes(geoFilter))
        continue;
      if (sen && String((p as AnyRow).seniority ?? "").toLowerCase() !== sen) continue;
      const dn = displayName(p);
      const headline = (p as AnyRow).headline ?? null;
      if (term) {
        const hay = [dn, headline ?? "", ...(skills ?? [])].join(" ").toLowerCase();
        if (!hay.includes(term)) continue;
      }
      const poolIds = cpPools.get(id) ?? [];
      out.push({
        candidate_profile_id: id,
        display_name: dn,
        email_masked: maskEmail((p as AnyRow).email),
        headline,
        seniority: (p as AnyRow).seniority ?? null,
        location: (p as AnyRow).location ?? null,
        skills,
        last_stage: (roll.last.stage as string) ?? null,
        last_role_title: posTitleMap.get(roll.last.position_id as string) ?? null,
        last_position_id: (roll.last.position_id as string) ?? null,
        last_activity_at: roll.last_activity_at,
        match_count: roll.count,
        is_silver: silverMap.has(id),
        silver_reason: silverMap.get(id) ?? null,
        is_good_for_future: gffId ? poolIds.includes(gffId) : false,
        pool_ids: poolIds,
      });
    }
    out.sort((a, b) => (a.last_activity_at < b.last_activity_at ? 1 : -1));
    return { candidates: out.slice(0, limit), total: out.length };
  });

// ─── Facet options (distinct seniorities, stages, positions, locations) ─────

export const getRediscoveryFacets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertOrgMember(context.supabase, context.userId, data.orgId);
    const [{ data: matches }, { data: profiles }, { data: positions }] = await Promise.all([
      context.supabase
        .from("candidate_matches")
        .select("stage")
        .eq("organization_id", data.orgId)
        .limit(5000),
      context.supabase
        .from("candidate_profiles")
        .select("seniority, location")
        .limit(5000),
      context.supabase
        .from("positions")
        .select("id, title")
        .eq("organization_id", data.orgId)
        .order("title", { ascending: true })
        .limit(500),
    ]);
    const stages = Array.from(
      new Set(((matches as AnyRow[]) ?? []).map((m) => m.stage).filter(Boolean)),
    ) as string[];
    const seniorities = Array.from(
      new Set(((profiles as AnyRow[]) ?? []).map((p) => p.seniority).filter(Boolean)),
    ) as string[];
    const locations = Array.from(
      new Set(((profiles as AnyRow[]) ?? []).map((p) => p.location).filter(Boolean)),
    ) as string[];
    return {
      stages: stages.sort(),
      seniorities: seniorities.sort(),
      locations: locations.sort().slice(0, 100),
      positions: ((positions as AnyRow[]) ?? []).map((p) => ({
        id: p.id as string,
        title: p.title as string,
      })),
    };
  });
