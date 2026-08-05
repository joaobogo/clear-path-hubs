import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
import { assertWorkspaceAccess } from "@/lib/authz/workspace-access";
  MIN_CLOSED_SEARCHES,
  isPublishable,
  sourced,
  type Provenance,
  type Sourced,
} from "@/lib/provenance";

/**
 * The data system, told honestly.
 *
 * Everything below reads real rows. Nothing is modelled, sampled up or
 * illustrated. When there is not enough held to answer, the answer is
 * "not enough yet" with the count that proves it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function assertStaff(supabase: Db, userId: string) {
  const { data } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (!data) throw new Error("Staff access required.");
}

async function assertOrgMember(supabase: Db, userId: string, orgId: string) {
  await assertWorkspaceAccess(supabase, userId, orgId);
}

function prov(
  computed_from: string,
  sources: string[],
  record_count: number,
  extra: Partial<Provenance> = {},
): Provenance {
  return {
    computed_from,
    sources,
    window_start: null,
    window_end: null,
    record_count,
    computed_at: new Date().toISOString(),
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Client-facing: the Data Advantage surface                           */
/* ------------------------------------------------------------------ */

export type DataAdvantage = {
  organization_id: string;
  joined_at: string | null;
  is_new_account: boolean;
  people: Sourced<number>;
  evidence_items: Sourced<number>;
  roles_benchmarked: Sourced<number>;
  signals_added: Sourced<number>;
  interactions: Sourced<number>;
  growth_this_month: {
    people: number;
    evidence_items: number;
    signals: number;
    since: string;
  };
};

const orgInput = z.object({ organization_id: z.string().uuid() });

export const getDataAdvantage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }): Promise<DataAdvantage> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertOrgMember(supabase, userId, data.organization_id);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const since = monthStart.toISOString();

    const { data: org } = await supabase
      .from("organizations")
      .select("created_at")
      .eq("id", data.organization_id)
      .maybeSingle();

    // People in this org's talent graph (distinct humans, not applications).
    const { data: edges } = await supabase
      .from("talent_graph_edges")
      .select("person_id, edge_kind, occurred_at, position_id")
      .eq("organization_id", data.organization_id)
      .limit(20000);

    const rows: Array<{
      person_id: string;
      edge_kind: string;
      occurred_at: string;
      position_id: string | null;
    }> = edges ?? [];

    const people = new Set(rows.map((r) => r.person_id));
    const peopleThisMonth = new Set(
      rows.filter((r) => r.occurred_at >= since).map((r) => r.person_id),
    );
    const interactions = rows.filter((r) => r.edge_kind === "interaction").length;

    const { count: evidenceCount } = await supabase
      .from("candidate_evidence_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id);

    const { count: evidenceThisMonth } = await supabase
      .from("candidate_evidence_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id)
      .gte("created_at", since);

    const { data: signalRows } = await supabase
      .from("search_signals")
      .select("position_id, created_at")
      .eq("organization_id", data.organization_id)
      .limit(20000);

    const signals: Array<{ position_id: string | null; created_at: string }> =
      signalRows ?? [];
    const benchmarkedRoles = new Set(
      signals.map((s) => s.position_id).filter(Boolean) as string[],
    );
    const signalsThisMonth = signals.filter((s) => s.created_at >= since).length;

    const joined = (org?.created_at as string | undefined) ?? null;

    return {
      organization_id: data.organization_id,
      joined_at: joined,
      is_new_account: people.size === 0 && (evidenceCount ?? 0) === 0,
      people: sourced(people.size, {
        computed_from:
          "Distinct people linked to your organisation in the talent graph. One row per human, not per application.",
        sources: ["talent_graph_edges", "talent_persons"],
        window_start: null,
        window_end: null,
        record_count: rows.length,
      }),
      evidence_items: sourced(evidenceCount ?? 0, {
        computed_from:
          "Evidence items extracted from CVs and reviewed against your role requirements.",
        sources: ["candidate_evidence_items"],
        window_start: null,
        window_end: null,
        record_count: evidenceCount ?? 0,
      }),
      roles_benchmarked: sourced(benchmarkedRoles.size, {
        computed_from:
          "Your roles that have closed and written structured signals back into the system.",
        sources: ["search_signals", "positions"],
        window_start: null,
        window_end: null,
        record_count: signals.length,
      }),
      signals_added: sourced(signals.length, {
        computed_from:
          "Structured signals written back from your closed searches: stage durations, drop-out points, accepted packages and requirement realism.",
        sources: ["search_signals"],
        window_start: null,
        window_end: null,
        record_count: signals.length,
      }),
      interactions: sourced(interactions, {
        computed_from:
          "Recorded interactions with people across channels: outreach touches and interviews.",
        sources: ["talent_graph_edges", "outreach_touches", "interviews"],
        window_start: null,
        window_end: null,
        record_count: interactions,
      }),
      growth_this_month: {
        people: peopleThisMonth.size,
        evidence_items: evidenceThisMonth ?? 0,
        signals: signalsThisMonth,
        since,
      },
    };
  });

/* ------------------------------------------------------------------ */
/* Market intelligence, gated on sample size                           */
/* ------------------------------------------------------------------ */

export type MarketRow = {
  role_family: string;
  region: string;
  signal_kind: string;
  signal_key: string;
  closed_searches: number;
  record_count: number;
  avg_value: number | null;
  median_value: number | null;
  currency: string | null;
  window_start: string | null;
  window_end: string | null;
  publishable: boolean;
};

export type MarketIntelligence = {
  min_closed_searches: number;
  rows: MarketRow[];
  withheld: number;
};

export const getMarketIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        role_family: z.string().optional(),
        region: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<MarketIntelligence> => {
    const { supabase } = context as { supabase: Db };
    let q = supabase.from("market_intelligence").select("*").limit(500);
    if (data.role_family) q = q.eq("role_family", data.role_family);
    if (data.region) q = q.eq("region", data.region);
    const { data: rows, error } = await q;
    if (error) throw error;

    const all: MarketRow[] = (rows ?? []).map((r: Db) => ({
      role_family: r.role_family,
      region: r.region,
      signal_kind: r.signal_kind,
      signal_key: r.signal_key,
      closed_searches: r.closed_searches ?? 0,
      record_count: r.record_count ?? 0,
      avg_value: r.avg_value === null ? null : Number(r.avg_value),
      median_value: r.median_value === null ? null : Number(r.median_value),
      currency: r.currency ?? null,
      window_start: r.window_start ?? null,
      window_end: r.window_end ?? null,
      publishable: isPublishable(r.closed_searches ?? 0),
    }));

    return {
      min_closed_searches: MIN_CLOSED_SEARCHES,
      rows: all.filter((r) => r.publishable),
      withheld: all.filter((r) => !r.publishable).length,
    };
  });

/* ------------------------------------------------------------------ */
/* Staff: Data Health console                                          */
/* ------------------------------------------------------------------ */

export type CoverageRow = {
  field: string;
  present: number;
  total: number;
  pct: number;
};

export type DataHealth = {
  generated_at: string;
  coverage: CoverageRow[];
  freshness: {
    newest_candidate: string | null;
    newest_evidence: string | null;
    newest_signal: string | null;
    stale_days: number | null;
  };
  duplicates: {
    merged_persons: number;
    persons: number;
    duplicate_rate: number;
  };
  extraction: {
    files_total: number;
    files_failed: number;
    failure_rate: number;
  };
  orphans: {
    matches_without_person: number;
    evidence_without_match: number;
    signals_without_position: number;
  };
  graph: {
    persons: number;
    edges: number;
    density: number;
    edges_by_kind: Record<string, number>;
  };
};

export const getDataHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DataHealth> => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertStaff(supabase, userId);

    const { data: profiles } = await supabase
      .from("candidate_profiles")
      .select(
        "id, email, phone, linkedin_url, location, headline, years_experience, current_cv_file_id, created_at",
      )
      .limit(20000);
    const cps: Db[] = profiles ?? [];
    const total = cps.length;

    const fields: Array<[string, (r: Db) => boolean]> = [
      ["Email", (r) => !!r.email],
      ["Phone", (r) => !!r.phone],
      ["LinkedIn", (r) => !!r.linkedin_url],
      ["Location", (r) => !!r.location],
      ["Headline", (r) => !!r.headline],
      ["Years of experience", (r) => r.years_experience != null],
      ["CV on file", (r) => !!r.current_cv_file_id],
    ];

    const coverage: CoverageRow[] = fields.map(([field, has]) => {
      const present = cps.filter(has).length;
      return {
        field,
        present,
        total,
        pct: total ? Math.round((present / total) * 1000) / 10 : 0,
      };
    });

    const { data: persons } = await supabase
      .from("talent_persons")
      .select("id, merged_into_id")
      .limit(50000);
    const personRows: Db[] = persons ?? [];
    const merged = personRows.filter((p) => p.merged_into_id).length;

    const { data: edgeRows } = await supabase
      .from("talent_graph_edges")
      .select("edge_kind, person_id")
      .limit(50000);
    const edges: Db[] = edgeRows ?? [];
    const byKind: Record<string, number> = {};
    for (const e of edges) byKind[e.edge_kind] = (byKind[e.edge_kind] ?? 0) + 1;

    const { data: files } = await supabase
      .from("files")
      .select("id, status")
      .limit(20000);
    const fileRows: Db[] = files ?? [];
    const failed = fileRows.filter((f) =>
      String(f.status ?? "").includes("fail"),
    ).length;

    const { data: newestEvidence } = await supabase
      .from("candidate_evidence_items")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    const { data: newestSignal } = await supabase
      .from("search_signals")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const newestCandidate = cps.length
      ? cps.map((c) => c.created_at as string).sort().at(-1) ?? null
      : null;

    const { count: matchesNoPerson } = await supabase
      .from("candidate_matches")
      .select("id", { count: "exact", head: true })
      .is("candidate_profile_id", null);
    const { count: evidenceNoMatch } = await supabase
      .from("candidate_evidence_items")
      .select("id", { count: "exact", head: true })
      .is("candidate_match_id", null);
    const { count: signalsNoPosition } = await supabase
      .from("search_signals")
      .select("id", { count: "exact", head: true })
      .is("position_id", null);

    const livePersons = personRows.length - merged;
    const stale = newestCandidate
      ? Math.floor(
          (Date.now() - new Date(newestCandidate).getTime()) / 86_400_000,
        )
      : null;

    return {
      generated_at: new Date().toISOString(),
      coverage,
      freshness: {
        newest_candidate: newestCandidate,
        newest_evidence: newestEvidence?.[0]?.created_at ?? null,
        newest_signal: newestSignal?.[0]?.created_at ?? null,
        stale_days: stale,
      },
      duplicates: {
        merged_persons: merged,
        persons: personRows.length,
        duplicate_rate: personRows.length
          ? Math.round((merged / personRows.length) * 1000) / 10
          : 0,
      },
      extraction: {
        files_total: fileRows.length,
        files_failed: failed,
        failure_rate: fileRows.length
          ? Math.round((failed / fileRows.length) * 1000) / 10
          : 0,
      },
      orphans: {
        matches_without_person: matchesNoPerson ?? 0,
        evidence_without_match: evidenceNoMatch ?? 0,
        signals_without_position: signalsNoPosition ?? 0,
      },
      graph: {
        persons: livePersons,
        edges: edges.length,
        density: livePersons
          ? Math.round((edges.length / livePersons) * 100) / 100
          : 0,
        edges_by_kind: byKind,
      },
    };
  });

/* ------------------------------------------------------------------ */
/* Staff: run the write-back on a closed search                        */
/* ------------------------------------------------------------------ */

export const runSearchWriteBack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ position_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: Db; userId: string };
    await assertStaff(supabase, userId);
    const { data: result, error } = await supabase.rpc(
      "write_back_closed_search",
      { _position_id: data.position_id },
    );
    if (error) throw error;
    return result as { ok: boolean; reason?: string };
  });

/* ------------------------------------------------------------------ */
/* Person-level graph read                                             */
/* ------------------------------------------------------------------ */

export type PersonGraph = {
  person_id: string | null;
  edges: Array<{
    edge_kind: string;
    occurred_at: string;
    position_id: string | null;
    source_table: string;
    payload: Record<string, string | number | boolean | null>;
  }>;
  provenance: Provenance;
};

export const getPersonGraph = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ candidate_profile_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PersonGraph> => {
    const { supabase } = context as { supabase: Db };
    const { data: personId } = await supabase.rpc(
      "person_for_candidate_profile",
      { _cp: data.candidate_profile_id },
    );
    if (!personId) {
      return {
        person_id: null,
        edges: [],
        provenance: prov(
          "No person record resolved for this candidate profile yet.",
          ["talent_persons"],
          0,
        ),
      };
    }
    const { data: rows } = await supabase
      .from("talent_graph_edges")
      .select("edge_kind, occurred_at, position_id, source_table, payload")
      .eq("person_id", personId)
      .order("occurred_at", { ascending: false })
      .limit(500);

    return {
      person_id: personId as string,
      edges: rows ?? [],
      provenance: prov(
        "Every role this person was seen for, evidence extracted, interaction recorded and outcome reached, resolved to one human identity.",
        ["talent_graph_edges"],
        (rows ?? []).length,
      ),
    };
  });
