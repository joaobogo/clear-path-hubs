import { roleFailsProtectedCheck } from "@/lib/jobs/protected-content";
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
import { applyEffortDefault, resolveApplyEffort } from "@/lib/jobs/apply-effort";
import { STRUCTURED_CONSENT_TEXT } from "@/lib/screening/structured";
import { pilotPreviewAllowed } from "@/lib/screening/pilot-preview.server";
import { travelText } from "@/lib/requisition-schema";
import {
  arrangementLabel,
  employerLabelForTitle,
  responseTimesHidden,
  wordingText,
} from "@/lib/jobs/public-wording";
import { jobDescriptionSummary } from "@/lib/marketing/job-description";
import { QA_E2E_COOKIE, qaEndpointsEnabled } from "@/lib/public-api/qa-endpoint-gate";
import { publicOrgNameOr, hasInternalOrgMarker } from "@/lib/org/public-org-name";
import { CONFIDENTIAL_EMPLOYER_NAME, isConfidentialPosting } from "@/lib/org/candidate-facing-employer";
import { normalizeVideoPrompt } from "@/lib/jobs/video-prompt";



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
  /**
   * The tag a card shows for how the work is arranged: the role's own
   * statement in short ("Field-based in London") when it set one, else null
   * and the card falls back to the work model. `false` means the role states
   * its arrangement in a sentence too long for a tag, so no tag is shown.
   */
  work_arrangement_label: string | false | null;
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

type PostingWording = {
  headline: string;
  work_arrangement: string;
  location_line: string;
  /** Set only for a confidential posting. */
  employer_label: string;
  response_times: string;
};

/**
 * The role's own wording for its public page (see public-wording.ts). anon
 * has no grant on intake_context, so these are read server-side as single
 * JSON paths, for roles that have already passed every public gate; nothing
 * else of intake_context is fetched. A failed read returns nothing, and each
 * page falls back to its derived lines.
 */
async function readPostingWording(ids: string[]): Promise<Map<string, PostingWording>> {
  const out = new Map<string, PostingWording>();
  if (ids.length === 0) return out;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("positions")
      .select(
        "id," +
          "headline:intake_context->posting->>headline," +
          "work_arrangement:intake_context->posting->>work_arrangement," +
          "location_line:intake_context->posting->>location_line," +
          "employer_label:intake_context->posting->>employer_label," +
          "response_times:intake_context->posting->>response_times," +
          "confidentiality:intake_context->posting->>confidentiality",
      )
      .in("id", ids);
    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      if (typeof row?.id !== "string") continue;
      out.set(row.id, {
        headline: wordingText(row.headline),
        work_arrangement: wordingText(row.work_arrangement),
        location_line: wordingText(row.location_line),
        employer_label: isConfidentialPosting(row.confidentiality)
          ? wordingText(row.employer_label)
          : "",
        response_times: wordingText(row.response_times),
      });
    }
  } catch {
    out.clear();
  }
  return out;
}

export const listPublicPositions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPositionSummary[]> => {
    const supabase = publicClient();
    let query = supabase
      .from("positions")
      .select(
        "id,title,location,work_model,employment_type,seniority,description,requirements,preferred_requirements,compensation,compensation_visibility,published_at,openings",
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
    // B1: a role whose text screens on a protected attribute is never syndicated.
    const data = (allRows ?? []).filter((p) => allowed.has(p.id) && !roleFailsProtectedCheck(p));

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

    const wording = await readPostingWording(ids);

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
        const own = wording.get(p.id);
        return {
          id: p.id,
          title: p.title,
          location: canonicalLocation(p.location, primaryLocationByPosition.get(p.id)),
          work_model: p.work_model,
          employment_type: p.employment_type,
          seniority: p.seniority,
          organization_name:
            own?.employer_label ||
            publicOrgNameOr(employerNames.get(p.id), "Hiring Organization"),
          work_arrangement_label: own?.work_arrangement
            ? arrangementLabel(own.work_arrangement) || false
            : null,
          compensation_display: comp.display,
          compensation_line: comp.line,

          published_at: p.published_at,
          // Markdown marks and headings never reach a card: the preview is the
          // first real sentence of prose.
          description_preview: own?.headline || jobDescriptionSummary(desc, 220),
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
    // EXECUTE on public_position_closure is granted to service_role only
    // (anon was revoked deliberately), so run it server-side. The function
    // itself returns only public-safe fields for non-active public roles.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabase = supabaseAdmin;
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
    const previewAllowed = await pilotPreviewAllowed(data.id);
    if (!testRecordsVisible() && !previewAllowed) {
      detail = detail.or("is_test_record.is.null,is_test_record.eq.false");
    }
    const { data: pos, error } = await detail.maybeSingle();
    if (error) throw new Error(error.message);
    if (!pos) return null;

    // Organization-level gate: a test/QA/demo org's role is not public.
    if (!previewAllowed) {
      const allowed = await publishableIds(supabase, [pos.id]);
      if (!allowed.has(pos.id)) return null;
    }

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
    const confidential = isConfidentialPosting(posting.confidentiality);
    const p = pos as Record<string, unknown>;
    const comp = resolveCompensation(
      pos.compensation,
      p.compensation_visibility as string | null,
    );
    // The primary location drives both the public fact line and the locale
    // used for placeholders (e.g. the phone input's country prefix).
    const primaryLoc = (locs ?? []).find((l) => l.is_primary) ?? (locs ?? [])[0];

    // The role's own wording for this page; each is empty when not set.
    const own = (await readPostingWording([pos.id])).get(pos.id);
    const headline = own?.headline ?? "";
    const ownArrangement = own?.work_arrangement ?? "";
    const employerLabel = confidential ? (own?.employer_label ?? "") : "";

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
      work_arrangement_statement: ownArrangement || null,
      location_line: own?.location_line || null,
    });

    // How long applying takes: this posting's own completed submissions once
    // there are enough of them, and until then (or on a failed read) the
    // estimate for this form's questions.
    // Structured screening pilot: the job's own short questions replace the
    // standard ones on the form while its switch is on (screening/structured.ts).
    const { loadStructuredScreening } = await import("@/lib/screening/structured.server");
    const structured = await loadStructuredScreening(data.id);
    // One-line answers are quick: a pilot job's form is quoted at the default.
    const effortDefault = applyEffortDefault(structured.enabled ? [] : (questions ?? []));
    let applyEffort = effortDefault;
    // The measured median comes from the standard form; a pilot job keeps the
    // estimate for its own form until it has completions of its own.
    if (!structured.enabled) try {
      const { data: effortRow } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>
      )("public_application_effort", { _position_id: data.id });
      applyEffort = resolveApplyEffort(effortRow, effortDefault);
    } catch {
      applyEffort = effortDefault;
    }

    // The hiring team's optional intro-video question. anon has no grant on
    // intake_context and the public_position_posting whitelist does not carry
    // this key, so it is read here, server-side and only after every public
    // gate above has passed, as one JSON path: nothing else of intake_context
    // is fetched or returned. A failed read means no prompt, never a broken page.
    let videoPrompt: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: promptRow } = await supabaseAdmin
        .from("positions")
        .select("video_prompt:intake_context->posting->>video_prompt")
        .eq("id", pos.id)
        .maybeSingle();
      videoPrompt = normalizeVideoPrompt(
        (promptRow as { video_prompt?: unknown } | null)?.video_prompt,
      );
    } catch {
      videoPrompt = null;
    }

    return {
      // B1: never syndicated (JSON-LD, boards) while any role text fails the detector.
      syndicate: !roleFailsProtectedCheck({ ...pos, screening_questions: questions ?? [] }),
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
      travel: travelText(posting.travel),
      work_authorization_note: str(posting.work_authorization_note),
      accessibility_note: str(posting.accessibility_note),
      eeo_statement: str(posting.eeo_statement),
      /** Optional question the hiring team would like the intro video to answer. */
      video_prompt: videoPrompt,
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
        ? employerLabel || CONFIDENTIAL_EMPLOYER_NAME
        : publicOrgNameOr(employer?.name, "Hiring Organization"),
      /** The employer as a page title or link preview names it. */
      organization_title_name: confidential
        ? employerLabelForTitle(employerLabel) || CONFIDENTIAL_EMPLOYER_NAME
        : publicOrgNameOr(employer?.name, "Hiring Organization"),
      /** The role's first line, shown under the title; empty when not set. */
      headline,
      /** The role's own work-arrangement statement; null when not set. */
      work_arrangement_statement: ownArrangement || null,
      /** See PublicPositionSummary.work_arrangement_label. */
      work_arrangement_label: ownArrangement
        ? arrangementLabel(ownArrangement) || (false as const)
        : null,
      /** True when the role leaves response-time promises off its page. */
      hide_response_times: responseTimesHidden(own?.response_times),
      // A pilot job asks its structured questions instead: the standard list
      // is empty on the form while the switch is on.
      questions: structured.enabled
        ? []
        : (questions ?? []).map((q) => ({
            id: q.id,
            question: q.question,
            answer_type: q.answer_type,
            required: q.required,
            options: q.options as string[] | null,
            why_asked: (q.why_asked as string | null) ?? null,
          })),
      /** Structured screening pilot; null on every other job. Pass rules stay on the server. */
      structured_screening: structured.enabled
        ? {
            consent_text: STRUCTURED_CONSENT_TEXT,
            questions: structured.questions.map((q) => ({
              key: q.key,
              label: q.label,
              type: q.type,
              options: q.options,
              required: q.required,
              section: q.section,
              sort_order: q.sort_order,
              help: q.help,
              unit: q.unit,
              show_when: q.show_when,
            })),
          }
        : null,
    };
  });
