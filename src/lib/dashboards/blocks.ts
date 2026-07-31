/**
 * The dashboard block library.
 *
 * Eight blocks, each backed by a real metric or list the platform already
 * records. Every block states what it counts and where it links to, so a
 * number on a dashboard can always be walked back to its records.
 *
 * Client-safe: definitions only, no data access.
 */

export const BLOCK_IDS = [
  "pipeline_by_stage",
  "decisions_waiting",
  "time_to_shortlist",
  "offer_status",
  "outreach_conversion",
  "spend_per_hire",
  "talent_pool_growth",
  "team_activity",
] as const;

export type BlockId = (typeof BLOCK_IDS)[number];

export type BlockDefinition = {
  id: BlockId;
  title: string;
  /** One line, plain language: what this block counts. */
  definition: string;
  /** What fills it when it is empty. */
  emptyHint: string;
  /** Where clicking through goes. */
  href: string;
  /** How wide the block sits on a 12-column grid. */
  span: 4 | 6 | 8 | 12;
};

export const BLOCK_LIBRARY: Record<BlockId, BlockDefinition> = {
  pipeline_by_stage: {
    id: "pipeline_by_stage",
    title: "Pipeline by stage",
    definition: "Live candidates in each stage of your pipeline right now.",
    emptyHint: "Fills as soon as the first candidates reach you.",
    href: "/client/candidates",
    span: 6,
  },
  decisions_waiting: {
    id: "decisions_waiting",
    title: "Decisions waiting",
    definition: "Candidates delivered to you with no decision recorded yet.",
    emptyHint: "Fills when we deliver candidates for your review.",
    href: "/client",
    span: 6,
  },
  time_to_shortlist: {
    id: "time_to_shortlist",
    title: "Time to shortlist against our promise",
    definition:
      "Days from role launch to first shortlist, compared with the promise we set for each role.",
    emptyHint: "Fills once a role has launched and a commitment is in place.",
    href: "/client/positions",
    span: 12,
  },
  offer_status: {
    id: "offer_status",
    title: "Offer status",
    definition: "Every open offer by status, and any sitting still for over 48 hours.",
    emptyHint: "Fills when the first offer is drafted.",
    href: "/client/offers",
    span: 6,
  },
  outreach_conversion: {
    id: "outreach_conversion",
    title: "Outreach conversion",
    definition: "Approaches sent, replies received, and the reply rate over the last 30 days.",
    emptyHint: "Fills once outreach starts on a live role.",
    href: "/client/outreach",
    span: 6,
  },
  spend_per_hire: {
    id: "spend_per_hire",
    title: "Spend per hire",
    definition: "Payments recorded against your account divided by confirmed hires.",
    emptyHint: "Fills after your first confirmed hire.",
    href: "/client/plan",
    span: 4,
  },
  talent_pool_growth: {
    id: "talent_pool_growth",
    title: "Talent pool growth",
    definition: "People added to your talent pool each week over the last eight weeks.",
    emptyHint: "Fills as candidates enter your pool.",
    href: "/client/talent-pool",
    span: 8,
  },
  team_activity: {
    id: "team_activity",
    title: "Team activity",
    definition: "Decisions each member of your team recorded in the last 30 days.",
    emptyHint: "Fills when your team starts recording decisions.",
    href: "/client/team",
    span: 6,
  },
};

export const BLOCK_LIST: BlockDefinition[] = BLOCK_IDS.map((id) => BLOCK_LIBRARY[id]);

export function isBlockId(v: unknown): v is BlockId {
  return typeof v === "string" && (BLOCK_IDS as readonly string[]).includes(v);
}

/** What a new organisation sees before anyone arranges their own layout. */
export const DEFAULT_LAYOUT: BlockId[] = [
  "decisions_waiting",
  "pipeline_by_stage",
  "time_to_shortlist",
  "offer_status",
  "outreach_conversion",
];

// ─── Block data shapes ──────────────────────────────────────────────────────

export type SeriesPoint = { label: string; value: number; href?: string };

export type BlockData =
  | { kind: "series"; points: SeriesPoint[]; total: number }
  | { kind: "stat"; value: string; caption: string; sub?: string }
  | {
      kind: "rows";
      rows: Array<{ label: string; value: string; note?: string; href?: string }>;
    };

export type BlockResult = {
  id: BlockId;
  /** Data, or null when there is genuinely nothing yet. */
  data: BlockData | null;
  /** Plain sentence when a block cannot be filled — never a fake zero. */
  unavailable?: string;
};
