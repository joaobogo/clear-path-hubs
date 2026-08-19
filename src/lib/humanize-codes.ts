/**
 * Canonical humanizer for system codes, enum values, and internal keys.
 * 
 * Used across /admin, /operations, /health, and /clients to ensure that
 * internal state tokens (snake_case) never reach the UI as-is.
 */

const DICTIONARY: Record<string, string> = {
  // Delivery & Suppression
  recipient_suppressed: "Recipient blocked",
  undeliverable_domain: "Invalid domain",
  unreachable_mx: "Mail server refused",
  complaint_not_liftable: "Marked as spam",
  provider_exception: "Send failed",
  rate_limited: "Rate limited",

  // Processing States & Errors
  ocr_required: "OCR required",
  parse_and_score: "Parsing & scoring",
  text_layer_too_short: "Text layer too short",
  empty_text_layer: "Empty text layer",
  text_layer_missing: "Text layer missing",
  engine_error: "Engine error",
  cv_unreadable: "CV unreadable",
  cv_parse: "Parsing CV",
  cv_hydrate: "Hydrating data",
  cv_enrich: "Enriching profile",
  
  // Roles & Auth
  client_admin: "Client admin",
  platform_staff: "Platform staff",
  hiring_manager: "Hiring manager",
  recruiter: "Recruiter",
  
  // Pipeline
  application_intake: "Intake",
  cv_upload: "CV upload",
  cv_storage: "CV storage",
  message_send: "Messaging",
  profile_link: "Identity mapping",
};

/**
 * Humanize a code or enum value.
 * If not in the dictionary, falls back to start_case (replacing underscores with spaces).
 */
export function humanizeCode(code: string | null | undefined): string {
  if (!code) return "—";
  const normalized = code.toLowerCase().trim();
  if (DICTIONARY[normalized]) return DICTIONARY[normalized];
  
  // Fallback: simple snake_case to Space Case
  return code
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase to Space Case
    .trim();
}
