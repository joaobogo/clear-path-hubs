/**
 * Flow Group Ventures (FGV) ecosystem layer — TaaSFlow configuration.
 * ------------------------------------------------------------------
 * TaaSFlow is a Tier 1 FGV brand and owns recurring recruiting and hiring
 * infrastructure. Sibling brands are referenced ONLY when the page context
 * matches a defined trigger, and never more than one module per page.
 */

export const FGV = {
  name: "Flow Group Ventures",
  shortName: "FGV",
  url: "https://flowgroupventures.com",
  endorsement: "Part of the FGV growth system",
} as const;

export type SiblingBrandId =
  | "flowplaced"
  | "omniflow"
  | "atlasflow"
  | "neuronflow"
  | "fgv";

export type SiblingBrand = {
  id: SiblingBrandId;
  name: string;
  url: string;
  /** What this brand owns — never overlaps TaaSFlow's ownership. */
  owns: string;
};

export const SIBLING_BRANDS: Record<SiblingBrandId, SiblingBrand> = {
  flowplaced: {
    id: "flowplaced",
    name: "FlowPlaced",
    url: "https://flowplaced.com",
    owns: "Direct-hire and one-time placement on a fixed fee",
  },
  omniflow: {
    id: "omniflow",
    name: "OmniFlow",
    url: "https://omniflowco.com",
    owns: "Marketing, outbound, websites, SEO, content, and advertising",
  },
  atlasflow: {
    id: "atlasflow",
    name: "AtlasFlow",
    url: "https://atlasflow.co",
    owns: "International market expansion and entry",
  },
  neuronflow: {
    id: "neuronflow",
    name: "NeuronFlow",
    url: "https://neuronflow.ai",
    owns: "AI agents and workflow automation",
  },
  fgv: {
    id: "fgv",
    name: FGV.name,
    url: FGV.url,
    owns: "Integrated growth strategy across the group",
  },
};

/** Sibling brands shown in the footer ecosystem row (TaaSFlow itself excluded). */
export const ECOSYSTEM_FOOTER_BRANDS: SiblingBrand[] = [
  SIBLING_BRANDS.flowplaced,
  SIBLING_BRANDS.omniflow,
  SIBLING_BRANDS.atlasflow,
  SIBLING_BRANDS.neuronflow,
];

/** Contextual cross-sell triggers permitted for TaaSFlow. */
export type CrossSellTrigger =
  | "single-role"
  | "employer-brand"
  | "market-entry"
  | "ai-automation";

export type CrossSellCopy = {
  brand: SiblingBrand;
  question: string;
  body: string;
  cta: string;
};

export const CROSS_SELLS: Record<CrossSellTrigger, CrossSellCopy> = {
  "single-role": {
    brand: SIBLING_BRANDS.flowplaced,
    question: "Hiring one role rather than building a hiring engine?",
    body: "A subscription only pays off with recurring or multi-role hiring. For a single defined role, our sibling brand FlowPlaced runs a fixed-fee direct search instead.",
    cta: "See FlowPlaced direct placement",
  },
  "employer-brand": {
    brand: SIBLING_BRANDS.omniflow,
    question: "Is the shortage of applicants a visibility problem?",
    body: "When qualified people simply are not seeing your roles, that is a demand problem, not a sourcing one. OmniFlow builds the employer-brand and campaign side.",
    cta: "See OmniFlow growth systems",
  },
  "market-entry": {
    brand: SIBLING_BRANDS.atlasflow,
    question: "Entering a new market, not just hiring in one?",
    body: "Hiring abroad is one part of market entry. AtlasFlow covers the strategy, entity, and go-to-market work around it — we handle the hiring inside it.",
    cta: "Explore AtlasFlow market entry",
  },
  "ai-automation": {
    brand: SIBLING_BRANDS.neuronflow,
    question: "Want the work after the hire automated too?",
    body: "We automate hiring. When the bottleneck sits in the operations around it, NeuronFlow builds the AI agents and workflow automation for that side.",
    cta: "See NeuronFlow automation",
  },
};

/** Attribution appended to every outbound ecosystem link. */
export function ecosystemHref(url: string, trigger: CrossSellTrigger): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "taasflow");
  u.searchParams.set("utm_medium", "ecosystem_referral");
  u.searchParams.set("utm_campaign", trigger);
  return u.toString();
}
