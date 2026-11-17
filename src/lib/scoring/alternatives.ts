/**
 * Lists of alternatives (v1.8.0).
 *
 * "Experiência com empilhadeira ou selecionadora de pedidos" and
 * "Experiência em armazém, estoque, logística ou centro de distribuição" ask
 * for any one of the things named. Counting the share of keywords found, a
 * forklift operator matched one of three and read as partial. Capitalised
 * lists ("QuickBooks, Xero or Sage") were already read as alternatives; this
 * reads plain ones too, but only a plain list: every item one to three words,
 * joined by commas and a final "ou" (Portuguese) or "o" (Spanish), nothing
 * joined by "e", "y" or "com".
 *
 * Lists written in English are left as they were. The same reading would
 * lift 29 Group Marketing Manager candidates by 2.5 points on "retail,
 * shopping malls, … or mixed use", so it waits for the owner to apply it
 * there; scores on one role must not depend on when a candidate applied.
 */
import { tokenizeForList } from "./alternatives-tokens";

const FRAMING_PREFIX =
  /^\s*(?:(?:hands-on\s+|practical\s+|proven\s+|prior\s+|previous\s+)?(?:experience|experiência|experiencia|vivência|knowledge|conhecimento|conocimiento|familiarity)\s+(?:with|in|of|on|com|em|de|en|con)\s+)/i;
const FINAL_OR = /\s+(?:ou|o)\s+/i;
const JOINER = /\b(?:and|e|y|plus|with|com|con|including|incluindo|such|like|as|bem)\b|&|\+/i;

/** The items of a plain list of alternatives, as keyword sets, or null. */
export function alternativeItems(text: string, framing: ReadonlySet<string>): string[][] | null {
  const body = text
    .replace(FRAMING_PREFIX, "")
    .replace(/[.;:]\s*$/, "")
    .trim();
  if (!FINAL_OR.test(body)) return null;
  // One sentence only: a colon or a second clause is not a list.
  if (/[:;()]/.test(body)) return null;
  const items = body
    .split(/\s*,\s*|\s+(?:ou|o)\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);
  if (items.length < 2) return null;
  const out: string[][] = [];
  for (const item of items) {
    const words = item.split(/\s+/);
    if (words.length > 3 || JOINER.test(item)) return null;
    const kws = tokenizeForList(item).filter((t) => !framing.has(t));
    if (kws.length === 0) return null;
    out.push(kws);
  }
  return out;
}

/** True when every keyword of one item was found. */
export function anyItemMet(items: string[][] | null, matched: readonly string[]): boolean {
  if (!items) return false;
  const found = new Set(matched.map((m) => m.toLowerCase()));
  return items.some((kws) => kws.every((k) => found.has(k)));
}
