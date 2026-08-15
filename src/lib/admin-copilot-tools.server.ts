// Admin copilot tools — staff-only, read-oriented + draft proposals.
// Every tool returns { data, citations, proposed_actions? }.
// Never mutates. Drafts are proposals executed via executeAdminCopilotAction.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { evaluatePublishGate, type PublishBlocker } from "./publish-gate";
type Sb = any;

export interface Citation {
  kind: string;
  id: string;
  label: string;
  href?: string;
}

export type CopilotAction =
  | {
      kind: "navigate";
      action_id: string;
      label: string;
      description: string;
      href: string;
    }
  | {
      kind: "draft_client_update";
      action_id: string;
      label: string;
      description: string;
      org_id: string;
      client_name: string;
      draft_body: string;
    };

export interface CopilotToolResult {
  data: unknown;
  citations: Citation[];
  proposed_actions?: CopilotAction[];
  note?: string;
}

// ─── summarize_client_portfolio ────────────────────────────────────────────
export async function summarizeClientPortfolio(
  supabase: Sb,
  orgId: string | null,
): Promise<CopilotToolResult> {
  let q = supabase
    .from("organizations")
    .select("id, name, status, created_at")
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(25);
  if (orgId) q = q.eq("id", orgId);
  const { data: orgs } = await q;
  const list = (orgs ?? []) as any[];
  if (!list.length) {
    return { data: { orgs: [] }, citations: [], note: "No client organizations found." };
  }

  const orgIds = list.map((o) => o.id);
  // Positions and matches are keyed off the same org ids — one round trip each,
  // issued together.
  const [{ data: positions }, { data: matches }] = await Promise.all([
    supabase
      .from("positions")
      .select("id, title, status, organization_id, created_at")
      .in("organization_id", orgIds),
    supabase
      .from("candidate_matches")
      .select("id, stage, organization_id")
      .in("organization_id", orgIds),
  ]);


  const byOrg = list.map((o) => {
    const pos = (positions ?? []).filter((p: any) => p.organization_id === o.id);
    const m = (matches ?? []).filter((x: any) => x.organization_id === o.id);
    const open = pos.filter((p: any) => p.status === "open").length;
    const shortlisted = m.filter((x: any) =>
      ["shortlist", "interview", "offer"].includes(x.stage),
    ).length;
    return {
      org_id: o.id,
      name: o.name,
      open_positions: open,
      total_positions: pos.length,
      active_shortlist_candidates: shortlisted,
    };
  });

  return {
    data: { orgs: byOrg },
    citations: list.map((o) => ({
      kind: "organization",
      id: o.id,
      label: o.name,
      href: `/admin/clients/${o.id}`,
    })),
  };
}

// ─── summarize_candidate_history ───────────────────────────────────────────
export async function summarizeCandidateHistory(
  supabase: Sb,
  candidateId: string,
): Promise<CopilotToolResult> {
  const { data: cand } = await supabase
    .from("candidate_profiles")
    .select("id, full_name, email, headline, created_at")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return { data: { error: "candidate_not_found" }, citations: [] };
  const { data: matches } = await supabase
    .from("candidate_matches")
    .select(
      "id, stage, recommendation, position_id, organization_id, created_at, positions(title), organizations(name)",
    )
    .eq("candidate_profile_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(20);
  const list = (matches ?? []) as any[];
  return {
    data: {
      candidate: {
        id: cand.id,
        full_name: cand.full_name,
        headline: cand.headline,
        first_seen: cand.created_at,
      },
      matches: list.map((m) => ({
        match_id: m.id,
        stage: m.stage,
        recommendation: m.recommendation,
        role: m.positions?.title,
        client: m.organizations?.name,
        created_at: m.created_at,
      })),
    },
    citations: [
      { kind: "candidate", id: cand.id, label: cand.full_name },
      ...list.map((m) => ({
        kind: "match",
        id: m.id,
        label: `${cand.full_name} — ${m.positions?.title ?? "role"}`,
        href: `/admin/candidates/${m.id}`,
      })),
    ],
  };
}

// ─── blocked_roles ─────────────────────────────────────────────────────────
export async function blockedRoles(supabase: Sb): Promise<CopilotToolResult> {
  const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("positions")
    .select("id, title, status, organization_id, created_at, organizations(name)")
    .eq("status", "open")
    .lt("created_at", cutoff)
    .limit(40);
  const rows = (data ?? []) as any[];
  const posIds = rows.map((r) => r.id);
  let progressed: Record<string, number> = {};
  if (posIds.length) {
    const { data: matches } = await supabase
      .from("candidate_matches")
      .select("position_id, stage")
      .in("position_id", posIds);
    for (const m of (matches ?? []) as any[]) {
      if (["shortlist", "interview", "offer"].includes(m.stage)) {
        progressed[m.position_id] = (progressed[m.position_id] ?? 0) + 1;
      }
    }
  }
  const blocked = rows.filter((r) => (progressed[r.id] ?? 0) === 0);
  return {
    data: { blocked_roles: blocked.map((r) => ({ position_id: r.id, title: r.title, client: r.organizations?.name, opened_at: r.created_at })) },
    citations: blocked.map((r) => ({
      kind: "position",
      id: r.id,
      label: r.title,
      href: `/admin/positions/${r.id}`,
    })),
  };
}

// ─── stalled_interviews ────────────────────────────────────────────────────
export async function stalledInterviews(supabase: Sb): Promise<CopilotToolResult> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("candidate_matches")
    .select("id, stage, updated_at, candidate_profiles(full_name), positions(title), organizations(name)")
    .eq("stage", "interview")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(30);
  const rows = (data ?? []) as any[];
  return {
    data: {
      stalled: rows.map((r) => ({
        match_id: r.id,
        candidate: r.candidate_profiles?.full_name,
        role: r.positions?.title,
        client: r.organizations?.name,
        last_update: r.updated_at,
      })),
    },
    citations: rows.map((r) => ({
      kind: "match",
      id: r.id,
      label: `${r.candidate_profiles?.full_name ?? "Candidate"} — ${r.positions?.title ?? ""}`,
      href: `/admin/candidates/${r.id}`,
    })),
  };
}

// ─── missing_approvals ─────────────────────────────────────────────────────
export async function missingApprovals(supabase: Sb): Promise<CopilotToolResult> {
  const cutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("candidate_matches")
    .select("id, stage, updated_at, candidate_profiles(full_name), positions(title), organizations(name)")
    .in("stage", ["shortlist", "interview", "offer"])
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(40);
  const rows = (data ?? []) as any[];
  return {
    data: {
      pending: rows.map((r) => ({
        match_id: r.id,
        stage: r.stage,
        candidate: r.candidate_profiles?.full_name,
        role: r.positions?.title,
        client: r.organizations?.name,
        waiting_since: r.updated_at,
      })),
    },
    citations: rows.map((r) => ({
      kind: "match",
      id: r.id,
      label: `${r.candidate_profiles?.full_name ?? ""} — ${r.stage}`,
      href: `/admin/candidates/${r.id}`,
    })),
  };
}

// ─── rediscovery_candidates ────────────────────────────────────────────────
export async function rediscoveryCandidates(
  supabase: Sb,
  positionId: string | null,
): Promise<CopilotToolResult> {
  // Look at talent_memory rows flagged good_for_future or previously strong.
  let q = supabase
    .from("talent_memory")
    .select(
      "id, candidate_profile_id, reason_category, reason_notes, status, updated_at, candidate_profiles(full_name, headline)",
    )
    .order("updated_at", { ascending: false })
    .limit(20);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  return {
    data: {
      candidates: rows.map((r) => ({
        talent_memory_id: r.id,
        candidate_id: r.candidate_profile_id,
        name: r.candidate_profiles?.full_name,
        headline: r.candidate_profiles?.headline,
        tags: [r.reason_category, r.status].filter(Boolean),
        notes: r.reason_notes,
      })),
      scoped_to_position: positionId,
    },
    citations: rows.map((r) => ({
      kind: "candidate",
      id: r.candidate_profile_id,
      label: r.candidate_profiles?.full_name ?? "Candidate",
    })),
  };
}

// ─── draft_client_update ───────────────────────────────────────────────────
export async function draftClientUpdate(
  supabase: Sb,
  orgId: string,
): Promise<CopilotToolResult> {
  // All three reads key off the org id only — no ordering dependency.
  const [{ data: org }, { data: positions }, { data: matches }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle(),
    supabase.from("positions").select("id, title, status").eq("organization_id", orgId),
    supabase.from("candidate_matches").select("id, stage").eq("organization_id", orgId),
  ]);
  if (!org) return { data: { error: "org_not_found" }, citations: [] };


  const pos = (positions ?? []) as any[];
  const m = (matches ?? []) as any[];
  const open = pos.filter((p) => p.status === "open").length;
  const shortlisted = m.filter((x) => ["shortlist", "interview", "offer"].includes(x.stage)).length;
  const interviewing = m.filter((x) => x.stage === "interview").length;

  const draft =
    `Hi ${org.name} team,\n\n` +
    `Quick weekly update on your active hiring:\n\n` +
    `• Open roles: ${open}\n` +
    `• Candidates on shortlist / interview / offer: ${shortlisted}\n` +
    `• Currently interviewing: ${interviewing}\n\n` +
    `Anything you'd like us to prioritize this week? Happy to walk through the pipeline live.\n\n` +
    `— TaaSFlow team`;

  return {
    data: { org: { id: org.id, name: org.name }, metrics: { open, shortlisted, interviewing } },
    citations: [{ kind: "organization", id: org.id, label: org.name }],
    proposed_actions: [
      {
        kind: "draft_client_update",
        action_id: `draft_client_update:${org.id}`,
        label: `Send weekly update to ${org.name}`,
        description: "Reviewable draft — you approve before it is posted to the client workspace thread.",
        org_id: org.id,
        client_name: org.name,
        draft_body: draft,
      },
    ],
  };
}

