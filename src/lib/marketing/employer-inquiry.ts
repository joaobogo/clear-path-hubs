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
  position: 200,
  source: 80,
  key: 64,
} as const;

export const INQUIRY_MESSAGES = {
  firstName: "Enter your first name.",
  email: "Enter a valid work email address, for example name@company.com.",
  phone: "Enter a phone number with 7 to 15 digits, or leave it empty.",
  position: "Tell us which role you need to fill.",
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

export type InquiryFields = {
  firstName: string;
  email: string;
  phone: string;
  position: string;
};

export type InquiryErrors = Partial<Record<keyof InquiryFields, string>>;

/** Client-side validation. `{}` means valid. */
export function validateInquiryFields(values: InquiryFields): InquiryErrors {
  const errors: InquiryErrors = {};
  const first = cleanLine(values.firstName);
  if (!first) errors.firstName = INQUIRY_MESSAGES.firstName;
  else if (first.length > INQUIRY_LIMITS.firstName) errors.firstName = INQUIRY_MESSAGES.firstName;
  if (!isValidEmail(values.email)) errors.email = INQUIRY_MESSAGES.email;
  if (normalisePhone(values.phone) === null) errors.phone = INQUIRY_MESSAGES.phone;
  const position = cleanLine(values.position);
  if (!position || position.length > INQUIRY_LIMITS.position) {
    errors.position = INQUIRY_MESSAGES.position;
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
  phone: z.string().trim().max(INQUIRY_LIMITS.phone).optional().or(z.literal("")),
  position: z.string().trim().min(1).max(INQUIRY_LIMITS.position),
  source: z.string().trim().max(INQUIRY_LIMITS.source).optional().or(z.literal("")),
  idempotencyKey: z.string().uuid(),
  // Honeypot — must be empty.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type EmployerInquiryInputT = z.infer<typeof EmployerInquiryInput>;

export type CleanInquiry = {
  firstName: string;
  email: string;
  phone: string | null;
  position: string;
  source: string;
  idempotencyKey: string;
};

/**
 * Normalises validated input for storage (raw text, control characters removed). Returns null when the
 * phone number is not plausible, so the caller can reject it.
 */
export function prepareInquiry(input: EmployerInquiryInputT): CleanInquiry | null {
  const phone = normalisePhone(input.phone ?? "");
  if (phone === null) return null;
  return {
    firstName: sanitizeText(cleanLine(input.firstName)),
    email: normaliseEmail(input.email),
    phone: phone || null,
    position: sanitizeText(cleanLine(input.position)),
    source: sanitizeText(cleanLine(input.source ?? "")) || "unknown",
    idempotencyKey: input.idempotencyKey,
  };
}

/** Window inside which an identical email + position counts as a duplicate. */
export const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export function dedupeCutoffIso(now: number = Date.now()): string {
  return new Date(now - DEDUPE_WINDOW_MS).toISOString();
}

/**
 * Decide whether a prior row means this submission is a repeat. Pure so the
 * rule is testable without a database.
 */
export function isDuplicate(
  prior: { id: string; details?: unknown; email: string; role_title: string | null; created_at: string } | null,
  clean: CleanInquiry,
  now: number = Date.now(),
): boolean {
  if (!prior) return false;
  const details = (prior.details ?? {}) as Record<string, unknown>;
  if (details["idempotency_key"] === clean.idempotencyKey) return true;
  const age = now - new Date(prior.created_at).getTime();
  return (
    prior.email.toLowerCase() === clean.email &&
    (prior.role_title ?? "").toLowerCase() === clean.position.toLowerCase() &&
    age >= 0 &&
    age <= DEDUPE_WINDOW_MS
  );
}
