/**
 * Display guards for the candidate briefing (admin candidate page).
 *
 * The briefing is stored text that both the model and recruiters write. When a
 * recruiter edit is merged into the model's text instead of replacing it, the
 * page showed the same paragraph twice (once as the pitch, again as the
 * narrative), repeated highlights, and shortfall items whose detail began by
 * repeating their own title ("Retail tenant marketing: Retail tenant
 * marketing: ..."). Stratium Partners, 29 Oct 2026. These guards make the page
 * show each thing once whatever the stored data contains; they never change
 * the stored text.
 */

/** Lower-case, collapse whitespace and drop trailing punctuation for comparison. */
export function normaliseForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/[\s.;:,]+$/g, "")
    .trim();
}

/**
 * The narrative to show under the pitch, or null when it would only repeat the
 * pitch (identical, or wholly contained in it).
 */
export function narrativeToShow(pitch: unknown, narrative: unknown): string | null {
  if (typeof narrative !== "string" || !narrative.trim()) return null;
  if (typeof pitch !== "string" || !pitch.trim()) return narrative;
  const p = normaliseForCompare(pitch);
  const n = normaliseForCompare(narrative);
  if (n === p || p.includes(n)) return null;
  return narrative;
}

/** Highlights with exact repeats (after normalising) removed, first occurrence kept. */
export function uniqueHighlights(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const key = normaliseForCompare(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

/** A detail that opens by repeating its own title ("Title: text") loses the repeat. */
export function detailWithoutTitle(title: unknown, detail: unknown): string | null {
  if (typeof detail !== "string" || !detail.trim()) return null;
  if (typeof title !== "string" || !title.trim()) return detail;
  const t = title.trim();
  const re = new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-–—]\\s*`, "i");
  const stripped = detail.replace(re, "");
  if (!stripped.trim()) return detail;
  return stripped === detail ? detail : stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

/** Items with the same title (after normalising) collapse to the first one. */
export function uniqueByTitle<T extends { title?: unknown }>(items: unknown): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items as T[]) {
    const key = typeof item?.title === "string" ? normaliseForCompare(item.title) : "";
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
  }
  return out;
}
