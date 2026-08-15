// Role-fit rediscovery: which already-screened candidates fit a new role.
// Everything returned is derived from real records — screening dates, prior
// stages, recorded skills. Nothing is invented or estimated.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { seniorityFromYears } from "@/lib/candidate-seniority";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export type RoleFitReason = {
  kind: "skill" | "seniority" | "location" | "progress" | "pool";
  label: string;
};

export type RoleFitCandidateDTO = {
  candidate_profile_id: string;
  display_name: string;
  headline: string | null;
  location: string | null;
  seniority: string | null;
  /** When this candidate was last screened for this workspace. */
  screened_at: string;
  screened_for_title: string | null;
  furthest_stage: string | null;
  matched_requirements: string[];
  reasons: RoleFitReason[];
  pool_names: string[];
  signal_count: number;
};

export type RoleFitResultDTO = {
  position: { id: string; title: string; location: string | null; seniority: string | null };
  candidates: RoleFitCandidateDTO[];
  summary: {
    library_size: number;
    fitting: number;
    already_interviewed: number;
    screenings_reused: number;
    oldest_screening_at: string | null;
  };
  requirements: string[];
};

const STAGE_RANK: Record<string, number> = {
  new: 0,
  reviewing: 1,
  delivered: 2,
  shortlisted: 3,
  interview_process: 4,
  offer: 5,
  hired: 6,
};

const STAGE_LABEL: Record<string, string> = {
  reviewing: "reviewed",
  delivered: "shown to you",
  shortlisted: "shortlisted",
  interview_process: "interviewed",
  offer: "offered",
  hired: "hired",
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
}

function labelsFrom(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((r) =>
      typeof r === "string" ? r : r && typeof r === "object" ? String((r as AnyRow).label ?? "") : "",
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

function toSkills(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? String((x as AnyRow).name ?? "") : ""))
    .map((s) => s.trim())
    .filter(Boolean);
}

function displayName(row: AnyRow): string {
  const full = row?.full_name ? String(row.full_name).trim() : "";
  if (full) return full;
  return "Candidate";
}

function locationMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const tokens = (s: string) => new Set(s.split(/[ ,]+/).filter((t) => t.length > 2));
  const ta = tokens(na);
  for (const t of tokens(nb)) if (ta.has(t)) return true;
  return false;
}

export const getRoleFitFromPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; positionId: string; limit?: number }) =>
    z
      .object({
        orgId: z.string().uuid(),
        positionId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<RoleFitResultDTO> => {
    const { supabase, userId } = context;

    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", data.orgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Forbidden");

    const { data: position, error: posErr } = await supabase
      .from("positions")
      .select("id, title, location, seniority, requirements, preferred_requirements")
      .eq("id", data.positionId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (posErr) throw new Error(posErr.message);
    if (!position) throw new Error("Role not found");
    const pos = position as AnyRow;

    const requirements = [
      ...labelsFrom(pos.requirements),
      ...labelsFrom(pos.preferred_requirements),
    ];
    const reqNorm = requirements.map((r) => ({ label: r, n: norm(r) })).filter((r) => r.n.length > 1);

    // Every candidate previously screened for this workspace.
    const { data: matchRows, error: mErr } = await supabase
      .from("candidate_matches")
      .select("candidate_profile_id, position_id, stage, created_at, delivered_at, updated_at")
      .eq("organization_id", data.orgId)
      .order("updated_at", { ascending: false })
      .limit(4000);
    if (mErr) throw new Error(mErr.message);
    const matches = (matchRows as AnyRow[]) ?? [];

    type Roll = {
      screened_at: string;
      screened_for: string | null;
      furthest: string | null;
      onThisRole: boolean;
    };
    const rolled = new Map<string, Roll>();
    for (const m of matches) {
      const key = m.candidate_profile_id as string;
      const stamp = (m.delivered_at ?? m.created_at) as string;
      const cur = rolled.get(key);
      if (!cur) {
        rolled.set(key, {
          screened_at: stamp,
          screened_for: m.position_id,
          furthest: m.stage,
          onThisRole: m.position_id === data.positionId,
        });
      } else {
        if (stamp < cur.screened_at) {
          cur.screened_at = stamp;
          cur.screened_for = m.position_id;
        }
        if ((STAGE_RANK[m.stage] ?? -1) > (STAGE_RANK[cur.furthest ?? ""] ?? -1)) cur.furthest = m.stage;
        if (m.position_id === data.positionId) cur.onThisRole = true;
      }
    }

    const libraryIds = Array.from(rolled.keys());
    const candidateIds = libraryIds.filter((id) => !rolled.get(id)!.onThisRole);
    if (candidateIds.length === 0) {
      return {
        position: { id: pos.id, title: pos.title, location: pos.location, seniority: pos.seniority },
        candidates: [],
        summary: {
          library_size: libraryIds.length,
          fitting: 0,
          already_interviewed: 0,
          screenings_reused: 0,
          oldest_screening_at: null,
        },
        requirements,
      };
    }

    const { data: profileRows } = await supabase
      .from("candidate_profiles")
      .select("id, full_name, headline, location, years_experience, skills")
      .in("id", candidateIds);
    const profiles = new Map<string, AnyRow>();
    for (const p of (profileRows as AnyRow[]) ?? []) profiles.set(p.id, p);

    const titleIds = Array.from(
      new Set(Array.from(rolled.values()).map((r) => r.screened_for).filter(Boolean) as string[]),
    );
    const titles = new Map<string, string>();
    if (titleIds.length) {
      const { data: posRows } = await supabase.from("positions").select("id, title").in("id", titleIds);
      for (const p of (posRows as AnyRow[]) ?? []) titles.set(p.id, p.title);
    }

    const { data: poolRows } = await supabase
      .from("talent_pool_members")
      .select("candidate_profile_id, talent_pools(name)")
      .eq("organization_id", data.orgId)
      .in("candidate_profile_id", candidateIds);
    const poolNames = new Map<string, string[]>();
    for (const r of (poolRows as AnyRow[]) ?? []) {
      const name = r.talent_pools?.name;
      if (!name) continue;
      const list = poolNames.get(r.candidate_profile_id) ?? [];
      list.push(name);
      poolNames.set(r.candidate_profile_id, list);
    }

    const out: RoleFitCandidateDTO[] = [];
    for (const id of candidateIds) {
      const p = profiles.get(id);
      if (!p) continue;
      const roll = rolled.get(id)!;
      const skills = toSkills(p.skills);
      const seniorityBand = seniorityFromYears(p.years_experience);
      const haystack = norm([...skills, p.headline ?? "", seniorityBand ?? ""].join(" "));

      const matchedRequirements = reqNorm
        .filter((r) => haystack.includes(r.n) || skills.some((s) => norm(s).includes(r.n)))
        .map((r) => r.label);

      const reasons: RoleFitReason[] = [];
      if (matchedRequirements.length) {
        reasons.push({
          kind: "skill",
          label: `Evidence for ${matchedRequirements.length} of ${reqNorm.length} requirement${reqNorm.length === 1 ? "" : "s"}: ${matchedRequirements.slice(0, 3).join(", ")}`,
        });
      }
      if (pos.seniority && seniorityBand && norm(pos.seniority) === norm(seniorityBand)) {
        reasons.push({ kind: "seniority", label: `Same seniority as the role (${seniorityBand})` });
      }
      if (locationMatch(pos.location, p.location)) {
        reasons.push({ kind: "location", label: `Already located in ${p.location}` });
      }
      const stageLabel = roll.furthest ? STAGE_LABEL[roll.furthest] : null;
      if (roll.furthest && (STAGE_RANK[roll.furthest] ?? 0) >= 3) {
        reasons.push({
          kind: "progress",
          label: `Previously ${stageLabel} for ${titles.get(roll.screened_for ?? "") ?? "another role"}`,
        });
      }
      const pools = poolNames.get(id) ?? [];
      if (pools.length) {
        reasons.push({ kind: "pool", label: `Saved in ${pools.join(", ")}` });
      }

      // Evidence-only: no reason, no card.
      if (!matchedRequirements.length && reasons.length === 0) continue;
      if (!matchedRequirements.length && !reasons.some((r) => r.kind === "progress" || r.kind === "pool"))
        continue;

      out.push({
        candidate_profile_id: id,
        display_name: displayName(p),
        headline: p.headline ?? null,
        location: p.location ?? null,
        seniority: seniorityBand,
        screened_at: roll.screened_at,
        screened_for_title: titles.get(roll.screened_for ?? "") ?? null,
        furthest_stage: stageLabel,
        matched_requirements: matchedRequirements,
        reasons,
        pool_names: pools,
        signal_count: matchedRequirements.length + reasons.length - (matchedRequirements.length ? 1 : 0),
      });
    }

    out.sort(
      (a, b) =>
        b.matched_requirements.length - a.matched_requirements.length ||
        b.signal_count - a.signal_count ||
        b.screened_at.localeCompare(a.screened_at),
    );

    const limited = out.slice(0, data.limit ?? 50);
    const oldest = out.reduce<string | null>(
      (min, c) => (!min || c.screened_at < min ? c.screened_at : min),
      null,
    );

    return {
      position: { id: pos.id, title: pos.title, location: pos.location, seniority: pos.seniority },
      candidates: limited,
      summary: {
        library_size: libraryIds.length,
        fitting: out.length,
        already_interviewed: out.filter((c) => c.furthest_stage === "interviewed" || c.furthest_stage === "offered")
          .length,
        screenings_reused: out.length,
        oldest_screening_at: oldest,
      },
      requirements,
    };
  });

export const listRoleFitPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("positions")
      .select("id, title, status, created_at")
      .eq("organization_id", data.orgId)
      .in("status", ["approved", "active", "under_review", "draft", "submitted", "paused"])
      .order("created_at", { ascending: false })
      .limit(100);
    return {
      positions: ((rows as AnyRow[]) ?? []).map((p) => ({ id: p.id, title: p.title, status: p.status })),
    };
  });
