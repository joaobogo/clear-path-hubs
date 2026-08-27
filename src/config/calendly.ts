/**
 * Calendly scheduling links — client-safe configuration.
 *
 * We keep TWO distinct destinations, because they are two different meetings:
 *  - KICKOFF: the call a client books straight after submitting their first
 *    role, from inside the intake confirmation screen.
 *  - SALES: the discovery / walkthrough call marketing CTAs point at.
 *
 * Both are plain Calendly event URLs (no API key, no OAuth) so the embed works
 * as soon as the link is set. When a link is missing we fall back to the native
 * scheduler instead of showing a broken widget — never invent a URL.
 */

function calendlyUrl(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (!/(^|\.)calendly\.com$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Kickoff call offered after the first role is submitted. */
export const CALENDLY_KICKOFF_URL = calendlyUrl(import.meta.env["VITE_CALENDLY_KICKOFF_URL"]);

/** Sales discovery / walkthrough link for marketing CTAs. */
export const CALENDLY_SALES_URL = calendlyUrl(import.meta.env["VITE_CALENDLY_SALES_URL"]);

export type CalendlyPrefill = {
  name?: string | null;
  email?: string | null;
  /** Our booking session id — comes back on the webhook as utm_content. */
  sessionId?: string | null;
  /** Free-text carried into the invitee's "anything else" answer. */
  note?: string | null;
};

/**
 * Builds the embed URL: hides Calendly's own cookie banner, prefills what we
 * already know, and stamps the booking session id so the signed webhook can
 * match the meeting back to our row.
 */
export function calendlyEmbedUrl(base: string, prefill: CalendlyPrefill = {}): string {
  const url = new URL(base);
  url.searchParams.set("hide_gdpr_banner", "1");
  url.searchParams.set("hide_landing_page_details", "1");
  const name = prefill.name?.trim();
  const email = prefill.email?.trim();
  if (name) url.searchParams.set("name", name);
  if (email) url.searchParams.set("email", email);
  if (prefill.sessionId) url.searchParams.set("utm_content", prefill.sessionId);
  if (prefill.note) url.searchParams.set("a1", prefill.note.slice(0, 400));
  return url.toString();
}

export const CALENDLY_WIDGET_SCRIPT = "https://assets.calendly.com/assets/external/widget.js";
export const CALENDLY_WIDGET_STYLES = "https://assets.calendly.com/assets/external/widget.css";
