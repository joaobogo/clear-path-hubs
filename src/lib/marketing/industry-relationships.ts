/**
 * Industry Relationship Engine.
 *
 * Builds a deterministic, meaningful relationship graph across all industry
 * pages so no page is an orphan and every page becomes a content hub:
 *
 *   - 3–5 related industries (same category first, then adjacent categories)
 *   - 2 hiring guides + 1 pricing/commercial explainer + 1 process explainer
 *     + 1 category-relevant article
 *   - One commercial anchor (pricing/agency comparison)
 *   - One audience anchor (solutions / enterprise / staffing partnership)
 *   - A guaranteed "Start Hiring" CTA
 *
 * Consumed by `industry-template.tsx` — safe to call for every entry.
 */
import { INDUSTRY_ENTRIES, type IndustryEntry, type IndustryRelated, type IndustryResource } from "@/content/industries-v2";
import { listIndustryBlogPosts } from "@/lib/marketing/industry-blog";

/** Adjacency between industry categories. Only meaningful pairings. */
const CATEGORY_ADJACENCY: Record<string, string[]> = {
  "Tech & Data": ["Financial Services", "Regulated & Public", "People & GTM", "Go-to-Market"],
  "Financial Services": ["Professional Services", "Tech & Data", "Regulated & Public"],
  "Regulated & Public": ["Financial Services", "Professional Services", "People & Advisory"],
  "Go-to-Market": ["People & GTM", "Consumer & Operations", "Tech & Data"],
  "People & GTM": ["Go-to-Market", "People & Advisory", "Tech & Data"],
  "People & Advisory": ["Professional Services", "People & GTM", "Regulated & Public"],
  "Professional Services": ["Financial Services", "People & Advisory", "Regulated & Public"],
  "Built Environment & Industrial": ["Operations & Services", "Consumer & Operations", "Regulated & Public"],
  "Operations & Services": ["Built Environment & Industrial", "Consumer & Operations"],
  "Consumer & Operations": ["Operations & Services", "Go-to-Market", "Built Environment & Industrial"],
};

/** Category → audience anchor. Every category resolves. */
const CATEGORY_AUDIENCE: Record<string, { to: string; label: string; blurb: string }> = {
  "Tech & Data": { to: "/solutions", label: "For scaling tech operators", blurb: "How Series A–C teams hire engineering and data talent through TaaSFlow." },
  "Financial Services": { to: "/enterprise", label: "For finance leaders", blurb: "Executive-grade governance for regulated hiring." },
  "Regulated & Public": { to: "/enterprise", label: "For regulated operators", blurb: "Audit trails and compliance-ready workflow." },
  "Go-to-Market": { to: "/solutions", label: "For revenue teams", blurb: "Ranked GTM shortlists tied to quota-carrying evidence." },
  "People & GTM": { to: "/solutions", label: "For people and revenue leaders", blurb: "Structured intake for hybrid people/GTM roles." },
  "People & Advisory": { to: "/partnerships/staffing", label: "For staffing and advisory teams", blurb: "Extend your desk with an on-demand delivery layer." },
  "Professional Services": { to: "/enterprise", label: "For partner-led firms", blurb: "Confidential sourcing for principal and partner-track hires." },
  "Built Environment & Industrial": { to: "/enterprise", label: "For industrial operators", blurb: "Site-aware sourcing with certifications validated up front." },
  "Operations & Services": { to: "/solutions", label: "For operations leaders", blurb: "Structured hiring for multi-site and services teams." },
  "Consumer & Operations": { to: "/solutions", label: "For consumer operators", blurb: "Volume plus specialist hiring on one workflow." },
};

const DEFAULT_AUDIENCE = { to: "/solutions", label: "See solutions", blurb: "How TaaSFlow adapts to your team." };

const COMMERCIAL_ANCHOR = {
  to: "/pricing",
  kind: "Commercial",
  title: "TaaSFlow pricing",
  description: "Subscription pricing, no placement fees — three tiers from $2.4k.",
};

const PROCESS_ANCHOR: IndustryResource = {
  to: "/how-it-works",
  kind: "Process",
  title: "How TaaSFlow works",
  description: "The full workflow: intake, sourcing, evidence review, delivery.",
};

const PRICING_EXPLAINER: IndustryResource = {
  to: "/pricing",
  kind: "Commercial",
  title: "TaaSFlow pricing tiers",
  description: "Subscription pricing, no placement fees.",
};

/** Category → curated hiring-guide blog slug fallbacks (must exist under /blog/$slug). */
const CATEGORY_GUIDE_FALLBACKS: Record<string, string[]> = {
  "Tech & Data": ["ai-in-recruitment", "ats-optimization-guide"],
  "Financial Services": ["accounting-firm-recruitment-strategies", "accounting-hiring-benchmarks-2026"],
  "Regulated & Public": ["ats-implementation-guide", "ai-screening-ethics"],
  "Go-to-Market": ["30-60-90-onboarding-plan-2026", "ats-optimization-guide"],
  "People & GTM": ["30-60-90-onboarding-plan-2026", "ats-optimization-guide"],
  "People & Advisory": ["ats-implementation-guide", "ai-in-recruitment"],
  "Professional Services": ["ats-implementation-guide", "ai-in-recruitment"],
  "Built Environment & Industrial": ["ats-implementation-guide", "ai-in-recruitment"],
  "Operations & Services": ["ats-optimization-guide", "ai-in-recruitment"],
  "Consumer & Operations": ["30-60-90-onboarding-plan-2026", "ats-optimization-guide"],
};

/** Category → "read next" article fallback when no industry post exists. */
const CATEGORY_ARTICLE_FALLBACK: Record<string, string> = {
  "Tech & Data": "ai-reshaping-every-industry-hiring",
  "Financial Services": "ai-reshaping-every-industry-hiring",
  "Regulated & Public": "ai-screening-ethics",
  "Go-to-Market": "ai-replacing-vs-augmenting-recruiters",
  "People & GTM": "ai-replacing-vs-augmenting-recruiters",
  "People & Advisory": "ai-in-recruitment",
  "Professional Services": "ai-in-recruitment",
  "Built Environment & Industrial": "ai-workforce-planning-2030",
  "Operations & Services": "ai-workforce-planning-2030",
  "Consumer & Operations": "ai-impact-on-jobs-hiring",
};

export type IndustryRelationshipBundle = {
  related: IndustryRelated[];
  resources: IndustryResource[];
  commercial: { to: string; label: string };
  audience: { to: string; label: string; blurb: string };
  startHiring: { to: "/intake"; label: "Start hiring" };
};

function pickRelated(entry: IndustryEntry): IndustryRelated[] {
  const category = entry.category ?? "";
  const seen = new Set<string>([entry.slug]);
  const out: IndustryRelated[] = [];

  // 1. Author-provided related industries (already meaningful).
  for (const r of entry.relatedIndustries ?? []) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    out.push(r);
    if (out.length >= 4) return out;
  }

  // 2. Same-category siblings.
  for (const sib of INDUSTRY_ENTRIES) {
    if (seen.has(sib.slug)) continue;
    if (sib.category !== category) continue;
    out.push({ slug: sib.slug, name: sib.name, blurb: sib.summary?.slice(0, 120) });
    seen.add(sib.slug);
    if (out.length >= 4) return out;
  }

  // 3. Adjacent categories.
  const adjacent = new Set(CATEGORY_ADJACENCY[category] ?? []);
  for (const sib of INDUSTRY_ENTRIES) {
    if (seen.has(sib.slug)) continue;
    if (!adjacent.has(sib.category ?? "")) continue;
    out.push({ slug: sib.slug, name: sib.name, blurb: sib.summary?.slice(0, 120) });
    seen.add(sib.slug);
    if (out.length >= 4) return out;
  }

  // 4. Absolute fallback — any other industry — guarantees no orphans.
  for (const sib of INDUSTRY_ENTRIES) {
    if (seen.has(sib.slug)) continue;
    out.push({ slug: sib.slug, name: sib.name, blurb: sib.summary?.slice(0, 120) });
    seen.add(sib.slug);
    if (out.length >= 4) return out;
  }
  return out;
}

function pickResources(entry: IndustryEntry): IndustryResource[] {
  const posts = listIndustryBlogPosts(entry.slug);
  const category = entry.category ?? "";
  const guides: IndustryResource[] = [];

  // 2 hiring guides — prefer industry-specific posts.
  const preferredTopics = ["hiring-benchmarks-2026", "top-roles-compensation-2026"];
  for (const topic of preferredTopics) {
    const match = posts.find((p) => p.topic === topic);
    if (match && guides.length < 2) {
      guides.push({
        to: `/blog/${match.slug}`,
        kind: "Hiring guide",
        title: match.title,
        description: match.description,
      });
    }
  }
  // Fill remaining with any industry posts, then category fallback slugs.
  if (guides.length < 2) {
    for (const p of posts) {
      if (guides.some((g) => g.to === `/blog/${p.slug}`)) continue;
      guides.push({
        to: `/blog/${p.slug}`,
        kind: "Hiring guide",
        title: p.title,
        description: p.description,
      });
      if (guides.length >= 2) break;
    }
  }
  if (guides.length < 2) {
    for (const slug of CATEGORY_GUIDE_FALLBACKS[category] ?? ["ai-in-recruitment", "ats-optimization-guide"]) {
      if (guides.some((g) => g.to === `/blog/${slug}`)) continue;
      guides.push({
        to: `/blog/${slug}`,
        kind: "Hiring guide",
        title: prettyTitle(slug),
        description: `Category playbook for ${category || entry.name}.`,
      });
      if (guides.length >= 2) break;
    }
  }

  // 1 category-relevant article — prefer a workforce/emerging-skills post, else fallback.
  let categoryArticle: IndustryResource | null = null;
  const preferredArticle = posts.find((p) =>
    ["emerging-skills-shift-2026", "workforce-outlook-2026", "retention-culture-playbook"].includes(p.topic ?? "")
  );
  if (preferredArticle && !guides.some((g) => g.to === `/blog/${preferredArticle.slug}`)) {
    categoryArticle = {
      to: `/blog/${preferredArticle.slug}`,
      kind: "Insight",
      title: preferredArticle.title,
      description: preferredArticle.description,
    };
  } else {
    const fallbackSlug = CATEGORY_ARTICLE_FALLBACK[category] ?? "ai-in-recruitment";
    if (!guides.some((g) => g.to === `/blog/${fallbackSlug}`)) {
      categoryArticle = {
        to: `/blog/${fallbackSlug}`,
        kind: "Insight",
        title: prettyTitle(fallbackSlug),
        description: `Category perspective for ${category || entry.name} hiring teams.`,
      };
    }
  }

  const out: IndustryResource[] = [...guides, PRICING_EXPLAINER, PROCESS_ANCHOR];
  if (categoryArticle) out.push(categoryArticle);
  return out;
}

function prettyTitle(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(\d{4})\b/, "$1");
}

export function getIndustryRelationships(entry: IndustryEntry): IndustryRelationshipBundle {
  const audience = CATEGORY_AUDIENCE[entry.category ?? ""] ?? DEFAULT_AUDIENCE;
  return {
    related: pickRelated(entry),
    resources: pickResources(entry),
    commercial: { to: COMMERCIAL_ANCHOR.to, label: "View pricing" },
    audience: { to: audience.to, label: audience.label, blurb: audience.blurb },
    startHiring: { to: "/intake", label: "Start hiring" },
  };
}

/** QA helper — used by scripts to certify every industry has a complete bundle. */
export function certifyIndustryBundle(entry: IndustryEntry): { slug: string; passes: boolean; missing: string[] } {
  const bundle = getIndustryRelationships(entry);
  const missing: string[] = [];
  if (bundle.related.length < 3) missing.push(`related<3 (${bundle.related.length})`);
  const hasTwoGuides = bundle.resources.filter((r) => r.kind === "Hiring guide").length >= 2;
  const hasCommercial = bundle.resources.some((r) => r.kind === "Commercial");
  const hasProcess = bundle.resources.some((r) => r.kind === "Process");
  const hasInsight = bundle.resources.some((r) => r.kind === "Insight");
  if (!hasTwoGuides) missing.push("2 hiring guides");
  if (!hasCommercial) missing.push("commercial");
  if (!hasProcess) missing.push("process");
  if (!hasInsight) missing.push("category article");
  if (!entry.hero?.title) missing.push("hero.title");
  if (!entry.meta?.description) missing.push("meta.description");
  if (!entry.cta?.title) missing.push("cta");
  if (!entry.roleFamilies?.length && !entry.roles?.length) missing.push("roles");
  if (!entry.candidateSignals?.length) missing.push("candidateSignals");
  return { slug: entry.slug, passes: missing.length === 0, missing };
}
