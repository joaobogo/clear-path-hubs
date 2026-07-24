/**
 * Industry Archetypes — the six canonical page experiences.
 *
 * Every public industry page maps to exactly one archetype. Each archetype
 * has a distinct hero composition, section order, storytelling section,
 * process treatment, and (optional) proof layout. Missing data hides
 * silently — an archetype never invents copy to fill a component.
 *
 * ┌────────────────────────┬────────────────────────────────────────────────┐
 * │ Archetype              │ For                                             │
 * ├────────────────────────┼────────────────────────────────────────────────┤
 * │ systems-capability     │ Technology, data, AI, security, product        │
 * │ trust-compliance       │ Healthcare, life sciences, public sector       │
 * │ risk-judgment          │ Legal, finance, insurance, accounting          │
 * │ operations-delivery    │ Construction, manufacturing, logistics, energy │
 * │ service-experience     │ Hospitality, retail, travel, media, consumer   │
 * │ expertise-growth       │ Consulting, sales, marketing, education, HR    │
 * └────────────────────────┴────────────────────────────────────────────────┘
 */

export type IndustryArchetype =
  | "systems-capability"
  | "trust-compliance"
  | "risk-judgment"
  | "operations-delivery"
  | "service-experience"
  | "expertise-growth";

/** Higher-level filter families for the /industries hub. Aligned 1:1 with
 * archetypes so hub filters and page treatments never drift apart. */
export type IndustryFamily = IndustryArchetype;

export const FAMILY_LABEL: Record<IndustryFamily, string> = {
  "systems-capability": "Digital Systems",
  "trust-compliance": "Health & Life Sciences",
  "risk-judgment": "Finance & Regulated Professions",
  "operations-delivery": "Built Environment & Operations",
  "service-experience": "Consumer & Service",
  "expertise-growth": "Knowledge, Growth & Creative",
};

export const FAMILY_TAGLINE: Record<IndustryFamily, string> = {
  "systems-capability":
    "Technical roles evaluated against real systems built, scale handled and stacks used in production.",
  "trust-compliance":
    "Care and mission-critical hiring with credential, licence and continuity checks before shortlist.",
  "risk-judgment":
    "Regulated and judgment-heavy roles where jurisdiction, precedent and risk scope must be verified.",
  "operations-delivery":
    "Site-aware sourcing for the industries that deliver physical outcomes — safety and cadence first.",
  "service-experience":
    "Guest, customer and audience-facing hiring where service moment, coverage and cadence lead.",
  "expertise-growth":
    "Roles that compound skills into outcomes — sourcing calibrated to competencies and progression.",
};

export type IndustrySectionKey =
  | "hero"
  | "challenges"
  | "solutions"
  | "role-explorer"
  | "signal-explorer"
  | "skills-tools"
  | "delivery-preview"
  | "process"
  | "keyword-links"
  | "related"
  | "insights"
  | "faq"
  | "cta";

export type SecondaryCta = {
  label: "Explore roles" | "See how scoring works" | "View the process";
  to: string;
};

export type ArchetypeSpec = {
  archetype: IndustryArchetype;
  family: IndustryFamily;
  heroVariant: IndustryArchetype;
  /** Storytelling section variant. */
  storytelling: "capability-map" | "credential-gates" | "risk-matrix" | "role-outcome-flow" | "service-moments" | "competency-framework";
  /** Process visual style. */
  processStyle: "numbered-cards" | "stepped-timeline" | "list-compact";
  /** Sections rendered in this exact order — missing data hides silently. */
  sections: IndustrySectionKey[];
  /** Explicit product demonstration ("What a shortlist looks like").
   * Always clearly labelled "Example data" — never claimed as live. */
  showDeliveryPreview: boolean;
  /** Fallback secondary CTA for hero. Overridable per industry. */
  secondaryCta: SecondaryCta;
  /** Family palette hint (Tailwind tokens live in brand-tokens.css). */
  palette: "ink-electric" | "ivory-teal" | "paper-navy" | "steel-amber" | "warm-editorial" | "cream-emerald";
};

const SECONDARY_SCORING: SecondaryCta = { label: "See how scoring works", to: "/how-it-works#scoring" };
const SECONDARY_ROLES: SecondaryCta = { label: "Explore roles", to: "#role-explorer" };
const SECONDARY_PROCESS: SecondaryCta = { label: "View the process", to: "#process" };

export const ARCHETYPE_SPECS: Record<IndustryArchetype, ArchetypeSpec> = {
  "systems-capability": {
    archetype: "systems-capability",
    family: "systems-capability",
    heroVariant: "systems-capability",
    storytelling: "capability-map",
    processStyle: "list-compact",
    palette: "ink-electric",
    showDeliveryPreview: true,
    secondaryCta: SECONDARY_SCORING,
    sections: ["hero", "challenges", "role-explorer", "signal-explorer", "skills-tools", "delivery-preview", "process", "related", "insights", "faq", "cta"],
  },
  "trust-compliance": {
    archetype: "trust-compliance",
    family: "trust-compliance",
    heroVariant: "trust-compliance",
    storytelling: "credential-gates",
    processStyle: "stepped-timeline",
    palette: "ivory-teal",
    showDeliveryPreview: false,
    secondaryCta: SECONDARY_PROCESS,
    sections: ["hero", "role-explorer", "challenges", "skills-tools", "signal-explorer", "solutions", "process", "faq", "insights", "related", "cta"],
  },
  "risk-judgment": {
    archetype: "risk-judgment",
    family: "risk-judgment",
    heroVariant: "risk-judgment",
    storytelling: "risk-matrix",
    processStyle: "list-compact",
    palette: "paper-navy",
    showDeliveryPreview: true,
    secondaryCta: SECONDARY_SCORING,
    sections: ["hero", "challenges", "skills-tools", "role-explorer", "signal-explorer", "delivery-preview", "process", "faq", "solutions", "related", "insights", "cta"],
  },
  "operations-delivery": {
    archetype: "operations-delivery",
    family: "operations-delivery",
    heroVariant: "operations-delivery",
    storytelling: "role-outcome-flow",
    processStyle: "numbered-cards",
    palette: "steel-amber",
    showDeliveryPreview: false,
    secondaryCta: SECONDARY_PROCESS,
    sections: ["hero", "challenges", "role-explorer", "skills-tools", "process", "signal-explorer", "solutions", "related", "keyword-links", "insights", "cta"],
  },
  "service-experience": {
    archetype: "service-experience",
    family: "service-experience",
    heroVariant: "service-experience",
    storytelling: "service-moments",
    processStyle: "stepped-timeline",
    palette: "warm-editorial",
    showDeliveryPreview: false,
    secondaryCta: SECONDARY_ROLES,
    sections: ["hero", "challenges", "role-explorer", "solutions", "signal-explorer", "process", "insights", "related", "faq", "cta"],
  },
  "expertise-growth": {
    archetype: "expertise-growth",
    family: "expertise-growth",
    heroVariant: "expertise-growth",
    storytelling: "competency-framework",
    processStyle: "numbered-cards",
    palette: "cream-emerald",
    showDeliveryPreview: true,
    secondaryCta: SECONDARY_ROLES,
    sections: ["hero", "role-explorer", "challenges", "signal-explorer", "delivery-preview", "solutions", "process", "keyword-links", "related", "insights", "cta"],
  },
};

/**
 * Every industry slug (data-side keys from `industries-v2.ts` /
 * `industries-batch2.ts`) is mapped to one archetype. Missing slugs fall
 * through to `expertise-growth` — the dev coverage check
 * (`/dev/industry-coverage`) will warn if that fallback fires.
 */
export const INDUSTRY_ARCHETYPE: Record<string, IndustryArchetype> = {
  // Systems & Capability
  tech: "systems-capability",
  saas: "systems-capability",
  "data-analytics": "systems-capability",
  "ai-ml": "systems-capability",
  fintech: "systems-capability",
  devops: "systems-capability",
  web3: "systems-capability",
  "product-management": "systems-capability",
  cybersecurity: "systems-capability",

  // Trust & Compliance
  healthcare: "trust-compliance",
  pharmaceuticals: "trust-compliance",
  biotech: "trust-compliance",
  "medical-devices": "trust-compliance",
  healthtech: "trust-compliance",
  "public-sector": "trust-compliance",
  nonprofit: "trust-compliance",

  // Risk & Judgment
  legal: "risk-judgment",
  finance: "risk-judgment",
  "investment-banking": "risk-judgment",
  insurance: "risk-judgment",
  "private-equity": "risk-judgment",
  "wealth-management": "risk-judgment",
  "venture-capital": "risk-judgment",
  accounting: "risk-judgment",

  // Operations & Delivery
  construction: "operations-delivery",
  manufacturing: "operations-delivery",
  energy: "operations-delivery",
  "renewable-energy": "operations-delivery",
  "oil-gas": "operations-delivery",
  logistics: "operations-delivery",
  automotive: "operations-delivery",
  architecture: "operations-delivery",
  agriculture: "operations-delivery",
  aviation: "operations-delivery",
  defense: "operations-delivery",
  "real-estate": "operations-delivery",
  proptech: "operations-delivery",
  telecom: "operations-delivery",

  // Service & Experience
  hospitality: "service-experience",
  retail: "service-experience",
  travel: "service-experience",
  sports: "service-experience",
  fashion: "service-experience",
  "food-beverage": "service-experience",
  media: "service-experience",
  ecommerce: "service-experience",

  // Expertise & Growth
  sales: "expertise-growth",
  marketing: "expertise-growth",
  consulting: "expertise-growth",
  "staffing-agencies": "expertise-growth",
  "customer-success": "expertise-growth",
  design: "expertise-growth",
  education: "expertise-growth",
  "higher-education": "expertise-growth",
  edtech: "expertise-growth",
  "human-resources": "expertise-growth",
  gaming: "expertise-growth",
};

export function getArchetypeForSlug(slug: string): ArchetypeSpec {
  const key = INDUSTRY_ARCHETYPE[slug] ?? "expertise-growth";
  return ARCHETYPE_SPECS[key];
}

export const ALL_FAMILIES: IndustryFamily[] = [
  "systems-capability",
  "trust-compliance",
  "risk-judgment",
  "operations-delivery",
  "service-experience",
  "expertise-growth",
];
