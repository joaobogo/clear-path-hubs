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

/**
 * Drop the sentences (and bar- or bullet-separated fields) that state a
 * protected attribute, keeping everything else exactly where it was.
 *
 * Line breaks are kept. The scorer reads a CV line by line (the header for
 * where someone lives, the line above a date for the job title, the education
 * section for degrees), so joining the CV into one line would cost every
 * candidate that structure. Only what states the attribute goes:
 * "Nationality: Indian | Dubai, UAE" keeps "Dubai, UAE".
 */
export function removeProtectedSentences(text: string): string {
  const kept: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    // Pieces alternate with the separators that joined them.
    const parts = line.split(/((?<=[.!?])\s+|\s*[|•·]\s*)/);
    let out = "";
    for (let i = 0; i < parts.length; i += 2) {
      const piece = parts[i] ?? "";
      if (isProtectedAttributeText(piece)) continue;
      out += (out && i > 0 ? (parts[i - 1] ?? " ") : "") + piece;
    }
    // A line that held only the attribute goes; a line that was already blank stays.
    if (out.trim() || !line.trim()) kept.push(out);
  }
  return kept.join("\n");
}
