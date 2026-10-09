/**
 * Short employer inquiry — pure validation and normalisation, shared by the
 * form (client) and the server function. No browser or server globals here so
 * it is unit-testable and safe to import anywhere.
 *
 * Personal email addresses are deliberately NOT rejected: small employers and
 * founders often hire from a personal address.
 */
import { z } from "zod";

export const INQUIRY_LIMITS = {
  firstName: 80,
  email: 254,
  phone: 30,
  jobDescriptionUrl: 2048,
  source: 80,
  key: 64,
} as const;

export const INQUIRY_MESSAGES = {
  firstName: "Enter your first name.",
  email: "Enter a valid work email address, for example name@company.com.",
  phone: "Enter a phone number with 7 to 15 digits.",
  jobDescriptionUrl: "Paste the link to the job description, for example https://company.com/careers/role.",
} as const;

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

/** Lowercase and trim. The local part is kept as typed apart from case. */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= INQUIRY_LIMITS.email && EMAIL_RE.test(v);
}

/**
 * Accepts international formats: digits, spaces, dots, dashes, parentheses and
 * a leading plus. Returns a cleaned string, "" when empty, or null when the
 * value is not a plausible phone number (7 to 15 digits, E.164 bound).
 */
export function normalisePhone(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (!/^\+?[\d\s().-]+$/.test(v)) return null;
  const digits = v.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return `${v.startsWith("+") ? "+" : ""}${digits}`;
}

/**
 * Strips control characters only. Stored text stays RAW: every surface that
 * renders it (React, email templates) escapes at render time, so escaping here
 * would double-escape names like O'Brien in the admin queue.
 */
export function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

/** Escapes characters that are unsafe if the text is ever rendered as HTML. */
export function escapeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Collapse internal whitespace and trim, for single-line fields. */
export function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * The job description link, normalised: trimmed, "https://" added when the
 * scheme was left off, and only http(s) with a real host (a dot in it)
 * accepted. Returns null when the value is not a usable link.
 */
export function normaliseJobDescriptionUrl(value: string | null | undefined): string | null {
  const raw = cleanLine(value ?? "");
  if (!raw || raw.length > INQUIRY_LIMITS.jobDescriptionUrl) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export type InquiryFields = {
  firstName: string;
  email: string;
  phone: string;
  jobDescriptionUrl: string;
};

export type InquiryErrors = Partial<Record<keyof InquiryFields, string>>;

/** Client-side validation. `{}` means valid. */
export function validateInquiryFields(values: InquiryFields): InquiryErrors {
  const errors: InquiryErrors = {};
  const first = cleanLine(values.firstName);
  if (!first) errors.firstName = INQUIRY_MESSAGES.firstName;
  else if (first.length > INQUIRY_LIMITS.firstName) errors.firstName = INQUIRY_MESSAGES.firstName;
  if (!isValidEmail(values.email)) errors.email = INQUIRY_MESSAGES.email;
  // Every field is required: the team calls the lead back, so a phone number
  // is part of the request, not an extra.
  const phone = normalisePhone(values.phone);
  if (phone === null || phone === "") errors.phone = INQUIRY_MESSAGES.phone;
  if (normaliseJobDescriptionUrl(values.jobDescriptionUrl) === null) {
    errors.jobDescriptionUrl = INQUIRY_MESSAGES.jobDescriptionUrl;
  }
  return errors;
}

/** Error category for analytics. Never the value, never free text. */
export function inquiryErrorCategory(errors: InquiryErrors): string {
  const keys = Object.keys(errors);
  if (keys.length === 0) return "none";
  return keys.length > 1 ? "multiple_fields" : `${keys[0]}_invalid`;
}

/** Server input schema. Bounded lengths; honeypot must be empty. */
export const EmployerInquiryInput = z.object({
  firstName: z.string().trim().min(1).max(INQUIRY_LIMITS.firstName),
  email: z.string().trim().max(INQUIRY_LIMITS.email).refine(isValidEmail, "invalid_email"),
  phone: z.string().trim().min(1).max(INQUIRY_LIMITS.phone),
  jobDescriptionUrl: z.string().trim().min(1).max(INQUIRY_LIMITS.jobDescriptionUrl),
  source: z.string().trim().max(INQUIRY_LIMITS.source).optional().or(z.literal("")),
  idempotencyKey: z.string().uuid(),
  // Honeypot — must be empty.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type EmployerInquiryInputT = z.infer<typeof EmployerInquiryInput>;

export type CleanInquiry = {
  firstName: string;
  email: string;
  phone: string;
  jobDescriptionUrl: string;
  source: string;
  idempotencyKey: string;
};

/**
 * Normalises validated input for storage (raw text, control characters
 * removed). Returns null when the phone number or the job description link is
 * not usable, so the caller can reject it.
 */
export function prepareInquiry(input: EmployerInquiryInputT): CleanInquiry | null {
  const phone = normalisePhone(input.phone);
  if (!phone) return null;
  const jobDescriptionUrl = normaliseJobDescriptionUrl(input.jobDescriptionUrl);
  if (!jobDescriptionUrl) return null;
  return {
    firstName: sanitizeText(cleanLine(input.firstName)),
    email: normaliseEmail(input.email),
    phone,
    jobDescriptionUrl,
    source: sanitizeText(cleanLine(input.source ?? "")) || "unknown",
    idempotencyKey: input.idempotencyKey,
  };
}

/** Window inside which an identical email + job description link counts as a duplicate. */
export const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export function dedupeCutoffIso(now: number = Date.now()): string {
  return new Date(now - DEDUPE_WINDOW_MS).toISOString();
}

/**
 * Decide whether a prior row means this submission is a repeat. Pure so the
 * rule is testable without a database.
 */
export function isDuplicate(
  prior: { id: string; details?: unknown; email: string; created_at: string } | null,
  clean: CleanInquiry,
  now: number = Date.now(),
): boolean {
  if (!prior) return false;
  const details = (prior.details ?? {}) as Record<string, unknown>;
  if (details["idempotency_key"] === clean.idempotencyKey) return true;
  const age = now - new Date(prior.created_at).getTime();
  const priorUrl = String(details["job_description_url"] ?? "").toLowerCase();
  return (
    prior.email.toLowerCase() === clean.email &&
    priorUrl === clean.jobDescriptionUrl.toLowerCase() &&
    age >= 0 &&
    age <= DEDUPE_WINDOW_MS
  );
}
