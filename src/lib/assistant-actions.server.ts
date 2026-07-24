// Client AI Assistant — action-mode tools.
//
// These are the ONLY paths through which the assistant can propose a change
// to the user's workspace. Every tool returns a `proposed_action` payload:
// nothing is mutated here. The UI renders a confirmation card and the user
// clicks Approve to execute via `executeAssistantAction`, which is the only
// server function that performs the underlying write.
//
// Design invariants:
// - No hidden mutations: tools ONLY return proposals; the executor requires
//   an explicit call from the client after visible confirmation.
// - No unreviewed outreach: draft_interview_request only PREPARES the draft
//   text; the user must approve before it is sent as a message.
// - No stage changes without visible confirmation: no stage-transition tool
//   is exposed (staging still happens in the pipeline UI, not the assistant).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = any;

import type { Citation } from "./assistant-tools.server";

export type AssistantAction =
  | {
      kind: "navigate";
      action_id: string;
      label: string;
      description: string;
      href: string;
    }
  | {
      kind: "draft_interview_request";
      action_id: string;
      label: string;
      description: string;
      match_id: string;
      candidate_name: string;
      position_title: string;
      draft_body: string;
    };

interface ActionToolResult {
  data: unknown;
  citations: Citation[];
  proposed_actions: AssistantAction[];
  note?: string;
}

// ─── open_role ──────────────────────────────────────────────────────────────
export async function proposeOpenRole(
  supabase: Sb,
  orgId: string,
  positionId: string,
): Promise<ActionToolResult> {
  const { data } = await supabase
    .from("positions")
    .select("id, title, status, department")
    .eq("organization_id", orgId)
    .eq("id", positionId)
    .maybeSingle();
  if (!data) {
    return {
      data: { error: "position_not_found" },
      citations: [],
      proposed_actions: [],
    };
  }
  const href = `/client/positions/${data.id}`;
  return {
    data: { position: data },
    citations: [
      { kind: "position", id: data.id, label: data.title, href },
    ],
    proposed_actions: [
      {
        kind: "navigate",
        action_id: `open_role:${data.id}`,
        label: `Open “${data.title}”`,
        description: "Go to the role workspace.",
        href,
      },
    ],
  };
}

// ─── open_candidate ─────────────────────────────────────────────────────────
export async function proposeOpenCandidate(
  supabase: Sb,
  orgId: string,
  matchId: string,
): Promise<ActionToolResult> {
  const { data } = await supabase
    .from("candidate_matches")
    .select("id, stage, positions(title), candidate_profiles(full_name)")
    .eq("organization_id", orgId)
    .eq("id", matchId)
    .maybeSingle();
  if (!data) {
    return {
      data: { error: "match_not_found" },
      citations: [],
      proposed_actions: [],
    };
  }
  const name = (data as any).candidate_profiles?.full_name ?? "candidate";
  const title = (data as any).positions?.title ?? "role";
  const href = `/client/candidates/${data.id}`;
  return {
    data: { match: data },
    citations: [{ kind: "match", id: data.id, label: `${name} — ${title}`, href }],
    proposed_actions: [
      {
        kind: "navigate",
        action_id: `open_candidate:${data.id}`,
        label: `Open ${name}`,
        description: `Review the dossier for ${title}.`,
        href,
      },
    ],
  };
}

// ─── prepare_compare_set ───────────────────────────────────────────────────
export async function prepareCompareSet(
  supabase: Sb,
  orgId: string,
  matchIds: string[],
  positionId: string | null,
): Promise<ActionToolResult> {
  const ids = matchIds.filter(Boolean).slice(0, 6);
  if (ids.length < 2) {
    return {
      data: { error: "need_at_least_two_match_ids" },
      citations: [],
      proposed_actions: [],
    };
  }
  const { data } = await supabase
    .from("candidate_matches")
    .select("id, position_id, positions(title), candidate_profiles(full_name)")
    .eq("organization_id", orgId)
    .in("id", ids);
  const rows = (data ?? []) as any[];
  if (rows.length < 2) {
    return {
      data: { error: "matches_not_accessible" },
      citations: [],
      proposed_actions: [],
    };
  }
  const resolvedPosition =
    positionId ??
    (rows.every((r) => r.position_id === rows[0].position_id)
      ? rows[0].position_id
      : null);
  const href = resolvedPosition
    ? `/client/positions/${resolvedPosition}?compare=${ids.join(",")}`
    : `/client/candidates?compare=${ids.join(",")}`;

  const citations: Citation[] = rows.map((r: any) => ({
    kind: "match",
    id: r.id,
    label: `${r.candidate_profiles?.full_name ?? "Candidate"} — ${r.positions?.title ?? ""}`,
    href: `/client/candidates/${r.id}`,
  }));

  return {
    data: { compare_href: href, matches: rows },
    citations,
    proposed_actions: [
      {
        kind: "navigate",
        action_id: `compare:${ids.join(",")}`,
        label: `Compare ${rows.length} candidates`,
        description: rows
          .map((r) => r.candidate_profiles?.full_name)
          .filter(Boolean)
          .join(", "),
        href,
      },
    ],
  };
}

// ─── generate_shortlist_summary ────────────────────────────────────────────
export async function generateShortlistSummary(
  supabase: Sb,
  orgId: string,
  positionId: string,
): Promise<ActionToolResult> {
  const { data: pos } = await supabase
    .from("positions")
    .select("id, title, status")
    .eq("organization_id", orgId)
    .eq("id", positionId)
    .maybeSingle();
  if (!pos) {
    return { data: { error: "position_not_found" }, citations: [], proposed_actions: [] };
  }
  const { data: rows } = await supabase
    .from("candidate_matches")
    .select(
      "id, stage, current_score_run_id, approved_score_run_id, candidate_profiles(full_name, headline), score_runs!candidate_matches_approved_score_run_id_fkey(score, fit_label, must_have_coverage)",
    )
    .eq("organization_id", orgId)
    .eq("position_id", positionId)
    .in("stage", ["shortlist", "interview", "offer"])
    .limit(25);

  const citations: Citation[] = [
    { kind: "position", id: pos.id, label: pos.title, href: `/client/positions/${pos.id}` },
  ];
  const items = (rows ?? []).map((r: any) => {
    const run = r.score_runs ?? {};
    citations.push({
      kind: "match",
      id: r.id,
      label: `${r.candidate_profiles?.full_name ?? "Candidate"} — ${r.stage}`,
      href: `/client/candidates/${r.id}`,
    });
    return {
      match_id: r.id,
      name: r.candidate_profiles?.full_name,
      headline: r.candidate_profiles?.headline,
      stage: r.stage,
      score: run.score ?? null,
      fit_label: run.fit_label ?? null,
      must_have_coverage: run.must_have_coverage ?? null,
    };
  });

  return {
    data: { position: pos, shortlist: items, count: items.length },
    citations,
    proposed_actions: [
      {
        kind: "navigate",
        action_id: `shortlist:${pos.id}`,
        label: `Open shortlist for ${pos.title}`,
        description: `${items.length} candidate(s) on shortlist/interview/offer.`,
        href: `/client/positions/${pos.id}`,
      },
    ],
  };
}

// ─── surface_pending_approvals ─────────────────────────────────────────────
export async function surfacePendingApprovals(
  supabase: Sb,
  orgId: string,
): Promise<ActionToolResult> {
  const { data } = await supabase
    .from("candidate_matches")
    .select(
      "id, stage, admin_status, client_visibility, positions(title), candidate_profiles(full_name)",
    )
    .eq("organization_id", orgId)
    .in("stage", ["shortlist", "interview", "offer"])
    .order("updated_at", { ascending: false })
    .limit(25);
  const rows = (data ?? []) as any[];
  const citations: Citation[] = rows.map((r: any) => ({
    kind: "match",
    id: r.id,
    label: `${r.candidate_profiles?.full_name ?? "Candidate"} — ${r.positions?.title ?? ""}`,
    href: `/client/candidates/${r.id}`,
  }));

  return {
    data: {
      awaiting_decision: rows.map((r: any) => ({
        match_id: r.id,
        stage: r.stage,
        candidate_name: r.candidate_profiles?.full_name,
        position_title: r.positions?.title,
      })),
      count: rows.length,
    },
    citations,
    proposed_actions: rows.slice(0, 6).map((r: any) => ({
      kind: "navigate" as const,
      action_id: `approval:${r.id}`,
      label: `Review ${r.candidate_profiles?.full_name ?? "candidate"}`,
      description: `${r.stage} — ${r.positions?.title ?? ""}`,
      href: `/client/candidates/${r.id}`,
    })),
  };
}

// ─── draft_interview_request ───────────────────────────────────────────────
export async function proposeDraftInterviewRequest(
  supabase: Sb,
  orgId: string,
  matchId: string,
  notes: string | null,
): Promise<ActionToolResult> {
  const { data: match } = await supabase
    .from("candidate_matches")
    .select("id, positions(title), candidate_profiles(full_name)")
    .eq("organization_id", orgId)
    .eq("id", matchId)
    .maybeSingle();
  if (!match) {
    return { data: { error: "match_not_found" }, citations: [], proposed_actions: [] };
  }
  const name = (match as any).candidate_profiles?.full_name ?? "the candidate";
  const title = (match as any).positions?.title ?? "the role";
  const notesLine = notes?.trim() ? `\n\nContext: ${notes.trim()}` : "";
  const draft = `Hi TaaSFlow team,\n\nCould you help us schedule an interview with ${name} for ${title}? Please share suggested time slots and any preparation notes for the candidate.${notesLine}\n\nThanks!`;

  return {
    data: { match_id: match.id, candidate_name: name, position_title: title, draft_body: draft },
    citations: [
      {
        kind: "match",
        id: match.id,
        label: `${name} — ${title}`,
        href: `/client/candidates/${match.id}`,
      },
    ],
    proposed_actions: [
      {
        kind: "draft_interview_request",
        action_id: `draft_interview:${match.id}`,
        label: `Send interview request for ${name}`,
        description: `Delivers this message to the TaaSFlow team thread. You can edit before sending.`,
        match_id: match.id,
        candidate_name: name,
        position_title: title,
        draft_body: draft,
      },
    ],
  };
}
