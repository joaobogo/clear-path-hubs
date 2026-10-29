/** National origin is never a hiring criterion; work authorisation is separate. */
export function isProtectedAttributeText(text: string): boolean {
  return /\bnationalit(?:y|ies)\b|\bethnic(?:ity|ities)?\b|\bcitizenship\b|\bheritage\b|\brace\b|\bracial\b|\bcountry of (?:birth|origin)\b|\b(?:passport|ancestry|descent|national origin|OCI)\b|\b(?:is|as|an?|be|born|native)\s+(?:Korean|Singaporean|Chinese|Indian|Egyptian|British|Irish|Pakistani|Sri Lankan|Vietnamese|Japanese|Emirati|Arab)\b|\b(?:Korean|Singaporean|Chinese|Indian|Egyptian|British|Irish|Pakistani|Sri Lankan|Vietnamese|Japanese|Emirati|Arab)\s+(?:candidate|national|citizen|origin|background|roots)\b/i.test(text);
}

/** Scrub every nested generated text field without touching raw source documents. */
export function sanitizeGeneratedText<T>(value: T): T {
  if (typeof value === "string") return removeProtectedSentences(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeGeneratedText).filter((item) => item !== "") as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeGeneratedText(item)])) as T;
  }
  return value;
}

export function removeProtectedSentences(text: string): string {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((sentence) => !isProtectedAttributeText(sentence)).join(" ");
}
