/**
 * Authority library types — the /resources/<slug> pillar collection.
 *
 * These guides are the evergreen, editorially-owned counterpart to the
 * high-volume /blog archive. Every field renders through
 * `src/routes/resources.$slug.tsx`; nothing here is generated at runtime and
 * nothing here asserts an outcome the product cannot evidence.
 */

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "steps"; items: Array<{ label: string; text: string }> }
  | {
      kind: "table";
      columns: string[];
      rows: string[][];
    }
  | { kind: "callout"; title: string; text: string }
  /** Renders the Cost of an Unfilled Position calculator inline. */
  | { kind: "calculator" };

export type GuideSection = {
  heading: string;
  blocks: GuideBlock[];
};

export type ResourceGuide = {
  slug: string;
  /** Short label used in cards, breadcrumbs and related lists. */
  title: string;
  /** Page H1 — may be longer and more specific than `title`. */
  h1: string;
  /** <title> tag. */
  metaTitle: string;
  /** Meta description, <158 chars. */
  metaDescription: string;
  category: GuideCategory;
  /** One-sentence promise shown under the H1 and on library cards. */
  summary: string;
  /** ISO date of the last substantive editorial revision. */
  updated: string;
  /** Who the guide is written for. */
  audience: string;
  sections: GuideSection[];
  faqs: Array<{ q: string; a: string }>;
  /** Product tie-in — capabilities only, never claimed results. */
  product: { heading: string; points: string[] };
  /** Slugs of sibling guides. */
  related: string[];
  /** Deeper commercial / explainer routes inside the app. */
  onward: Array<{ to: string; label: string; desc: string }>;
};

export type GuideCategory =
  | "Foundations"
  | "Comparisons"
  | "Operations"
  | "Economics";

export const GUIDE_CATEGORIES: GuideCategory[] = [
  "Foundations",
  "Comparisons",
  "Operations",
  "Economics",
];
