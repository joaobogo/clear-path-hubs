/**
 * Human label for a raw enum-ish value ("under_review" -> "Under review").
 * Used where a screen would otherwise render the stored lowercase status.
 */
export function sentenceLabel(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const words = String(value).trim().replace(/_/g, " ");
  if (!words) return undefined;
  return words.charAt(0).toUpperCase() + words.slice(1);
}
