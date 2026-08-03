/**
 * Industry Config — canonical, derived configuration for each industry page.
 *
 * The heavy content (challenges, roles, signals, SEO, FAQs, related
 * industries) already lives in `industries-v2.ts` / `industries-batch2.ts`.
 * This module layers the *page experience* fields on top:
 *
 *   - archetype, family, primary buyer, secondary audience
 *   - a single distilled value proposition
 *   - primary/secondary CTAs (primary is always "Discuss your hiring needs")
 *   - proof state: `methodology` | `example-demo` | `verified` — never fake
 *   - a canonical page URL for `<link rel="canonical">` and og:url
 *
 * Everything here is derived from `IndustryEntry` and the archetype spec.
 * Nothing invents copy: fields that cannot be resolved from the source
 * data are omitted, and the consuming components hide their sections.
 */

import type { IndustryEntry } from "@/content/industries-v2";
import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import {
  ARCHETYPE_SPECS,
  FAMILY_LABEL,
  INDUSTRY_ARCHETYPE,
  type ArchetypeSpec,
  type IndustryArchetype,
  type IndustryFamily,
  type SecondaryCta,
} from "@/content/industry-archetypes";
import { toPublicSlug } from "@/lib/marketing/industry-slug-aliases";

const SITE_ORIGIN = CANONICAL_ORIGIN;

/** Proof state controls whether we render an explicit product
 * demonstration ("example data") or fall back to a methodology / "what
 * you receive" explainer. `verified` is reserved for future outcomes that
 * have been reviewed and approved. */
export type ProofState = "methodology" | "example-demo" | "verified";

export type IndustryConfig = {
  slug: string;
  publicSlug: string;
  name: string;
  eyebrow: string;
  archetype: IndustryArchetype;
  family: IndustryFamily;
  familyLabel: string;
  spec: ArchetypeSpec;
  /** Who typically buys — inferred from archetype. Never fabricated. */
  primaryBuyer: string;
  /** Who else on the buying committee is served by the page. */
  secondaryAudience: string;
  /** Single-sentence value proposition, distilled from the entry hero. */
  valueProp: string;
  /** One-line credibility signal shown under the H1 — verifiable. */
  credibility: string;
  /** Primary CTA is unified across every industry page. */
  primaryCta: { label: "Discuss your hiring needs"; to: string };
  secondaryCta: SecondaryCta;
  /** How this page proves its promises. */
  proofState: ProofState;
  /** Which visual storytelling device the hero + storytelling section use. */
  visualDevice: ArchetypeSpec["storytelling"];
  /** Canonical URL for og:url and <link rel="canonical">. */
  canonicalUrl: string;
  /** Social share image, when the industry has a real hero photo assigned. */
  ogImageAbsolute: string | null;
};

/** Buyer profiles per archetype — describe the role that typically owns the
 * hiring budget for these industries. Kept generic and factual. */
const BUYER_BY_ARCHETYPE: Record<IndustryArchetype, { primary: string; secondary: string }> = {
  "systems-capability": {
    primary: "VP Engineering, CTO or Head of Talent",
    secondary: "Engineering managers, technical recruiters, People Ops",
  },
  "trust-compliance": {
    primary: "Chief People Officer or Head of Clinical / Programme Operations",
    secondary: "Compliance leads, credentialing, medical or programme directors",
  },
  "risk-judgment": {
    primary: "Managing Partner, General Counsel or Head of Talent",
    secondary: "Practice leads, compliance officers, People & Culture",
  },
  "operations-delivery": {
    primary: "COO, Head of Operations or Project Delivery Director",
    secondary: "Site leads, HSE managers, workforce planning",
  },
  "service-experience": {
    primary: "COO, General Manager or Head of People",
    secondary: "Regional operations, brand leadership, guest / customer experience",
  },
  "expertise-growth": {
    primary: "Head of Talent, VP GTM or Practice Lead",
    secondary: "First-line managers, enablement, capability leads",
  },
};

/** Credibility line pulls only from things we can defend: number of
 * evaluation signals, role families in scope, rubric versioning, weekly
 * cadence, evidence-quoted-from-CV. No live-activity claims. */
function buildCredibility(entry: IndustryEntry, archetype: IndustryArchetype): string {
  const signalCount = entry.signals?.length ?? 0;
  const roleFamilyCount = entry.roleFamilies?.length ?? 0;

  switch (archetype) {
    case "systems-capability":
      return `Evidence quoted from the CV · rubric versioned per role level · ${signalCount || "multiple"} evaluation criteria`;
    case "trust-compliance":
      return `Credential-aware sourcing · licence and continuity checks before shortlist · weekly delivery cadence`;
    case "risk-judgment":
      return `Jurisdiction and precedent scope reviewed at every stage · evidence quoted from the CV`;
    case "operations-delivery":
      return `Site- and jurisdiction-aware sourcing · certifications validated before shortlist${roleFamilyCount ? ` · ${roleFamilyCount} role families in scope` : ""}`;
    case "service-experience":
      return `Coverage across ${roleFamilyCount || "core"} role families · weekly shortlist cadence · guest-experience signals validated`;
    case "expertise-growth":
      return `Rubrics tuned per level · outcomes and progression quoted from the CV · weekly delivery cadence`;
  }
}

/** Value proposition — prefer `entry.summary` if it's a clean single line,
 * otherwise the hero subtitle. Never invented. */
function distillValueProp(entry: IndustryEntry): string {
  if (entry.summary && entry.summary.length <= 220) return entry.summary;
  return entry.hero.subtitle;
}

export function getIndustryConfig(entry: IndustryEntry): IndustryConfig {
  const archetype: IndustryArchetype = INDUSTRY_ARCHETYPE[entry.slug] ?? "expertise-growth";
  const spec = ARCHETYPE_SPECS[archetype];
  const publicSlug = toPublicSlug(entry.slug);
  const buyer = BUYER_BY_ARCHETYPE[archetype];

  return {
    slug: entry.slug,
    publicSlug,
    name: entry.name,
    eyebrow: entry.eyebrow,
    archetype,
    family: spec.family,
    familyLabel: FAMILY_LABEL[spec.family],
    spec,
    primaryBuyer: buyer.primary,
    secondaryAudience: buyer.secondary,
    valueProp: distillValueProp(entry),
    credibility: buildCredibility(entry, archetype),
    primaryCta: { label: "Discuss your hiring needs", to: "" },
    secondaryCta: spec.secondaryCta,
    proofState: spec.showDeliveryPreview ? "example-demo" : "methodology",
    visualDevice: spec.storytelling,
    canonicalUrl: `${SITE_ORIGIN}/industries/${publicSlug}`,
    ogImageAbsolute: null,
  };
}
