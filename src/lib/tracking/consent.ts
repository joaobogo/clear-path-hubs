/**
 * TaaSFlow consent manager (TF-014).
 *
 * Single source of truth for whether non-essential tracking may run.
 *
 * Rules:
 *  - Nothing except strictly necessary tooling runs before an affirmative
 *    choice. Trackers are never initialised "optimistically".
 *  - Two categories are offered: `analytics` (product + traffic measurement)
 *    and `marketing` (advertising, retargeting, visitor identification).
 *  - The decision is stored locally with a version stamp so the banner can be
 *    re-shown when the tracker set materially changes.
 *  - `essential` is always allowed and is never gated: it covers nothing that
 *    writes to a third party today, and exists so future security tooling has
 *    a lawful basis slot.
 */

export type ConsentCategory = "essential" | "analytics" | "marketing";

export type ConsentDecision = {
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of the affirmative action. */
  decidedAt: string;
  /** Bumped when the tracker set changes, which re-prompts. */
  version: number;
  /** How the decision was captured, for audit. */
  method: "accept_all" | "reject_all" | "granular";
};

/** Bump when trackers are added or their purpose changes. */
export const CONSENT_VERSION = 1;

const STORAGE_KEY = "taasflow_consent_v1";
const EVENT = "taasflow:consent-change";

/**
 * Regions where prior opt-in is legally required. Detected from the browser
 * time zone, which needs no network call and no IP handling. Detection only
 * affects copy and whether a "reject" path must be equally prominent — the
 * gate itself is opt-in everywhere.
 */
const OPT_IN_ZONES = /^(Europe|Atlantic\/(Azores|Madeira|Canary|Faroe|Reykjavik))/;

export function isOptInRegion(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    return OPT_IN_ZONES.test(tz);
  } catch {
    return true; // fail closed
  }
}

export function readConsent(): ConsentDecision | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentDecision>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") {
      return null;
    }
    if (parsed.version !== CONSENT_VERSION) return null;
    return {
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      decidedAt: parsed.decidedAt ?? new Date().toISOString(),
      version: CONSENT_VERSION,
      method: parsed.method ?? "granular",
    };
  } catch {
    return null;
  }
}

export function writeConsent(
  choice: { analytics: boolean; marketing: boolean },
  method: ConsentDecision["method"],
): ConsentDecision {
  const decision: ConsentDecision = {
    analytics: choice.analytics,
    marketing: choice.marketing,
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
    method,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decision));
  } catch {
    /* private mode — decision applies for this page life only */
  }
  window.dispatchEvent(new CustomEvent<ConsentDecision>(EVENT, { detail: decision }));
  return decision;
}

/** Clears the stored decision so the banner re-appears (used by "withdraw"). */
export function clearConsent() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function hasDecided(): boolean {
  return readConsent() !== null;
}

/** True only when the category is explicitly permitted. */
export function isAllowed(category: ConsentCategory): boolean {
  if (category === "essential") return true;
  const decision = readConsent();
  if (!decision) return false;
  return category === "analytics" ? decision.analytics : decision.marketing;
}

export function onConsentChange(handler: (d: ConsentDecision | null) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ConsentDecision | null>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
