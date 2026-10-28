/** National origin is never a hiring criterion; work authorisation is separate. */
export function isProtectedAttributeText(text: string): boolean {
  return /\bnationalit(?:y|ies)\b|\bethnic(?:ity|ities)?\b|\bcitizenship\b|\bheritage\b|\brace\b|\bracial\b|\bcountry of (?:birth|origin)\b|\b(?:must|needs? to|should) be (?:Korean|Singaporean|Chinese|Indian|Egyptian)\b/i.test(text);
}

export function removeProtectedSentences(text: string): string {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((sentence) => !isProtectedAttributeText(sentence)).join(" ");
}