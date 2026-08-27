/**
 * Public display name for an organisation.
 *
 * Internal bookkeeping suffixes — "(Demo)", "[Test]", "- Sandbox" — exist so
 * staff can tell workspaces apart. They must never reach a candidate or the
 * open internet, so every public surface renders the name through this helper
 * instead of printing the stored value.
 */

const INTERNAL_WORDS =
  "demo|demonstration|test|tests|testing|qa|q\\.a\\.|sandbox|staging|stage|internal|sample|dummy|fixture|seed|example|poc|pilot demo";

const PATTERNS: readonly RegExp[] = [
  // Trailing bracketed marker: "Northwind Talent (Demo)", "Acme [QA]", "Acme {test}"
  new RegExp(`[\\s\\u00a0]*[([{]\\s*(?:${INTERNAL_WORDS})\\s*[)\\]}]\\s*$`, "i"),
  // Trailing dash/colon/pipe marker: "Acme - Demo", "Acme — test", "Acme | Sandbox"
  new RegExp(`[\\s\\u00a0]*[-–—:|·]+\\s*(?:${INTERNAL_WORDS})\\s*$`, "i"),
];

/** Strips internal-only suffixes from an organisation name for public display. */
export function publicOrgName(name: string | null | undefined): string {
  let out = typeof name === "string" ? name.trim() : "";
  if (!out) return "";
  // Repeat: a name can carry more than one marker ("Acme (Demo) - test").
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const pattern of PATTERNS) {
      const next = out.replace(pattern, "").trim();
      if (next !== out && next.length > 0) {
        out = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

/** Same as `publicOrgName`, falling back when nothing usable remains. */
export function publicOrgNameOr(
  name: string | null | undefined,
  fallback: string,
): string {
  const cleaned = publicOrgName(name);
  return cleaned.length > 0 ? cleaned : fallback;
}
