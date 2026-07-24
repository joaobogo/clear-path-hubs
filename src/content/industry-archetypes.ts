/**
 * Industry Archetypes — composition presets for the public industry pages.
 *
 * Replaces the single cloned `industry-template.tsx` layout. Each archetype
 * has a distinct hero composition, section order, and visual rhythm so
 * pages feel native to their industry while sharing one design system.
 *
 * ┌──────────────────────────┬────────────────────────────────────────────────┐
 * │ Archetype                │ Character                                       │
 * ├──────────────────────────┼────────────────────────────────────────────────┤
 * │ cinematic-editorial      │ Full-bleed photograph, quiet chrome, one hero  │
 * │                          │ subject. For guest / consumer / lifestyle.     │
 * │ field-report             │ Blueprint split, KPI tiles, process-first.     │
 * │                          │ For built environment & industrial.            │
 * │ data-dense               │ Dashboard-forward, condensed grid, minimal     │
 * │                          │ photography. For technology & data verticals.  │
 * │ regulated-serif          │ Serif display, credentials-forward, columns    │
 * │                          │ backdrop. For legal, finance, public sector.   │
 * │ human-portrait           │ Warm portrait hero, storytelling copy, roles   │
 * │                          │ before signals. For care & mission verticals.  │
 * │ commercial-momentum      │ Typographic hero + kinetic pace, revenue-tilt. │
 * │                          │ For go-to-market and services.                 │
 * └──────────────────────────┴────────────────────────────────────────────────┘
 */

export type IndustryArchetype =
  | "cinematic-editorial"
  | "field-report"
  | "data-dense"
  | "regulated-serif"
  | "human-portrait"
  | "commercial-momentum";

export type IndustrySectionKey =
  | "hero"
  | "key-tiles"
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

export type ArchetypeSpec = {
  archetype: IndustryArchetype;
  /** Hero variant renderer key. */
  heroVariant:
    | "cinematic"
    | "field-report"
    | "data-dense"
    | "regulated-serif"
    | "human-portrait"
    | "commercial-momentum";
  /** Process visual style. */
  processStyle: "numbered-cards" | "stepped-timeline" | "list-compact";
  /** Sections rendered in this exact order — missing data hides silently. */
  sections: IndustrySectionKey[];
  /** Show the animated key-tiles band (replaces old repeated metric strip). */
  showKeyTiles: boolean;
  /** Show the delivery-visual preview block. */
  showDeliveryPreview: boolean;
  /** Copy tone descriptor — read by hero variants for micro-copy. */
  toneLabel: string;
};

export const ARCHETYPE_SPECS: Record<IndustryArchetype, ArchetypeSpec> = {
  "cinematic-editorial": {
    archetype: "cinematic-editorial",
    heroVariant: "cinematic",
    processStyle: "stepped-timeline",
    showKeyTiles: false,
    showDeliveryPreview: false,
    toneLabel: "Editorial",
    sections: [
      "hero",
      "challenges",
      "role-explorer",
      "solutions",
      "signal-explorer",
      "process",
      "insights",
      "related",
      "faq",
      "cta",
    ],
  },
  "field-report": {
    archetype: "field-report",
    heroVariant: "field-report",
    processStyle: "numbered-cards",
    showKeyTiles: true,
    showDeliveryPreview: false,
    toneLabel: "Field report",
    sections: [
      "hero",
      "key-tiles",
      "challenges",
      "skills-tools",
      "role-explorer",
      "process",
      "solutions",
      "signal-explorer",
      "related",
      "keyword-links",
      "insights",
      "cta",
    ],
  },
  "data-dense": {
    archetype: "data-dense",
    heroVariant: "data-dense",
    processStyle: "list-compact",
    showKeyTiles: true,
    showDeliveryPreview: true,
    toneLabel: "Signal-first",
    sections: [
      "hero",
      "key-tiles",
      "signal-explorer",
      "role-explorer",
      "skills-tools",
      "delivery-preview",
      "challenges",
      "solutions",
      "process",
      "related",
      "insights",
      "faq",
      "cta",
    ],
  },
  "regulated-serif": {
    archetype: "regulated-serif",
    heroVariant: "regulated-serif",
    processStyle: "list-compact",
    showKeyTiles: false,
    showDeliveryPreview: true,
    toneLabel: "Considered",
    sections: [
      "hero",
      "challenges",
      "skills-tools",
      "role-explorer",
      "signal-explorer",
      "delivery-preview",
      "solutions",
      "process",
      "faq",
      "related",
      "insights",
      "cta",
    ],
  },
  "human-portrait": {
    archetype: "human-portrait",
    heroVariant: "human-portrait",
    processStyle: "stepped-timeline",
    showKeyTiles: false,
    showDeliveryPreview: false,
    toneLabel: "Care & mission",
    sections: [
      "hero",
      "role-explorer",
      "challenges",
      "skills-tools",
      "signal-explorer",
      "solutions",
      "process",
      "insights",
      "faq",
      "related",
      "cta",
    ],
  },
  "commercial-momentum": {
    archetype: "commercial-momentum",
    heroVariant: "commercial-momentum",
    processStyle: "numbered-cards",
    showKeyTiles: true,
    showDeliveryPreview: true,
    toneLabel: "Momentum",
    sections: [
      "hero",
      "key-tiles",
      "role-explorer",
      "challenges",
      "delivery-preview",
      "signal-explorer",
      "solutions",
      "process",
      "keyword-links",
      "related",
      "insights",
      "cta",
    ],
  },
};

/**
 * Map every industry slug (data-side keys) to an archetype. All 57 industries
 * are covered — new industries added to `industries-v2` fall through to
 * `data-dense` if missing here.
 */
export const INDUSTRY_ARCHETYPE: Record<string, IndustryArchetype> = {
  // Tech & Data — data-dense
  tech: "data-dense",
  saas: "data-dense",
  "data-analytics": "data-dense",
  "ai-ml": "data-dense",
  fintech: "data-dense",
  devops: "data-dense",
  web3: "data-dense",
  gaming: "data-dense",
  "product-management": "data-dense",
  cybersecurity: "commercial-momentum",
  telecom: "commercial-momentum",

  // Built environment & industrial — field-report
  construction: "field-report",
  manufacturing: "field-report",
  energy: "field-report",
  "renewable-energy": "field-report",
  "oil-gas": "field-report",
  logistics: "field-report",
  automotive: "field-report",
  architecture: "field-report",
  agriculture: "field-report",
  aviation: "field-report",
  defense: "field-report",

  // Regulated / considered — regulated-serif
  legal: "regulated-serif",
  finance: "regulated-serif",
  "investment-banking": "regulated-serif",
  insurance: "regulated-serif",
  "private-equity": "regulated-serif",
  "wealth-management": "regulated-serif",
  "venture-capital": "regulated-serif",
  accounting: "regulated-serif",
  "public-sector": "regulated-serif",

  // Care & mission — human-portrait
  healthcare: "human-portrait",
  nonprofit: "human-portrait",
  education: "human-portrait",
  "higher-education": "human-portrait",
  pharmaceuticals: "human-portrait",
  biotech: "human-portrait",
  "medical-devices": "human-portrait",
  healthtech: "human-portrait",
  edtech: "human-portrait",
  "human-resources": "human-portrait",

  // Go-to-market & services — commercial-momentum
  sales: "commercial-momentum",
  marketing: "commercial-momentum",
  consulting: "commercial-momentum",
  "staffing-agencies": "commercial-momentum",
  ecommerce: "commercial-momentum",
  "real-estate": "commercial-momentum",
  proptech: "commercial-momentum",
  "customer-success": "commercial-momentum",
  design: "commercial-momentum",

  // Consumer & lifestyle — cinematic-editorial
  hospitality: "cinematic-editorial",
  retail: "cinematic-editorial",
  media: "cinematic-editorial",
  travel: "cinematic-editorial",
  sports: "cinematic-editorial",
  fashion: "cinematic-editorial",
  "food-beverage": "cinematic-editorial",
};

export function getArchetypeForSlug(slug: string): ArchetypeSpec {
  const key = INDUSTRY_ARCHETYPE[slug] ?? "data-dense";
  return ARCHETYPE_SPECS[key];
}
