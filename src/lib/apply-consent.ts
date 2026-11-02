/**
 * Consent for a verified owner re-applying. The stored consent also carries
 * what CV hydration parsed (`extracted`), where each value came from
 * (`provenance`), the fields a person locked (`locked_fields`), what was
 * backfilled (`backfilled`) and notification choices. Replacing it wholesale
 * wiped all of that on every re-application; the parsed certifications were
 * lost whenever the re-hydration that followed fell back to the heuristic
 * parser. Only the application's own keys are updated.
 */
export function mergeReapplyConsent(
  existing: unknown,
  networkOptIn: boolean | undefined,
  now: Date = new Date(),
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return {
    ...base,
    terms: true,
    network_opt_in: networkOptIn,
    updated_at: now.toISOString(),
  };
}
