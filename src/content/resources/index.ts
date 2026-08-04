import { FOUNDATION_GUIDES } from "./guides-foundations";
import { COMPARISON_GUIDES } from "./guides-comparisons";
import { OPERATIONS_GUIDES } from "./guides-operations";
import type { GuideCategory, ResourceGuide } from "./types";

export type { ResourceGuide, GuideCategory, GuideSection, GuideBlock } from "./types";
export { GUIDE_CATEGORIES } from "./types";

/**
 * The TaaSFlow authority library — evergreen pillar guides at
 * /resources/<slug>. Ordered for the library index: foundations first,
 * then the model comparisons, then operational playbooks.
 */
export const RESOURCE_GUIDES: ResourceGuide[] = [
  ...FOUNDATION_GUIDES,
  ...COMPARISON_GUIDES,
  ...OPERATIONS_GUIDES,
];

const BY_SLUG = new Map(RESOURCE_GUIDES.map((g) => [g.slug, g]));

export function getResourceGuide(slug: string): ResourceGuide | undefined {
  return BY_SLUG.get(slug);
}

export function listResourceGuideSlugs(): string[] {
  return RESOURCE_GUIDES.map((g) => g.slug);
}

export function guidesByCategory(category: GuideCategory): ResourceGuide[] {
  return RESOURCE_GUIDES.filter((g) => g.category === category);
}

/** Rough read time from the rendered blocks — no external dependency. */
export function guideReadMinutes(guide: ResourceGuide): number {
  let words = 0;
  const count = (s: string) => {
    words += s.trim().split(/\s+/).length;
  };
  count(guide.summary);
  for (const section of guide.sections) {
    count(section.heading);
    for (const block of section.blocks) {
      if (block.kind === "p") count(block.text);
      else if (block.kind === "bullets") block.items.forEach(count);
      else if (block.kind === "steps")
        block.items.forEach((i) => {
          count(i.label);
          count(i.text);
        });
      else if (block.kind === "table")
        block.rows.forEach((row) => row.forEach(count));
      else if (block.kind === "callout") {
        count(block.title);
        count(block.text);
      }
    }
  }
  for (const faq of guide.faqs) {
    count(faq.q);
    count(faq.a);
  }
  return Math.max(3, Math.round(words / 220));
}
