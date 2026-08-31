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
 * Fail-closed default: nothing is essential and prior opt-in is required
 * everywhere, so no non-essential script can initialise before the policy is
 * known and the visitor has made a choice.
 */
export const DEFAULT_TRACKING_POLICY: TrackingPolicy = {
  essentialTrackers: [],
  requirePriorOptInEverywhere: true,
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
 * Trackers that always run, whatever the visitor chose.
 *
 * GA4 only. It runs in Consent Mode with storage denied: the tag measures
 * cookielessly and cannot identify anyone until analytics consent is granted.
 *
 * RB2B WAS on this list, which is the third and deepest gate it was slipping
 * through. Removing its head-boot snippet and its by-name exemption from the
 * initialiser loop was not enough, because `isTrackerAllowed("rb2b", …)`
 * returned true here before either of those ever ran — so a visitor who chose
 * "Decline all" still had the identity-resolution script and its API call fire
 * (audit #7, 2.1). It resolves individual visitors; it is not essential, and it
 * is not ours to run without permission.
 */
/*
 * GA4 has now come off this list too, for the same reason RB2B did.
 *
 * While it was here, isTrackerAllowed("ga4", "analytics") returned true no
 * matter what the visitor chose. syncGA4Consent then sent
 * analytics_storage: "granted" and reconfigured GA WITHOUT client_storage:
 * "none", so a visitor who clicked "Decline all" had _ga and _ga_<id> written
 * afterwards, carrying a persistent client id and a session count — while the
 * banner beside them read "it sets no cookies and cannot identify you"
 * (audit #8, TF8-05).
 *
 * It also contradicted the app's own published policy, which the workspace
 * stores as {"essentialTrackers":[],"requirePriorOptInEverywhere":true}.
 * Nothing is always-on. Anything genuinely necessary belongs in that policy,
 * where it is visible and auditable, not in a constant here.
 */
const ALWAYS_ON_TRACKERS = [] as const;

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
