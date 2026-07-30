// Client AI Assistant — grounded tool implementations.
// Every function runs against the caller's Supabase client (RLS-scoped to the
// signed-in user), so we can never leak rows the user is not entitled to.
//
// Each tool returns a plain JSON-serializable payload plus a `citations`
// array — the assistant is instructed to render those as inline citations
// so every claim traces back to a real record.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = any;

export interface Citation {
  kind: "match" | "position" | "candidate" | "application" | "score_run" | "hire";
  id: string;
  label: string;
  href?: string;
}

interface ToolResult {
  data: unknown;
  citations: Citation[];
  note?: string;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ─── weekly_pipeline_changes ────────────────────────────────────────────────
export async function weeklyPipelineChanges(
  supabase: Sb,
  orgId: string,
): Promise<ToolResult> {
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const citations: Citation[] = [];

  const [newApps, newMatches, newHires, updatedPositions] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, applied_at, candidate_profile_id, position_id, positions!inner(title, organization_id), candidate_profiles(full_name)",
      )
      .gte("applied_at", since)
      .eq("positions.organization_id", orgId)
      .order("applied_at", { ascending: false })
      .limit(25),
    supabase
      .from("candidate_matches")
      .select(
        "id, stage, admin_status, client_visibility, updated_at, position_id, candidate_profile_id, positions(title), candidate_profiles(full_name)",
      )
      .eq("organization_id", orgId)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("hire_records")
      .select(
        "id, status, hired_at, updated_at, candidate_match_id, position_id, positions(title), candidate_profiles(full_name)",
      )
      .eq("organization_id", orgId)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("positions")
      .select("id, title, status, updated_at")
      .eq("organization_id", orgId)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(15),
  ]);

  const apps = (newApps.data ?? []).map((r: any) => {
    citations.push({
      kind: "application",
      id: r.id,
      label: `${r.candidate_profiles?.full_name ?? "Candidate"} · ${r.positions?.title ?? "role"}`,
    });
    return {
      application_id: r.id,
      candidate_name: r.candidate_profiles?.full_name,
      position_title: r.positions?.title,
      position_id: r.position_id,
      applied_at: r.applied_at,
    };
  });

  const matches = (newMatches.data ?? []).map((r: any) => {
    citations.push({
      kind: "match",
      id: r.id,
      label: `${r.candidate_profiles?.full_name ?? "Match"} — ${r.stage}`,
      href: `/client/candidates/${r.id}`,
    });
    return {
      match_id: r.id,
      stage: r.stage,
      admin_status: r.admin_status,
      visibility: r.client_visibility,
      candidate_name: r.candidate_profiles?.full_name,
      position_title: r.positions?.title,
      position_id: r.position_id,
      updated_at: r.updated_at,
    };
  });

  const hires = (newHires.data ?? []).map((r: any) => {
    citations.push({
      kind: "hire",
      id: r.id,
      label: `${r.candidate_profiles?.full_name ?? "Hire"} — ${r.status}`,
      href: `/client/offers`,
    });
    return {
      hire_id: r.id,
      status: r.status,
      candidate_name: r.candidate_profiles?.full_name,
      position_title: r.positions?.title,
      hired_at: r.hired_at,
      updated_at: r.updated_at,
    };
  });

  const positions = (updatedPositions.data ?? []).map((r: any) => {
    citations.push({
      kind: "position",
      id: r.id,
      label: `${r.title} — ${r.status}`,
      href: `/client/positions/${r.id}`,
    });
    return {
      position_id: r.id,
      title: r.title,
      status: r.status,
      updated_at: r.updated_at,
    };
  });

  return {
    data: {
      window: "last 7 days",
      new_applications: apps,
      match_activity: matches,
      hire_activity: hires,
      position_activity: positions,
      totals: {
        applications: apps.length,
        match_events: matches.length,
        hire_events: hires.length,
        position_events: positions.length,
      },
    },
    citations,
  };
}

// ─── matches_needing_review ─────────────────────────────────────────────────
export async function matchesNeedingReview(
  supabase: Sb,
  orgId: string,
): Promise<ToolResult> {
  const citations: Citation[] = [];
  const { data } = await supabase
    .from("candidate_matches")
    .select(
      "id, stage, admin_status, client_visibility, updated_at, position_id, positions(title), candidate_profiles(full_name)",
    )
    .eq("organization_id", orgId)
    .in("stage", ["new", "screening", "shortlist", "interview", "offer"])
    .order("updated_at", { ascending: false })
    .limit(50);

  const items = (data ?? []).map((r: any) => {
    let reason: string | null = null;
    if (r.admin_status === "pending" && r.client_visibility !== "visible") {
      reason = "In system validation — not yet visible in your workspace";
    } else if (r.client_visibility === "visible" && r.stage === "new") {
      reason = "Ready for you to review and move to screening";
    } else if (r.stage === "shortlist") {
      reason = "On shortlist — schedule interview or advance";
    } else if (r.stage === "interview") {
      reason = "Interview stage — record outcome";
    } else if (r.stage === "offer") {
      reason = "Offer open — capture decision";
    }
    if (!reason) return null;
    citations.push({
      kind: "match",
      id: r.id,
      label: `${r.candidate_profiles?.full_name ?? "Match"} — ${r.positions?.title ?? ""}`,
      href: `/client/candidates/${r.id}`,
    });
    return {
      match_id: r.id,
      stage: r.stage,
      admin_status: r.admin_status,
      visibility: r.client_visibility,
      reason,
      candidate_name: r.candidate_profiles?.full_name,
      position_title: r.positions?.title,
      updated_at: r.updated_at,
    };
  }).filter(Boolean);

  return { data: { pending_reviews: items, count: items.length }, citations };
}

// ─── find_candidates_for_requirement ───────────────────────────────────────
export async function findCandidatesForRequirement(
  supabase: Sb,
  orgId: string,
  query: string,
  positionId: string | null,
): Promise<ToolResult> {
  const citations: Citation[] = [];
  const needle = query.trim().toLowerCase();
  if (!needle) return { data: { matches: [] }, citations, note: "empty_query" };

  // Pull visible matches for the org (RLS ensures scoping).
  const q = supabase
    .from("candidate_matches")
    .select(
      "id, stage, position_id, current_score_run_id, approved_score_run_id, positions(title, requirements), candidate_profiles(full_name, headline, skills, experience)",
    )
    .eq("organization_id", orgId)
    .limit(200);
  if (positionId) q.eq("position_id", positionId);

  const { data } = await q;
  const scored = (data ?? [])
    .map((r: any) => {
      const cp = r.candidate_profiles ?? {};
      const hay = [
        cp.headline ?? "",
        Array.isArray(cp.skills) ? cp.skills.map((s: any) => (typeof s === "string" ? s : s?.name ?? "")).join(" ") : "",
        Array.isArray(cp.experience)
          ? cp.experience
              .map((e: any) => `${e?.title ?? ""} ${e?.company ?? ""} ${e?.summary ?? ""}`)
              .join(" ")
          : "",
      ]
        .join(" ")
        .toLowerCase();
      const hit = hay.includes(needle);
      // very lightweight relevance: substring hits + exact skill match
      const skillMatch = Array.isArray(cp.skills)
        ? cp.skills.some(
            (s: any) => (typeof s === "string" ? s : s?.name ?? "").toLowerCase() === needle,
          )
        : false;
      return { row: r, cp, hit, skillMatch };
    })
    .filter((x: any) => x.hit)
    .sort((a: any, b: any) => Number(b.skillMatch) - Number(a.skillMatch))
    .slice(0, 12);

  const results = scored.map(({ row, cp, skillMatch }: any) => {
    citations.push({
      kind: "match",
      id: row.id,
      label: `${cp.full_name ?? "Candidate"} — ${row.positions?.title ?? ""}`,
      href: `/client/candidates/${row.id}`,
    });
    return {
      match_id: row.id,
      candidate_name: cp.full_name,
      headline: cp.headline,
      position_title: row.positions?.title,
      position_id: row.position_id,
      stage: row.stage,
      skill_exact_match: skillMatch,
      matched_query: query,
    };
  });

  return {
    data: { query, position_id: positionId, matches: results, total_scanned: (data ?? []).length },
    citations,
  };
}

// ─── explain_candidate_score ────────────────────────────────────────────────
export async function explainCandidateScore(
  supabase: Sb,
  orgId: string,
  matchId: string,
): Promise<ToolResult> {
  const { data: match } = await supabase
    .from("candidate_matches")
    .select(
      "id, stage, position_id, approved_score_run_id, current_score_run_id, positions(title), candidate_profiles(full_name, headline)",
    )
    .eq("organization_id", orgId)
    .eq("id", matchId)
    .maybeSingle();
  if (!match) {
    return { data: { error: "match_not_found_or_not_accessible" }, citations: [] };
  }
  const runId = match.approved_score_run_id ?? match.current_score_run_id;
  if (!runId) {
    return {
      data: {
        match_id: matchId,
        candidate_name: (match as any).candidate_profiles?.full_name,
        position_title: (match as any).positions?.title,
        note: "no_score_run_yet",
      },
      citations: [
        { kind: "match", id: match.id, label: `${(match as any).candidate_profiles?.full_name} — ${(match as any).positions?.title}`, href: `/client/candidates/${match.id}` },
      ],
    };
  }
  const { data: run } = await supabase
    .from("score_runs")
    .select(
      "id, score, confidence, fit_label, must_have_coverage, preferred_coverage, evidence, requirement_coverage, explanation, contradiction_status, completed_at",
    )
    .eq("id", runId)
    .maybeSingle();

  const citations: Citation[] = [
    {
      kind: "match",
      id: match.id,
      label: `${(match as any).candidate_profiles?.full_name} — ${(match as any).positions?.title}`,
      href: `/client/candidates/${match.id}`,
    },
  ];
  if (run) {
    citations.push({ kind: "score_run", id: run.id, label: `Score run ${run.fit_label ?? run.score ?? ""}` });
  }

  return {
    data: {
      match_id: match.id,
      candidate_name: (match as any).candidate_profiles?.full_name,
      position_title: (match as any).positions?.title,
      score_run: run ?? null,
    },
    citations,
  };
}

// ─── role_blockers ──────────────────────────────────────────────────────────
export async function roleBlockers(
  supabase: Sb,
  orgId: string,
  positionId: string | null,
): Promise<ToolResult> {
  const citations: Citation[] = [];

  const posQ = supabase
    .from("positions")
    .select("id, title, status, updated_at, requirements, published_at")
    .eq("organization_id", orgId)
    .neq("status", "archived");
  if (positionId) posQ.eq("id", positionId);
  const { data: positions } = await posQ;

  const posIds = (positions ?? []).map((p: any) => p.id);
  const { data: matches } = posIds.length
    ? await supabase
        .from("candidate_matches")
        .select("id, position_id, processing_state, processing_error_code, stage, admin_status, client_visibility")
        .in("position_id", posIds)
    : { data: [] };

  const results = (positions ?? []).map((p: any) => {
    const rows = (matches ?? []).filter((m: any) => m.position_id === p.id);
    const blockers: string[] = [];
    const stalled = rows.filter((r: any) =>
      ["cv_unreadable", "hydration_failed", "insights_failed", "scoring_failed"].includes(
        r.processing_error_code ?? "",
      ),
    );
    const pendingAdmin = rows.filter(
      (r: any) => r.admin_status === "pending" && r.client_visibility !== "visible",
    );
    const noApps = rows.length === 0;
    const noReqs = !Array.isArray(p.requirements) || p.requirements.length === 0;
    const notPublished = !p.published_at && p.status !== "active";

    if (noReqs) blockers.push("Requirements list is empty");
    if (notPublished) blockers.push("Position is not published/active yet");
    if (noApps) blockers.push("No applications received yet");
    if (stalled.length) blockers.push(`${stalled.length} candidate(s) awaiting data refresh`);
    if (pendingAdmin.length)
      blockers.push(`${pendingAdmin.length} candidate(s) in system validation`);

    citations.push({
      kind: "position",
      id: p.id,
      label: p.title,
      href: `/client/positions/${p.id}`,
    });
    for (const s of stalled.slice(0, 3)) {
      citations.push({
        kind: "match",
        id: s.id,
        label: `Stalled: ${s.processing_error_code}`,
        href: `/client/candidates/${s.id}`,
      });
    }

    return {
      position_id: p.id,
      title: p.title,
      status: p.status,
      applications: rows.length,
      stalled_processing: stalled.length,
      pending_admin_review: pendingAdmin.length,
      blockers,
    };
  });

  return { data: { roles: results }, citations };
}

// ─── next_actions ───────────────────────────────────────────────────────────
export async function nextActions(
  supabase: Sb,
  orgId: string,
): Promise<ToolResult> {
  const citations: Citation[] = [];

  const [visibleNew, shortlisted, interviewing, openOffers, stalled] = await Promise.all([
    supabase
      .from("candidate_matches")
      .select("id, updated_at, positions(title), candidate_profiles(full_name)")
      .eq("organization_id", orgId)
      .eq("client_visibility", "visible")
      .eq("stage", "new")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("candidate_matches")
      .select("id, updated_at, positions(title), candidate_profiles(full_name)")
      .eq("organization_id", orgId)
      .eq("stage", "shortlist")
      .order("updated_at", { ascending: true })
      .limit(10),
    supabase
      .from("candidate_matches")
      .select("id, updated_at, positions(title), candidate_profiles(full_name)")
      .eq("organization_id", orgId)
      .eq("stage", "interview")
      .order("updated_at", { ascending: true })
      .limit(10),
    supabase
      .from("hire_records")
      .select("id, status, updated_at, positions(title), candidate_profiles(full_name)")
      .eq("organization_id", orgId)
      .in("status", ["offer_drafted", "offer_sent", "offer_negotiating", "offer_accepted"])
      .order("updated_at", { ascending: true })
      .limit(10),
    supabase
      .from("candidate_matches")
      .select("id, processing_error_code, positions(title), candidate_profiles(full_name)")
      .eq("organization_id", orgId)
      .in("processing_error_code", [
        "cv_unreadable",
        "hydration_failed",
        "insights_failed",
        "scoring_failed",
      ])
      .limit(10),
  ]);

  const push = (arr: any[] | null, kind: "match" | "hire", tag: string, href: (id: string) => string) =>
    (arr ?? []).map((r: any) => {
      citations.push({
        kind,
        id: r.id,
        label: `${r.candidate_profiles?.full_name ?? tag} — ${r.positions?.title ?? ""}`,
        href: href(r.id),
      });
      return {
        id: r.id,
        candidate_name: r.candidate_profiles?.full_name,
        position_title: r.positions?.title,
        note: tag,
        status: r.status ?? undefined,
        error_code: r.processing_error_code ?? undefined,
      };
    });

  const actions = [
    ...push(visibleNew.data, "match", "Review newly delivered candidate", (id) => `/client/candidates/${id}`),
    ...push(shortlisted.data, "match", "Move shortlist forward", (id) => `/client/candidates/${id}`),
    ...push(interviewing.data, "match", "Record interview outcome", (id) => `/client/candidates/${id}`),
    ...push(openOffers.data, "hire", "Progress open offer", () => `/client/offers`),
    ...push(stalled.data, "match", "Resolve processing issue with support", (id) => `/client/candidates/${id}`),
  ];

  return { data: { actions, total: actions.length }, citations };
}
