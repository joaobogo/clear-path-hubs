/**
 * Verified competitor facts — the only place a competitor fact may live.
 *
 * Rule: a fact is added here only after someone opens the competitor's OWN
 * public page and reads it. Every entry carries the page it came from and the
 * date it was read. Third-party write-ups, search snippets and audit figures
 * do not count. If a fact cannot be verified, it is not added and it does not
 * appear on any page.
 *
 * Status on 7 October 2026: no entries. The research session could not open
 * any competitor page (the page-reading tool had no credits and direct
 * fetches were blocked), so nothing was verified. The comparison pages are
 * therefore model-level only. Add entries here, then add a competitor page.
 */

export type CompetitorFact = {
  competitor: string;
  /** What the fact is about, e.g. "pricing model", "public price", "included". */
  topic: "pricing-model" | "public-price" | "included" | "other";
  /** The fact, phrased as the competitor states it. */
  statement: string;
  /** The competitor's own public page. */
  sourceUrl: string;
  /** ISO date the page was read, e.g. "2026-10-07". */
  accessedOn: string;
};

export const COMPETITOR_FACTS: readonly CompetitorFact[] = [];

/** Competitors researched and not published, with the reason. Internal record. */
export const UNVERIFIED_COMPETITORS = [
  { name: "Paraform", reason: "Own pages could not be opened on 7 October 2026." },
  { name: "Wellfound", reason: "Own pages could not be opened on 7 October 2026." },
  { name: "Persevus", reason: "Own pages could not be opened on 7 October 2026." },
  { name: "HighFive", reason: "Own pages could not be opened on 7 October 2026." },
  { name: "Dover", reason: "Own pages could not be opened on 7 October 2026." },
  { name: "Juicebox", reason: "Own pages could not be opened on 7 October 2026." },
  { name: "hireEZ", reason: "Own pages could not be opened on 7 October 2026." },
  { name: "Pin", reason: "Own pages could not be opened on 7 October 2026." },
] as const;

export function factsFor(competitor: string): CompetitorFact[] {
  return COMPETITOR_FACTS.filter((f) => f.competitor === competitor);
}
