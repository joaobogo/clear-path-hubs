import bank from "./industry-evidence-bank.json";

/**
 * Per-industry illustrative example bank.
 *
 * Illustrative "sample evidence" used to come from function-level templates
 * shared by every vertical, which put the same quote verbatim on several
 * /industries/* pages. Each industry now draws from its own entry here, and
 * scripts/scaled-content-check.mjs fails the build if any string is reused.
 *
 * Regenerate with: bun scripts/generate-industry-evidence-bank.mjs
 */
type Flags = { good: string; bad: string };
type IndustryBank = {
  roleEvidence: Record<string, string | undefined>;
  signalFlags: Record<string, Flags | undefined>;
};

const INDUSTRIES = (bank as { industries: Record<string, IndustryBank> }).industries;

export function getRoleEvidence(slug: string, fn: string): string | null {
  const entry = INDUSTRIES[slug];
  if (!entry) return null;
  return entry.roleEvidence[fn] ?? entry.roleEvidence["generic"] ?? null;
}

export function getSignalFlags(slug: string, signalKey: string): Flags | null {
  return INDUSTRIES[slug]?.signalFlags[signalKey] ?? null;
}
