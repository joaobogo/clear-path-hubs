/**
 * The engine's tokenizer, without its imports (alternatives.ts is read by the
 * engine itself). Kept in step with tokenize() in scoring-engine.server.ts by
 * the alternatives test.
 */
const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "at",
  "from",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "para",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "com",
  "ou",
  "um",
  "uma",
  "del",
  "los",
  "las",
  "el",
  "en",
  "con",
  "y",
  "e",
  "o",
]);

export function tokenizeForList(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}+.#-]{2,}/gu) ?? []).filter((t) => !STOP.has(t));
}
