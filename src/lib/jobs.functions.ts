// Public job board — reads via publishable-key client (anon RLS policies).
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { canonicalLocation } from "@/lib/jobs/location-format";
import type { Database } from "@/integrations/supabase/types";
import {
  buildPublicJobFacts,
  resolveCompensation,
  resolvePublicSalary,
} from "@/lib/jobs/public-facts";
import { EFFORT_DEFAULT, resolveApplyEffort } from "@/lib/jobs/apply-effort";
import { jobDescriptionSummary } from "@/lib/marketing/job-description";
import { QA_E2E_COOKIE, qaEndpointsEnabled } from "@/lib/public-api/qa-endpoint-gate";
import { publicOrgNameOr, hasInternalOrgMarker } from "@/lib/org/public-org-name";



/**
 * QA fixtures are flagged is_test_record and are invisible to the public board.
 * The E2E harness opts in by setting a `qa_e2e` cookie, which is only ever
 * honoured by the local dev server — in any deployed build the opt-in is dead
 * code, so a fixture can never be reachable by a real visitor.
 */
function testRecordsVisible(): boolean {
  if (!qaEndpointsEnabled()) return false;
  let cookie = "";
  try {
    cookie = getRequestHeader("cookie") ?? "";
  } catch {
    return false;
  }
  const match = new RegExp(`(?:^|;\\s*)${QA_E2E_COOKIE}=([^;]+)`).exec(cookie);
  if (!match) return false;
  const value = decodeURIComponent(match[1]);
  const expected = (process.env.QA_SEED_TOKEN ?? "").trim();
  return expected.length > 0 ? value === expected : value.length > 0;
}


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
  /** Always non-empty: the range, "Range shared on the first call", or "Not specified". */
  compensation_line: string;

  published_at: string | null;
  description_preview: string;
  openings: number;
  facts: { posted: string };
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

/**
 * The organization gate. A role whose owning organization is flagged
 * test/QA/demo is never publishable, whatever its own visibility and status
 * say — anon cannot read `organizations`, so the check runs through a definer
 * lookup that returns ids only. A failed lookup withholds every id: on this
 * path, silence is the safe answer.
 */
async function publishableIds(
  supabase: ReturnType<typeof publicClient>,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  if (testRecordsVisible()) return new Set(ids);
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )("public_publishable_position_ids", { _ids: ids });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown;
  const out = new Set<string>();
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (typeof r === "string") out.add(r);
      else if (r && typeof r === "object") {
        const v = (r as Record<string, unknown>)["public_publishable_position_ids"] ??
          (r as Record<string, unknown>)["id"];
        if (typeof v === "string") out.add(v);
      }
    }
  }
  return out;
}

export const listPublicPositions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPositionSummary[]> => {
    const supabase = publicClient();
    let query = supabase
      .from("positions")
      .select(
        "id,title,location,work_model,employment_type,seniority,description,requirements,compensation,compensation_visibility,published_at,openings",
      )
      .eq("status", "active")
      .eq("visibility", "public");
    // QA fixtures never appear on the real board.
    if (!testRecordsVisible()) query = query.or("is_test_record.is.null,is_test_record.eq.false");
    const { data: allRows, error } = await query
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const allowed = await publishableIds(supabase, (allRows ?? []).map((p) => p.id));
    const data = (allRows ?? []).filter((p) => allowed.has(p.id));

    // The public list uses the same location-country augmentation as the detail
    // page so "Curitiba, PR" becomes "Curitiba, PR, Brazil" without the UI
    // needing to know the structured location table.
    const { data: locationRows } = await supabase
      .from("position_locations")
      .select("position_id,city,region,country,country_code,is_primary,display_order")
      .in("position_id", (data ?? []).map((p) => p.id));
    const primaryLocationByPosition = new Map<string, { city?: string | null; country?: string | null; country_code?: string | null }>();
    for (const row of (locationRows ?? []) as { position_id: string; city?: string | null; country?: string | null; country_code?: string | null; is_primary?: boolean }[]) {
      const existing = primaryLocationByPosition.get(row.position_id);
      if (!existing || row.is_primary) {
        primaryLocationByPosition.set(row.position_id, row);
      }
    }

    // Employer identity comes from a definer lookup: anon has no read access to
    // organizations, and it must stay that way (the client list is private).
    const employerNames = new Map<string, string>();
    const ids = (data ?? []).map((p) => p.id);
    if (ids.length > 0) {
      const { data: employers } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>
      )("public_position_employers", { _ids: ids });
      for (const row of (employers ?? []) as { position_id: string; name: string | null }[]) {
        if (row?.position_id && row.name) employerNames.set(row.position_id, row.name);
      }
    }

    return (data ?? [])
      .filter((p) => {
        const desc = (p.description ?? "").trim();
        const reqs = Array.isArray(p.requirements) ? (p.requirements as unknown[]) : [];
        return desc.length >= 80 && reqs.length > 0;
      })
      // A demo/test workspace's role must never be public: the Northwind demo
      // job sat on the live board accepting real applications (audit #3,
      // finding 7). The internal marker on the RAW org name is the signal.
      .filter((p) => !hasInternalOrgMarker(employerNames.get(p.id)))
      .map((p) => {
        const comp = resolveCompensation(
          p.compensation,
          (p as { compensation_visibility?: string | null }).compensation_visibility,
        );
        const desc = (p.description ?? "").trim();
        return {
          id: p.id,
          title: p.title,
          location: canonicalLocation(p.location, primaryLocationByPosition.get(p.id)),
          work_model: p.work_model,
          employment_type: p.employment_type,
          seniority: p.seniority,
          organization_name: publicOrgNameOr(employerNames.get(p.id), "Hiring Organization"),
          compensation_display: comp.display,
          compensation_line: comp.line,

          published_at: p.published_at,
          // Markdown marks and headings never reach a card: the preview is the
          // first real sentence of prose.
          description_preview: jobDescriptionSummary(desc, 220),
          openings: (p as { openings?: number }).openings ?? 1,
          facts: { posted: buildPublicJobFacts({ ...p, employment_type: p.employment_type as any, published_at: p.published_at, description: desc }).posted },
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
    return { ...r, organization_name: publicOrgNameOr(r.organization_name, "Hiring Organization") };
  });

export const getPublicPosition = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    let detail = supabase
      .from("positions")
      .select(
        "id,title,department,location,work_model,employment_type,seniority,description,requirements,preferred_requirements,compensation,compensation_visibility,primary_timezone,timezone_overlap_hours,work_authorization,published_at,openings,status",
      )
      .eq("id", data.id)
      .in("status", ["active", "paused"])
      .eq("visibility", "public");
    if (!testRecordsVisible()) {
      detail = detail.or("is_test_record.is.null,is_test_record.eq.false");
    }
    const { data: pos, error } = await detail.maybeSingle();
    if (error) throw new Error(error.message);
    if (!pos) return null;

    // Organization-level gate: a test/QA/demo org's role is not public.
    const allowed = await publishableIds(supabase, [pos.id]);
    if (!allowed.has(pos.id)) return null;

    const desc = (pos.description ?? "").trim();
    const reqs = toReqStrings(pos.requirements);
    if (desc.length < 80 || reqs.length === 0) return null;

    const { data: questions, error: qErr } = await supabase
      .from("screening_questions")
      .select("id,question,answer_type,required,options,display_order,why_asked")
      .eq("position_id", data.id)
      .order("display_order", { ascending: true });
    if (qErr) throw new Error(qErr.message);

    const { data: locs } = await supabase
      .from("position_locations")
      .select("city,region,country,country_code,work_model,headcount,is_primary,display_order")
      .eq("position_id", data.id)
      .order("display_order", { ascending: true });

    const { data: employerRow } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("public_position_employer", { _id: data.id });
    const employer = (employerRow ?? null) as { name?: string; logo_url?: string | null } | null;

    // Same belt-and-braces as the board list: an org whose raw name carries an
    // internal marker ("(Demo)") is internal even when it was never flagged in
    // the database — its role's direct URL must 404 publicly (audit #3, #7).
    if (hasInternalOrgMarker(employer?.name)) return null;

    // Only the public `posting` subtree of intake_context is exposed, via a
    // definer lookup. anon has no column grant on intake_context itself, which
    // also carries internal hiring notes.
    const { data: postingRow } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>
    )("public_position_posting", { _id: data.id });
    const posting = ((postingRow ?? {}) as Record<string, unknown>) as Record<string, string>;
    const rawOnsiteDays = ((postingRow ?? {}) as Record<string, unknown>).onsite_days;
    const onsite_days = typeof rawOnsiteDays === "number" ? rawOnsiteDays : null;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const deadline = str(posting.application_deadline);
    const deadlinePassed = deadline ? new Date(`${deadline}T23:59:59`) < new Date() : false;
    const confidential = str(posting.confidentiality) === "confidential";
    const p = pos as Record<string, unknown>;
    const comp = resolveCompensation(
      pos.compensation,
      p.compensation_visibility as string | null,
    );
    // The primary location drives both the public fact line and the locale
    // used for placeholders (e.g. the phone input's country prefix).
    const primaryLoc = (locs ?? []).find((l) => l.is_primary) ?? (locs ?? [])[0];

    // The seven deciding facts are resolved server-side so the board card, the
    // detail page and the JSON-LD can never drift apart.
    const facts = buildPublicJobFacts({
      compensation: pos.compensation,
      compensation_visibility: p.compensation_visibility as string | null,
      work_model: pos.work_model,
      onsite_days: (posting as Record<string, unknown>).onsite_days,
      location: canonicalLocation(pos.location, primaryLoc),
      primary_timezone: p.primary_timezone as string | null,
      timezone_overlap_hours: p.timezone_overlap_hours,
      work_authorization: p.work_authorization,
      work_authorization_note: str(posting.work_authorization_note) || null,
      employment_type: pos.employment_type,
      published_at: pos.published_at,
      description: desc,
    });

    // How long applying really takes, from this posting's own completed
    // submissions. A failed read falls back to the platform default rather
    // than blocking the page or printing a broken figure.
    let applyEffort = EFFORT_DEFAULT;
    try {
      const { data: effortRow } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>
      )("public_application_effort", { _position_id: data.id });
      applyEffort = resolveApplyEffort(effortRow);
    } catch {
      applyEffort = EFFORT_DEFAULT;
    }



    return {
      id: pos.id,
      title: pos.title,
      department: pos.department,
      location: canonicalLocation(pos.location, primaryLoc),
      work_model: pos.work_model,
      employment_type: pos.employment_type,
      seniority: pos.seniority,
      description: desc,
      requirements: reqs,
      preferred_requirements: toReqStrings(pos.preferred_requirements),
      compensation_display: comp.display,
      compensation_public: resolvePublicSalary(
        pos.compensation,
        p.compensation_visibility as string | null,
      ),
      facts,
      apply_effort: applyEffort,
      onsite_days,
      country_code: (primaryLoc?.country_code ?? "").toUpperCase() || null,

      published_at: pos.published_at,
      openings: (pos as { openings?: number }).openings ?? 1,
      accepting_applications:
        (pos as { status?: string }).status === "active" && !deadlinePassed,
      company_intro: str(posting.company_intro),
      responsibilities: str(posting.responsibilities),
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
        const raw = employer?.logo_url ?? null;
        const trimmed = typeof raw === "string" ? raw.trim() : "";
        return /^https:\/\//i.test(trimmed) ? trimmed : null;
      })(),
      organization_name: confidential
        ? "Confidential employer"
        : publicOrgNameOr(employer?.name, "Hiring Organization"),
      questions: (questions ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        answer_type: q.answer_type,
        required: q.required,
        options: q.options as string[] | null,
        why_asked: (q.why_asked as string | null) ?? null,
      })),
    };
  });
