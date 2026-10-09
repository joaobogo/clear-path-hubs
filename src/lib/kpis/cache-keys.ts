/**
 * Canonical cache prefixes for business figures and the screens that present
 * them. Prefix invalidation intentionally refreshes every filtered variant.
 */
export const kpiCacheKeys = {
  client: {
    context: ["client-context"] as const,
    overview: (orgId?: string | null) =>
      orgId ? (["client-overview", orgId] as const) : (["client-overview"] as const),
    kpis: ["client-kpis"] as const,
    positions: (orgId?: string | null) =>
      orgId ? (["client-positions", orgId] as const) : (["client-positions"] as const),
    position: (positionId?: string | null) =>
      positionId ? (["client-position", positionId] as const) : (["client-position"] as const),
    positionEdit: (positionId?: string | null) =>
      positionId
        ? (["client-position-edit", positionId] as const)
        : (["client-position-edit"] as const),
    candidates: (orgId?: string | null) =>
      orgId ? (["client-candidates", orgId] as const) : (["client-candidates"] as const),
    candidate: (orgId?: string | null, matchId?: string | null) =>
      orgId && matchId
        ? (["client-candidate", orgId, matchId] as const)
        : (["client-candidate"] as const),
    interviews: (orgId?: string | null) =>
      orgId ? (["client-interviews", orgId] as const) : (["client-interviews"] as const),
    team: (orgId?: string | null) =>
      orgId ? (["client-team", orgId] as const) : (["client-team"] as const),
    seats: (orgId?: string | null) =>
      orgId ? (["client-team-seats", orgId] as const) : (["client-team-seats"] as const),
    feedbackQueue: ["interviews-awaiting-feedback"] as const,
    matchFeedback: ["match-feedback"] as const,
  },
  admin: {
    root: ["admin"] as const,
    overview: ["admin-overview"] as const,
    matches: ["admin", "matches"] as const,
    positions: ["admin", "positions"] as const,
    positionList: ["admin-positions"] as const,
    position: (positionId?: string | null) =>
      positionId ? (["admin-position", positionId] as const) : (["admin-position"] as const),
    positionEdit: (positionId?: string | null) =>
      positionId ? (["position-edit", positionId] as const) : (["position-edit"] as const),
    candidates: ["candidate-index"] as const,
    publishQueue: ["publish-queue"] as const,
    decisionBacklog: ["admin", "decision-backlog"] as const,
    approvals: ["admin", "approvals"] as const,
  },
} as const;

export const clientBusinessRefreshKeys = (orgId?: string | null) => [
  kpiCacheKeys.client.context,
  kpiCacheKeys.client.overview(orgId),
  kpiCacheKeys.client.kpis,
  kpiCacheKeys.client.positions(orgId),
  kpiCacheKeys.client.position(),
  kpiCacheKeys.client.candidates(orgId),
  kpiCacheKeys.client.candidate(),
  kpiCacheKeys.client.interviews(orgId),
  kpiCacheKeys.client.team(orgId),
  kpiCacheKeys.client.seats(orgId),
] as const;

export const adminBusinessRefreshKeys = [
  kpiCacheKeys.admin.root,
  kpiCacheKeys.admin.overview,
  kpiCacheKeys.admin.matches,
  kpiCacheKeys.admin.positions,
  kpiCacheKeys.admin.positionList,
  kpiCacheKeys.admin.position(),
  kpiCacheKeys.admin.candidates,
  kpiCacheKeys.admin.publishQueue,
  kpiCacheKeys.admin.decisionBacklog,
  kpiCacheKeys.admin.approvals,
] as const;