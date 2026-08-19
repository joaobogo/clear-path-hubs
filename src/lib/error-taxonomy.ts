/**
 * Canonical error taxonomy.
 *
 * Every non-happy-path surface in the product renders copy from this module so
 * users never see raw JSON, provider strings, stack traces, or a bare status
 * code. Technical detail is kept for private logging only, keyed by a
 * correlation id that the user can quote to support.
 *
 * Tone is role-aware:
 *  - admin     → operational: what broke, what to do operationally
 *  - client    → concise and trustworthy, no internal machinery
 *  - candidate → reassuring and actionable, never alarming
 *  - public    → neutral marketing-site voice
 */

export type AudienceTone = "admin" | "client" | "candidate" | "public";

export type ErrorKind =
  | "offline"
  | "timeout"
  | "permission_denied"
  | "session_expired"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "validation"
  | "upload_rejected"
  | "parsing_failed"
  | "integration_failed"
  | "maintenance"
  | "server_error"
  | "unknown";

export interface NormalizedError {
  kind: ErrorKind;
  /** Short human title. Never contains provider text. */
  title: string;
  /** One or two sentences explaining what happened, in plain language. */
  description: string;
  /** Exactly one useful next action label (the caller wires the handler). */
  actionLabel: string;
  /** Whether a retry of the same request is safe and likely to help. */
  retryable: boolean;
  /** Correlation id shown to the user and attached to private logs. */
  correlationId: string;
  /** Original status code when known. Never rendered directly. */
  status?: number;
}

// Raw database/provider text must never reach a user. Beyond driver names, this
// also catches Postgres permission and constraint prose ("new row violates
// row-level security policy for table ...", "permission denied", "duplicate key
// value", "column x does not exist"), which reads as a system leak, not guidance.
const RAW_LEAK =
  /(supabase|postgrest|pgrst|jwt|sql|relation ".*"|stack|at .*\(.*:\d+:\d+\)|\{"|\[object|row-level security|violates|permission denied|duplicate key|constraint|column .* does not exist|for table "|logic tree|failed to parse|\.ilike\.|\.eq\.|\borgs?\b.*\bin\.\(|[a-z_]+_failed:)/i;

export function newCorrelationId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `TF-${rand.toUpperCase()}`;
}

function statusOf(error: unknown): number | undefined {
  const e = error as { status?: number; statusCode?: number; response?: { status?: number } };
  return e?.status ?? e?.statusCode ?? e?.response?.status;
}

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  const e = error as { message?: unknown; error?: unknown };
  if (typeof e?.message === "string") return e.message;
  if (typeof e?.error === "string") return e.error;
  return "";
}

export function classifyError(error: unknown): ErrorKind {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";

  const status = statusOf(error);
  const msg = messageOf(error).toLowerCase();
  const name = (error as { name?: string })?.name ?? "";

  if (name === "AbortError" || msg.includes("timeout") || msg.includes("timed out") || status === 408)
    return "timeout";
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed"))
    return "offline";
  if (status === 401 || msg.includes("session expired") || msg.includes("not authenticated") || msg.includes("invalid refresh token"))
    return "session_expired";
  if (status === 403 || msg.includes("forbidden") || msg.includes("row-level security") || msg.includes("not allowed"))
    return "permission_denied";
  if (status === 404 || msg.includes("not found")) return "not_found";
  if (status === 409 || msg.includes("conflict") || msg.includes("has changed since")) return "conflict";
  if (status === 429 || msg.includes("too many")) return "rate_limited";
  if (status === 422 || status === 400 || msg.includes("validation")) return "validation";
  if (msg.includes("upload") || msg.includes("file type") || msg.includes("pdf")) return "upload_rejected";
  if (msg.includes("parse") || msg.includes("parsing") || msg.includes("extract")) return "parsing_failed";
  if (status === 503 || msg.includes("maintenance") || msg.includes("unavailable")) return "maintenance";
  if (msg.includes("provider") || msg.includes("gateway") || status === 502) return "integration_failed";
  if (status && status >= 500) return "server_error";
  return "unknown";
}

type Copy = Record<AudienceTone, { title: string; description: string; action: string }>;

const COPY: Record<ErrorKind, Copy> = {
  offline: {
    admin: {
      title: "You're offline",
      description:
        "The workspace lost its connection, so nothing on screen is updating. Any unsaved action was not applied.",
      action: "Retry now",
    },
    client: {
      title: "You're offline",
      description: "We can't reach the network right now. Nothing you did was lost.",
      action: "Retry",
    },
    candidate: {
      title: "You're offline",
      description:
        "Your connection dropped. Nothing you sent was lost — reconnect and we'll pick up where you left off.",
      action: "Try again",
    },
    public: {
      title: "You're offline",
      description: "We can't reach the network right now.",
      action: "Try again",
    },
  },
  timeout: {
    admin: {
      title: "The request took too long",
      description: "The service didn't answer in time. It may still be catching up — retry in a moment.",
      action: "Retry request",
    },
    client: {
      title: "That took too long",
      description: "The page didn't finish loading. Nothing was changed.",
      action: "Try again",
    },
    candidate: {
      title: "That took a little too long",
      description: "Nothing went wrong with your application — the page just didn't finish loading.",
      action: "Try again",
    },
    public: { title: "That took too long", description: "The page didn't finish loading.", action: "Try again" },
  },
  permission_denied: {
    admin: {
      title: "You don't have access to this",
      description: "Your role doesn't include this area. Ask an owner to adjust your permissions.",
      action: "Back to overview",
    },
    client: {
      title: "You don't have access to this",
      description: "This area isn't part of your workspace access.",
      action: "Back to dashboard",
    },
    candidate: {
      title: "This isn't available to you",
      description: "You can only see your own applications here. Everything of yours is on your dashboard.",
      action: "Go to my applications",
    },
    public: { title: "Not available", description: "This page isn't publicly accessible.", action: "Go home" },
  },
  session_expired: {
    admin: {
      title: "Your session expired",
      description: "For security, sessions end after a period of inactivity. Sign in again to continue — no work was lost.",
      action: "Sign in again",
    },
    client: {
      title: "Your session expired",
      description: "Sign in again to continue. Nothing you did was lost.",
      action: "Sign in again",
    },
    candidate: {
      title: "You've been signed out",
      description: "This happens after a while for your security. Your applications are safe.",
      action: "Sign in again",
    },
    public: { title: "Your session expired", description: "Please sign in again.", action: "Sign in" },
  },
  not_found: {
    admin: {
      title: "We couldn't find that record",
      description: "It may have been archived, merged, or deleted. Check the relevant list for the current version.",
      action: "Back to list",
    },
    client: {
      title: "We couldn't find that",
      description: "This item is no longer available in your workspace.",
      action: "Back to dashboard",
    },
    candidate: {
      title: "We couldn't find that page",
      description: "The link may be old. Your applications are all listed on your dashboard.",
      action: "Go to my applications",
    },
    public: { title: "Page not found", description: "The link may be out of date.", action: "Go home" },
  },
  conflict: {
    admin: {
      title: "Someone else changed this first",
      description: "Your copy is out of date, so nothing was saved. Reload to see the current version, then reapply your change.",
      action: "Reload latest",
    },
    client: {
      title: "This was updated elsewhere",
      description: "Nothing was saved. Reload to see the latest version.",
      action: "Reload",
    },
    candidate: {
      title: "This was updated already",
      description: "Nothing was lost — reload to see the latest.",
      action: "Reload",
    },
    public: { title: "This changed", description: "Reload to see the latest.", action: "Reload" },
  },
  rate_limited: {
    admin: {
      title: "Too many attempts",
      description: "This action is rate-limited to protect the platform. Wait a minute before trying again.",
      action: "Try again shortly",
    },
    client: {
      title: "Too many attempts",
      description: "Please wait a moment before trying again.",
      action: "Try again shortly",
    },
    candidate: {
      title: "Just a moment",
      description: "You've tried this a few times in a row. Wait a minute and try once more.",
      action: "Try again shortly",
    },
    public: { title: "Too many attempts", description: "Please wait a moment.", action: "Try again shortly" },
  },
  validation: {
    admin: {
      title: "Some details need fixing",
      description: "The server rejected this submission. Review the highlighted fields — your input was kept.",
      action: "Review fields",
    },
    client: {
      title: "Some details need fixing",
      description: "Check the highlighted fields. Everything you typed was kept.",
      action: "Review fields",
    },
    candidate: {
      title: "A couple of details need fixing",
      description: "Nothing was lost — just check the highlighted fields and send again.",
      action: "Review fields",
    },
    public: { title: "Some details need fixing", description: "Check the highlighted fields.", action: "Review fields" },
  },
  upload_rejected: {
    admin: {
      title: "The file was rejected",
      description: "Only PDF documents up to the size limit are accepted. Nothing was stored.",
      action: "Choose another file",
    },
    client: {
      title: "The file was rejected",
      description: "Only PDF documents are accepted. Nothing was stored.",
      action: "Choose another file",
    },
    candidate: {
      title: "That file didn't go through",
      description: "We accept PDF CVs only. Export your CV as a PDF and upload it again — your application is still saved.",
      action: "Choose another file",
    },
    public: { title: "That file didn't go through", description: "We accept PDF files only.", action: "Choose another file" },
  },
  parsing_failed: {
    admin: {
      title: "We couldn't read this document",
      description: "Extraction failed, so no evidence was generated. Re-run processing or review the document manually.",
      action: "Re-run processing",
    },
    client: {
      title: "This document is still being prepared",
      description: "Our team is reviewing it manually. You'll see it here once it's ready.",
      action: "Back to candidates",
    },
    candidate: {
      title: "We're reviewing your CV manually",
      description: "Our system couldn't read parts of your file, so a person is checking it. Nothing is wrong with your application.",
      action: "Back to my application",
    },
    public: { title: "We couldn't read this document", description: "Please try a different file.", action: "Try again" },
  },
  integration_failed: {
    admin: {
      title: "A connected service didn't respond",
      description: "The dependent step was skipped, not half-applied. Retry once the service recovers.",
      action: "Retry",
    },
    client: {
      title: "A connected service is unavailable",
      description: "Nothing was changed. Please try again shortly.",
      action: "Try again",
    },
    candidate: {
      title: "Something on our side is slow",
      description: "Nothing was changed and nothing was lost. Please try again shortly.",
      action: "Try again",
    },
    public: { title: "A service is unavailable", description: "Please try again shortly.", action: "Try again" },
  },
  maintenance: {
    admin: {
      title: "Service temporarily unavailable",
      description: "The backend is briefly unavailable, likely maintenance. Queued work resumes automatically.",
      action: "Retry",
    },
    client: {
      title: "Temporarily unavailable",
      description: "We're back shortly. Nothing was changed.",
      action: "Try again",
    },
    candidate: {
      title: "We'll be back shortly",
      description: "The site is briefly unavailable. Your application is safe.",
      action: "Try again",
    },
    public: { title: "We'll be back shortly", description: "The site is briefly unavailable.", action: "Try again" },
  },
  server_error: {
    admin: {
      title: "The server hit an error",
      description: "This is logged with the reference below. If it repeats, quote that reference when escalating.",
      action: "Retry",
    },
    client: {
      title: "We couldn't load this",
      description: "This is on our side, not yours. Nothing was changed.",
      action: "Try again",
    },
    candidate: {
      title: "We couldn't load this just now",
      description: "This is on our side, not yours. Your application is safe.",
      action: "Try again",
    },
    public: { title: "We couldn't load this", description: "This is on our side, not yours.", action: "Try again" },
  },
  unknown: {
    admin: {
      title: "Something went wrong",
      description: "We logged the details against the reference below. Retry, and escalate if it repeats.",
      action: "Retry",
    },
    client: { title: "Something went wrong", description: "Nothing was changed. Please try again.", action: "Try again" },
    candidate: {
      title: "Something went wrong",
      description: "Nothing you did was lost. Please try again.",
      action: "Try again",
    },
    public: { title: "Something went wrong", description: "Please try again.", action: "Try again" },
  },
};

/** True when a string looks like it leaked technical detail. */
export function looksTechnical(text: string): boolean {
  // P-019: operational codes like position_screening_limit_exceeded are NOT technical
  // leaks; they are instructions for staff.
  if (text === "position_screening_limit_exceeded") return false;
  return RAW_LEAK.test(text);
}

export function normalizeError(
  error: unknown,
  options: { tone?: AudienceTone; correlationId?: string } = {},
): NormalizedError {
  const tone = options.tone ?? "client";
  const kind = classifyError(error);
  const copy = COPY[kind][tone];
  return {
    kind,
    title: copy.title,
    description: copy.description,
    actionLabel: copy.action,
    retryable: kind !== "permission_denied" && kind !== "validation" && kind !== "not_found",
    correlationId: options.correlationId ?? newCorrelationId(),
    status: statusOf(error),
  };
}

/**
 * Private technical logging. Console only in the browser (picked up by the
 * platform log pipeline); never rendered and never sent to analytics.
 */
export function logTechnical(error: unknown, normalized: NormalizedError, context: Record<string, unknown> = {}) {
  // eslint-disable-next-line no-console
  console.error(`[${normalized.correlationId}] ${normalized.kind}`, {
    ...context,
    status: normalized.status,
    message: messageOf(error),
  });
}
