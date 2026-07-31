/**
 * Client-side carry-over for lead capture (prompt 47 -> 48).
 *
 * When someone tells us who they are on an industry page, we keep it locally
 * and hand it to the intake form so they never retype it. The server-issued
 * prefill token is the authoritative link; the local copy is only a
 * convenience for the same browser.
 */
const KEY = "taasflow.lead.prefill";

export type LeadPrefill = {
  token?: string | null;
  name?: string;
  email?: string;
  company?: string;
  roleTitle?: string;
  verticalSlug?: string;
  savedAt?: number;
};

export function storeLeadPrefill(value: LeadPrefill) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch {
    /* storage unavailable — the token in the URL still works */
  }
}

export function readLeadPrefill(): LeadPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LeadPrefill;
    // Stale after 30 days — people move on.
    if (parsed.savedAt && Date.now() - parsed.savedAt > 30 * 86_400_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLeadPrefill() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
