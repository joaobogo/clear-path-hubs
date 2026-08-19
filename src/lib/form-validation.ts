/**
 * Inline form validation helpers.
 *
 * Native browser validation bubbles are rendered by the browser in the *browser's*
 * locale (e.g. "Preencha este campo."), which does not match the app language and
 * can visually cover adjacent labels. Every form in the app therefore sets
 * `noValidate` and renders inline messages with these helpers instead.
 */

export const FORM_MESSAGES = {
  required: "This field is required.",
  email: "Enter a valid email address, for example name@company.com.",
  url: "Enter a full address starting with http:// or https://.",
  passwordMin: "Use at least 8 characters.",
  passwordMismatch: "The two passwords do not match.",
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function requiredText(value: string | null | undefined, message = FORM_MESSAGES.required) {
  return value && value.trim().length > 0 ? null : message;
}

export function minLengthText(value: string | null | undefined, min: number) {
  const v = (value ?? "").trim();
  if (!v) return FORM_MESSAGES.required;
  return v.length >= min ? null : `Use at least ${min} characters.`;
}

export function emailText(value: string | null | undefined, { optional = false } = {}) {
  const v = (value ?? "").trim();
  if (!v) return optional ? null : FORM_MESSAGES.required;
  return EMAIL_RE.test(v) ? null : FORM_MESSAGES.email;
}

/** Drops null entries, leaving only real errors. `{}` means the form is valid. */
export function collectErrors<K extends string>(
  candidates: Record<K, string | null>,
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const [key, message] of Object.entries(candidates) as [K, string | null][]) {
    if (message) out[key] = message;
  }
  return out;
}
