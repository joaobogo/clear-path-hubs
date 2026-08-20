/**
 * Canonical humanizer for system codes, enum values, and internal keys.
 * 
 * Used across /admin, /operations, /health, and /clients to ensure that
 * internal state tokens (snake_case) never reach the UI as-is.
 */

const DICTIONARY: Record<string, string> = {
  // Delivery & Suppression
  recipient_suppressed: "Blocked before sending (suppression list or recipient preference)",
  undeliverable_domain: "The recipient's email domain does not accept mail",
  unreachable_mx: "The recipient's mail server refused the message",
  complaint_not_liftable: "The recipient marked earlier mail as spam",
  provider_exception: "The email provider rejected the send",
  rate_limited: "Too many sends in a short window — retry later",

  // Processing States & Errors
  ocr_required: "Needs OCR to read the CV",
  parse_and_score: "Read and score the CV",
  text_layer_too_short: "The CV has too little readable text",
  empty_text_layer: "The CV has no readable text",
  text_layer_missing: "The CV has no text layer — it is a scan",
  engine_error: "The scoring engine failed to finish",
  cv_unreadable: "The CV could not be read",
  cv_parse: "Parsing CV",
  cv_hydrate: "Hydrating data",
  cv_enrich: "Enriching profile",
  
  // Roles & Auth
  client_admin: "Client",
  platform_staff: "Staff",
  hiring_manager: "Hiring manager",
  recruiter: "Recruiter",
  
  // Pipeline
  application_intake: "Intake",
  cv_upload: "CV upload",
  cv_storage: "CV storage",
  message_send: "Messaging",
  profile_link: "Identity mapping",
  
  // Match & Position States
  submitted: "Submitted",
  needs_clarification: "Needs clarification",
  under_review: "Under review",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
  filled: "Filled",
  rejected: "Rejected",
  held: "Held",
  pending: "Pending",
  scored: "Scored",

  // D5: Additional error codes
  position_screening_limit_exceeded: "Screening limit reached",
  match_not_found: "Candidate record not found",

  // Integration health probe outcomes
  payments_api_error: "Payments provider rejected the call",
  payments_catalog_empty: "No plan prices published yet",
  attio_unreachable: "CRM did not respond",
  attio_objects_missing: "CRM objects missing",
  calendly_gateway_error: "Scheduling gateway error",
  calendly_page_unreachable: "Scheduling page unreachable",
  email_logs_unreachable: "Email history unavailable",
  email_no_history: "No email sent yet",
  email_deliverability_signal: "Delivery problems detected",
  probe_exception: "Health check failed to run",

  // Staff & workspace roles (never render the stored token)
  platform_admin: "Platform admin",
  operations: "Operations",
  client_editor: "Editor",
  client_viewer: "Viewer",
  ownerless: "No owner assigned",
  unassigned: "Unassigned",
  read_only: "Read-only",
  interactive: "Interactive",
  support_session: "Support session",

  // Organization / onboarding lifecycle
  prospect: "Prospect",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
  draft: "Draft",
  inactive: "Inactive",
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  expired: "Expired",
  invited: "Invited",
  revoked: "Revoked",

  // Processing pipeline states
  queued: "Queued",
  parsing: "Parsing",
  parsed: "Parsed",
  enriching: "Enriching",
  ready_to_score: "Ready to score",
  scoring: "Scoring",
  manual_review_required: "Manual review required",
  provider_blocked: "Blocked by provider",
  failed: "Failed",
  running: "Running",
  claimed: "Picked up by worker",
  permanently_failed: "Permanently failed",

  // Job names (worker queue)
  parse: "Parse CV",
  ocr: "Run OCR",
  score: "Score candidate",
  rescore: "Re-score candidate",
  hydration: "Hydrate profile",
  enrichment: "Enrich profile",
  publish: "Publish to client",
  publication: "Publish to client",
  notification: "Send notification",
  scoring_job: "Score candidate",
  candidate_match: "Candidate on a role",
  application: "Application",
  position: "Role",
  support_view_read_only: "You can't create roles while previewing a client workspace.",
};

/**
 * The one shared enum-to-label map. Other modules extend their own lookups
 * from this object so a label is defined in a single place.
 */
export const ENUM_LABELS: Readonly<Record<string, string>> = DICTIONARY;

/**
 * Humanize a code or enum value.
 * If not in the dictionary, falls back to start_case (replacing underscores with spaces).
 */
export function humanizeCode(code: string | null | undefined): string {
  if (!code) return "—";
  
  // If it's a UUID, return it as-is or truncated (not a code)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)) {
    return code;
  }

  const normalized = code.toLowerCase().trim();
  if (DICTIONARY[normalized]) return DICTIONARY[normalized];
  
  // P07: Never return raw SCREAMING_SNAKE_CASE. If it looks like a constant and
  // isn't in our dictionary, return a generic fallback.
  if (/^[A-Z0-9_]{3,}$/.test(code)) {
    return "Something went wrong. Please try again.";
  }

  // Fallback: simple snake_case to Space Case
  return code
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase to Space Case
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Turn a stored evidence location into a sentence fragment a person can read.
 * Locations arrive as free text or as a small JSON object ({ page, section,
 * char offsets }); rendering the object directly produced "[object Object]"
 * on the review desk.
 */
export function humanizeEvidenceLocation(loc: unknown): string | null {
  if (loc == null || loc === "") return null;
  if (typeof loc === "string") return loc.trim() || null;
  if (typeof loc === "number") return `page ${loc}`;
  if (Array.isArray(loc)) {
    const parts = loc.map((l) => humanizeEvidenceLocation(l)).filter(Boolean);
    return parts.length > 0 ? parts.slice(0, 2).join(" · ") : null;
  }
  if (typeof loc !== "object") return null;

  const l = loc as Record<string, unknown>;
  const text = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s ? s : null;
  };

  const parts: string[] = [];
  const label = text(l["label"]);
  if (label) parts.push(label);

  const page = text(l["page"] ?? l["page_number"]);
  if (page) parts.push(`page ${page}`);

  const section = text(l["section"] ?? l["heading"] ?? l["block"]);
  if (section) parts.push(section);

  if (parts.length === 0) {
    const start = l["start"] ?? l["char_start"] ?? l["offset"];
    const end = l["end"] ?? l["char_end"];
    if (start != null && end != null) parts.push(`characters ${String(start)}–${String(end)}`);
    else if (start != null) parts.push(`from character ${String(start)}`);
  }

  if (parts.length === 0) {
    const line = text(l["line"] ?? l["ln"]);
    if (line) parts.push(`line ${line}`);
  }

  return parts.length > 0 ? parts.slice(0, 2).join(" · ") : null;
}

/**
 * Criterion keys are stored as internal slugs ("req-0", "pref-2"). Staff read
 * the requirement text next to them, so the key itself must read as a label.
 */
export function humanizeCriterionKey(key: string | null | undefined): string {
  if (!key) return "Requirement";
  const m = /^(req|pref|must|nice)[-_]?(\d+)$/i.exec(key.trim());
  if (m) {
    const kind = m[1]!.toLowerCase();
    const n = Number(m[2]) + 1;
    const noun = kind === "req" || kind === "must" ? "Must-have" : "Preferred";
    return `${noun} requirement ${n}`;
  }
  return humanizeCode(key);
}



/**
 * Job / queue names read as an action a person recognises ("Parse CV"), never
 * as the worker's internal job_type. Bare identifiers never become a label.
 */
export function humanizeJobName(jobType: string | null | undefined): string {
  if (!jobType) return "Unnamed job";
  const raw = String(jobType).trim();
  if (!raw) return "Unnamed job";
  // A bare identifier (UUID or opaque trace token) is not a job name.
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw) ||
    /^(pl|sv|job)_[a-z0-9]{6,}$/i.test(raw)
  ) {
    return "Unnamed job";
  }
  return humanizeCode(raw);
}

/**
 * Turn a raw provider error string into one sentence an operator can act on.
 *
 * Inputs look like:
 *   `Email API error: 403 {"status":403,"type":"recipient_suppressed", … }`
 * The sentence comes from the machine `type`/code inside the payload; the
 * payload itself belongs behind a "Show technical detail" disclosure, never in
 * the row. Returns null when there is nothing meaningful to say.
 */
export function humanizeTechnicalError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  if (s.includes("unique or exclusion constraint")) {
    return "Record already exists (duplicate key).";
  }

  // Prefer an explicit machine code carried in the payload.
  const typed =
    /"(?:type|code|error_code|reason)"\s*:\s*"([a-z0-9_.-]+)"/i.exec(s)?.[1] ??
    /\b(recipient_suppressed|undeliverable_domain|unreachable_mx|complaint_not_liftable|provider_exception|rate_limited|text_layer_too_short|text_layer_missing|empty_text_layer|engine_error|ocr_required|cv_unreadable)\b/i.exec(
      s,
    )?.[1];
  if (typed) {
    const label = humanizeCode(typed);
    return label.endsWith(".") ? label : `${label}.`;
  }

  // Provider gave a human title — use it, minus any machine payload.
  const title = /"title"\s*:\s*"([^"]{4,240})"/i.exec(s)?.[1];
  if (title) return title.endsWith(".") ? title : `${title}.`;

  // No structured payload: keep the leading human clause only, drop JSON/IDs.
  const firstClause = s.split(/[{[]/)[0]!.replace(/\s+/g, " ").trim();
  const cleaned = firstClause.replace(/\b[0-9a-f-]{16,}\b/gi, "").replace(/\s+/g, " ").trim();
  if (!cleaned || /^\d+$/.test(cleaned)) return "The provider rejected the request.";
  const sentence = cleaned.replace(/[:\-–,]+$/, "").trim();
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}
