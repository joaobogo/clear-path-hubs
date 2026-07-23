// Client-safe terminology mapper.
//
// Rule: never lie. We translate internal ops mechanics into truthful,
// product-grade language for client-facing surfaces. Same event, cleaner name.
//
// Use `clientTerm(key)` in any client-facing UI. Keep raw internal labels
// visible only inside `/admin/*` staff surfaces.

export const CLIENT_TERMINOLOGY = {
  // Approval / review workflow
  admin_approval: "System validation",
  admin_approved: "Validated",
  admin_pending: "In validation",
  admin_rejected: "Not selected for shortlist",
  admin_on_hold: "Held for further review",
  manual_qa: "Evidence review",
  publish_desk: "Delivery queue",
  publish: "Deliver to workspace",
  published: "Delivered",

  // Pipeline / processing
  pipeline_repair: "Data refresh",
  pipeline_health: "Delivery reliability",
  pipeline_error: "Processing incident",
  ops_retry: "System reprocessing",
  ops_intervention: "System recovery",
  reprocess: "Refresh data",
  rescore: "Re-run evaluation",
  requeue: "Restart processing",

  // Scoring / evidence
  score_run: "Evaluation",
  score_engine: "Evaluation model",
  llm_verdict: "AI evidence review",
  contradiction_detected: "Conflicting signals found",
  raw_extraction: "Source data",
  hydration_failed: "Source data incomplete",
  cv_unreadable: "CV needs re-upload",

  // States
  parsing: "Preparing candidate",
  enriching: "Enriching profile",
  ready_to_score: "Ready for evaluation",
  scored: "Evaluation complete",
  queued: "In queue",
  failed: "Needs attention",

  // Roles / actors
  platform_admin: "TaaSFlow operator",
  operations: "TaaSFlow operator",
  client_admin: "Hiring lead",
  client_editor: "Hiring team",
  client_viewer: "Hiring team",
} as const;

export type TerminologyKey = keyof typeof CLIENT_TERMINOLOGY;

function humanize(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Return a client-safe label for an internal key. Falls back to a humanized
 * version of the raw key so we never render `undefined`.
 */
export function clientTerm(
  key: string | null | undefined,
  fallback?: string,
): string {
  if (!key) return fallback ?? "—";
  const k = key.toLowerCase() as TerminologyKey;
  return (CLIENT_TERMINOLOGY as Record<string, string>)[k] ?? fallback ?? humanize(key);
}

/**
 * Rewrite a sentence containing internal jargon into client-safe copy.
 * Only replaces whole tokens; keeps the rest of the sentence intact.
 */
export function rewriteClientCopy(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [k, v] of Object.entries(CLIENT_TERMINOLOGY)) {
    const pattern = new RegExp(`\\b${k.replace(/_/g, "[ _-]")}\\b`, "gi");
    out = out.replace(pattern, v);
  }
  return out;
}
