/**
 * TaaSFlow consent manager (TF-014).
 *
 * Single source of truth for whether non-essential tracking may run.
 *
 * Rules:
 *  - RB2B always runs on public pages (ALWAYS_ON_TRACKERS below). Owner's
 *    decision; see the note there.
 *  - Regional gate for everything else. In the EU/EEA, UK and Switzerland
 *    nothing optional runs before an affirmative choice. Everywhere else the
 *    optional categories are permitted by default and the visitor can turn
 *    them off at any time; an explicit stored decision always wins.
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
const POLICY_EVENT = "taasflow:tracking-policy";
const POLICY_CACHE_KEY = "taasflow_tracking_policy_v1";

/* ------------------------------------------------------- tracking policy -- */

export type TrackingPolicy = {
  /** Tracker keys the admin has declared strictly necessary. */
  essentialTrackers: string[];
  /** When true, prior opt-in is required in every region, not just the EU/UK/CH. */
  requirePriorOptInEverywhere: boolean;
};

/**
 * The policy in force when the stored one is not yet known: nothing is
 * essential, and prior opt-in is required only where the law requires it.
 *
 * This used to say `requirePriorOptInEverywhere: true` — and so did the seeded
 * database row it stands in for — which put every visitor on earth behind the
 * EU gate. RB2B and the LinkedIn tag then loaded only for the visitors who
 * clicked "Accept all", and on a B2B site that is nearly nobody: RB2B saw no
 * traffic at all for weeks while the tag was "installed". The regional rule
 * in `requiresPriorOptIn` is the one agreed for launch; this default and the
 * database default (migration 20260907230000) now both say so, and
 * regional-consent-gate.test.ts holds them together.
 *
 * The server-side fallback in policy.functions.ts imports THIS object rather
 * than restating it, so the two cannot disagree.
 */
export const DEFAULT_TRACKING_POLICY: TrackingPolicy = {
  essentialTrackers: [],
  requirePriorOptInEverywhere: false,
};

let policy: TrackingPolicy | null = null;
let policyLoaded = false;

function readCachedPolicy(): TrackingPolicy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POLICY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TrackingPolicy>;
    if (!Array.isArray(parsed.essentialTrackers)) return null;
    return {
      essentialTrackers: parsed.essentialTrackers.filter((v) => typeof v === "string"),
      requirePriorOptInEverywhere: parsed.requirePriorOptInEverywhere !== false,
    };
  } catch {
    return null;
  }
}

/**
 * The policy in force right now. Uses the last cached copy on a fresh page
 * load so the decision survives reloads without waiting on the network, and
 * falls back to the locked-down default when nothing is known.
 */
export function getTrackingPolicy(): TrackingPolicy {
  if (policy) return policy;
  const cached = readCachedPolicy();
  if (cached) policy = cached;
  return policy ?? DEFAULT_TRACKING_POLICY;
}

/** True once the authoritative policy has been fetched this page life. */
export function isTrackingPolicyLoaded(): boolean {
  return policyLoaded;
}

/**
 * True when this browser already holds a copy of the stored policy — fetched
 * this page life, or cached from an earlier one. On a first visit it is false,
 * and the caller should not boot optional trackers on the regional default
 * until the stored policy has been read: that policy may require prior opt-in
 * everywhere, and a tag booted before it arrives cannot be un-booted.
 */
export function hasCachedTrackingPolicy(): boolean {
  return policy !== null || readCachedPolicy() !== null;
}

export function setTrackingPolicy(next: TrackingPolicy) {
  policy = {
    essentialTrackers: next.essentialTrackers.filter((v) => typeof v === "string"),
    requirePriorOptInEverywhere: next.requirePriorOptInEverywhere !== false,
  };
  policyLoaded = true;
  try {
    window.localStorage.setItem(POLICY_CACHE_KEY, JSON.stringify(policy));
  } catch {
    /* private mode — applies for this page life only */
  }
  window.dispatchEvent(new CustomEvent<TrackingPolicy>(POLICY_EVENT, { detail: policy }));
}

export function onTrackingPolicyChange(handler: (p: TrackingPolicy) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<TrackingPolicy>).detail);
  window.addEventListener(POLICY_EVENT, listener);
  return () => window.removeEventListener(POLICY_EVENT, listener);
}

/**
 * Trackers that always run, whatever the visitor chose and wherever they are.
 *
 * RB2B, by the owner's decision (2026-09-07). It is the lead-identification
 * tool; it had been taken off this list, out of the head, and out of the
 * initialiser loop over three audits (#6 A6-04, #7 2.1) on privacy grounds,
 * and the net effect was that it never fired. The owner has chosen to run it
 * unconditionally on public pages and accepts the privacy trade-off. The
 * privacy policy lists it under legitimate interest. It still does not run on
 * the signed-in workspace — see WORKSPACE_PATH_PREFIXES in ./pixels.
 *
 * GA4 is NOT here. While it was, isTrackerAllowed("ga4", "analytics")
 * returned true whatever the visitor chose, so syncGA4Consent granted
 * analytics_storage and wrote _ga cookies after a "Decline all", beside a
 * banner reading "it sets no cookies" (audit #8, TF8-05). GA4 runs in Consent
 * Mode with storage denied until analytics is allowed, which needs no
 * exemption here.
 *
 * Exported so the admin tracking page can show these as always-on rather than
 * "waits for consent" — two surfaces answering one question differently is
 * how this codebase's defects usually start.
 */
export const ALWAYS_ON_TRACKERS = ["rb2b"] as const;

/** Whether a specific tracker is strictly necessary or on the always-on list. */
export function isTrackerEssential(key: string): boolean {
  if ((ALWAYS_ON_TRACKERS as readonly string[]).includes(key)) return true;
  return getTrackingPolicy().essentialTrackers.includes(key);
}

/**
 * The single gate every tracker passes through. Essential and always-on
 * trackers run always; everything else needs its consent category permitted.
 */
export function isTrackerAllowed(key: string, category: ConsentCategory): boolean {
  if (isTrackerEssential(key)) return true;
  return isAllowed(category);
}



/**
 * Regions where prior opt-in is legally required: EU/EEA, UK and Switzerland.
 * Detected from the browser time zone, which needs no network call and no IP
 * handling. Outside these regions the default is "permitted" until the visitor
 * saves a restrictive choice, which preserves measurement continuity.
 *
 * Istanbul and Moscow sit in the `Europe/` tree but outside EU/EEA/UK/CH, so
 * they are excluded explicitly.
 */
const OPT_IN_ZONES = /^(Europe\/|Atlantic\/(Azores|Madeira|Canary|Faroe|Reykjavik))/;
const OPT_IN_EXCLUSIONS =
  /^Europe\/(Istanbul|Moscow|Kirov|Volgograd|Saratov|Astrakhan|Samara|Ulyanovsk|Minsk|Kyiv|Kiev|Simferopol)$/;

export function requiresPriorOptIn(): boolean {
  // Admin override: treat every region as an opt-in region.
  if (getTrackingPolicy().requirePriorOptInEverywhere) return true;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (!tz) return true; // fail closed
    if (OPT_IN_EXCLUSIONS.test(tz)) return false;
    return OPT_IN_ZONES.test(tz);
  } catch {
    return true; // fail closed
  }
}


/** Back-compat alias used by the banner. */
export const isOptInRegion = requiresPriorOptIn;


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

/**
 * Whether a category may run right now.
 *
 * An explicit stored decision always wins. Without one, opt-in regions deny
 * and every other region permits — this is the regional gate agreed for
 * launch, and it keeps measurement intact outside the EU/EEA/UK/CH.
 */
export function isAllowed(category: ConsentCategory): boolean {
  if (category === "essential") return true;
  const decision = readConsent();
  if (!decision) return !requiresPriorOptIn();
  return category === "analytics" ? decision.analytics : decision.marketing;
}

/**
 * Trackers treated as strictly necessary. Configured by platform staff at
 * /admin/tracking and stored in `public.tracking_policy`; nothing is essential
 * by default.
 */
export function essentialTrackers(): string[] {
  return getTrackingPolicy().essentialTrackers;
}



export function onConsentChange(handler: (d: ConsentDecision | null) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ConsentDecision | null>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
