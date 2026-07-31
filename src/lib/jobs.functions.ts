// Public job board — reads via publishable-key client (anon RLS policies).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PublicPositionSummary = {
  id: string;
  title: string;
  location: string | null;
  work_model: "remote" | "hybrid" | "onsite" | null;
  employment_type:
    | "full_time"
    | "part_time"
    | "contract"
    | "temporary"
    | "internship"
    | null;
  seniority: string | null;
  organization_name: string;
  compensation_display: string | null;
  published_at: string | null;
  description_preview: string;
  openings: number;
};

// Completeness: description must be at least 40 chars, requirements array non-empty.
const MIN_DESC = 40;

function toReqStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((r) => {
      if (typeof r === "string") return r;
      if (r && typeof r === "object") {
        const o = r as { label?: unknown; text?: unknown; name?: unknown };
        const v = o.label ?? o.text ?? o.name;
        return typeof v === "string" ? v : null;
      }
      return null;
    })
    .filter((v): v is string => !!v && v.trim().length > 0);
}

export const listPublicPositions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPositionSummary[]> => {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("positions")
      .select(
        "id,title,location,work_model,employment_type,seniority,description,requirements,compensation,published_at,openings,organizations(name)",
      )
      .eq("status", "active")
      .eq("visibility", "public")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((p) => {
        const desc = (p.description ?? "").trim();
        const reqs = Array.isArray(p.requirements) ? (p.requirements as unknown[]) : [];
        return desc.length >= MIN_DESC && reqs.length > 0;
      })
      .map((p) => {
        const comp = (p.compensation ?? {}) as { approved?: boolean; display?: string };
        const desc = (p.description ?? "").trim();
        return {
          id: p.id,
          title: p.title,
          location: p.location,
          work_model: p.work_model,
          employment_type: p.employment_type,
          seniority: p.seniority,
          organization_name:
            (p.organizations as unknown as { name?: string } | null)?.name ?? "TaaSFlow client",
          compensation_display: comp.approved && comp.display ? comp.display : null,
          published_at: p.published_at,
          description_preview:
            desc.length > 220 ? desc.slice(0, 217).trimEnd() + "…" : desc,
          openings: (p as { openings?: number }).openings ?? 1,
        };
      });
  },
);

/**
 * Minimal, safe lookup for a role that is no longer open (paused, filled,
 * closed, archived) so the public page can say so instead of 404-ing.
 */
export const getPositionClosure = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: row, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("public_position_closure", {
      _id: data.id,
    });
    if (error) return null;
    if (!row) return null;
    const r = row as { id: string; title: string; status: string; organization_name: string };
    return r;
  });

export const getPublicPosition = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: pos, error } = await supabase
      .from("positions")
      .select(
        "id,title,department,location,work_model,employment_type,seniority,description,requirements,preferred_requirements,compensation,intake_context,published_at,openings,status,organizations(name,logo_url)",
      )
      .eq("id", data.id)
      .in("status", ["active", "paused"])
      .eq("visibility", "public")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pos) return null;

    const desc = (pos.description ?? "").trim();
    const reqs = toReqStrings(pos.requirements);
    if (desc.length < MIN_DESC || reqs.length === 0) return null;

    const { data: questions, error: qErr } = await supabase
      .from("screening_questions")
      .select("id,question,answer_type,required,options,display_order")
      .eq("position_id", data.id)
      .order("display_order", { ascending: true });
    if (qErr) throw new Error(qErr.message);

    const { data: locs } = await supabase
      .from("position_locations")
      .select("city,region,country,work_model,headcount,is_primary,display_order")
      .eq("position_id", data.id)
      .order("display_order", { ascending: true });

    const { data: employerRow } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("public_position_employer", { _id: data.id });
    const employer = (employerRow ?? null) as { name?: string; logo_url?: string | null } | null;

    const comp = (pos.compensation ?? {}) as { approved?: boolean; display?: string };
    const ctx = (pos as { intake_context?: Record<string, unknown> }).intake_context ?? {};
    const posting = (ctx.posting ?? {}) as Record<string, string>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const deadline = str(posting.application_deadline);
    const deadlinePassed = deadline ? new Date(`${deadline}T23:59:59`) < new Date() : false;
    const confidential = str(posting.confidentiality) === "confidential";

    return {
      id: pos.id,
      title: pos.title,
      department: pos.department,
      location: pos.location,
      work_model: pos.work_model,
      employment_type: pos.employment_type,
      seniority: pos.seniority,
      description: desc,
      requirements: reqs,
      preferred_requirements: toReqStrings(pos.preferred_requirements),
      compensation_display: comp.approved && comp.display ? comp.display : null,
      published_at: pos.published_at,
      openings: (pos as { openings?: number }).openings ?? 1,
      accepting_applications:
        (pos as { status?: string }).status === "active" && !deadlinePassed,
      company_intro: str(posting.company_intro),
      responsibilities: str((ctx as Record<string, unknown>).responsibilities),
      benefits: str(posting.benefits),
      languages: str(posting.languages),
      travel: str(posting.travel),
      work_authorization_note: str(posting.work_authorization_note),
      accessibility_note: str(posting.accessibility_note),
      eeo_statement: str(posting.eeo_statement),
      application_deadline: deadline || null,
      deadline_passed: deadlinePassed,
      confidential,
      locations: (locs ?? []).map((l) => ({
        city: l.city,
        region: l.region,
        country: l.country,
        work_model: l.work_model,
        headcount: l.headcount,
        is_primary: l.is_primary,
      })),
      organization_logo_url: (() => {
        if (confidential) return null;
        const raw =
          employer?.logo_url ??
          (pos.organizations as unknown as { logo_url?: string | null } | null)?.logo_url;
        const trimmed = typeof raw === "string" ? raw.trim() : "";
        return /^https:\/\//i.test(trimmed) ? trimmed : null;
      })(),
      organization_name: confidential
        ? "Confidential employer"
        : (employer?.name ??
          (pos.organizations as unknown as { name?: string } | null)?.name ??
          "TaaSFlow client"),
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        answer_type: q.answer_type,
        required: q.required,
        options: q.options as string[] | null,
      })),
    };
  });
