/**
 * FGV ecosystem attribution (browser only).
 * ----------------------------------------
 * Extends the brand-local first/last-touch capture with the cross-brand layer:
 * an anonymous journey id, the entry brand, click identifiers, and immutable
 * first-touch values.
 *
 * Privacy rules enforced here:
 * - No personal data is ever stored. Campaign + page context only.
 * - Landing page and referrer are stored without query string or fragment.
 * - fgv_journey_id is an opaque random id. It is NEVER used for auth,
 *   access control, or personalization.
 */

export const BRAND_KEY = "taasflow" as const;
export const BRAND_DOMAIN = "taasflow.com" as const;

/** Shared key names — identical on every FGV brand site. */
const JOURNEY_KEY = "fgv.journey";
const FIRST_TOUCH_KEY = "fgv.attribution.first";
/** Legacy brand-local key, still read so existing visitors keep their history. */
const LEGACY_FIRST_TOUCH_KEY = "taasflow.attribution.first";

export const CLICK_ID_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "li_fat_id",
] as const;
export type ClickIdParam = (typeof CLICK_ID_PARAMS)[number];

export type EcosystemAttribution = {
  landing_page: string | null;
  conversion_page: string | null;
  original_referrer: string | null;
  latest_referrer: string | null;
  first_touch_source: string | null;
  first_touch_medium: string | null;
  first_touch_campaign: string | null;
  last_touch_source: string | null;
  last_touch_medium: string | null;
  last_touch_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  msclkid: string | null;
  linkedin_click_id: string | null;
  fgv_journey_id: string | null;
  fgv_entry_brand: string | null;
  fgv_referrer: string | null;
  first_landing_timestamp: string | null;
  last_activity_timestamp: string | null;
};

type FirstTouch = {
  landing_page: string;
  original_referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  entry_brand: string;
  first_landing_timestamp: string;
} & Partial<Record<ClickIdParam, string | null>>;

const trim = (v: string | null | undefined, max = 200) => {
  const s = (v ?? "").trim();
  return s.length > 0 ? s.slice(0, max) : null;
};

/** Strip query string and fragment; keep origin + path only. */
export function cleanUrl(value: string | null | undefined): string | null {
  const raw = trim(value, 500);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`.replace(/\/$/, "") || u.origin;
  } catch {
    return raw.split(/[?#]/)[0] || null;
  }
}

function readUtm(search: URLSearchParams) {
  const get = (k: string) => trim(search.get(k));
  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_content: get("utm_content"),
    utm_term: get("utm_term"),
  };
}

function readClickIds(search: URLSearchParams) {
  const out: Partial<Record<ClickIdParam, string | null>> = {};
  for (const key of CLICK_ID_PARAMS) out[key] = trim(search.get(key), 300);
  return out;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Anonymous cross-brand journey id. Created once, then reused. */
export function getJourneyId(): string | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const existing = store.getItem(JOURNEY_KEY);
    if (existing) return existing;
    const url = new URL(window.location.href);
    // Allow a sibling brand to hand the journey over via ?fgv_jid=
    const handed = trim(url.searchParams.get("fgv_jid"), 64);
    const id =
      handed ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    store.setItem(JOURNEY_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function readFirstTouch(): FirstTouch | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(FIRST_TOUCH_KEY) ?? store.getItem(LEGACY_FIRST_TOUCH_KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : null;
  } catch {
    return null;
  }
}

/**
 * Call once on app start. First-touch values are written only when absent —
 * a later visit never overwrites entry brand, landing page, original referrer,
 * or the original campaign.
 */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  getJourneyId();
  const store = safeStorage();
  if (!store) return;
  try {
    if (readFirstTouch()) return;
    const url = new URL(window.location.href);
    const value: FirstTouch = {
      landing_page: cleanUrl(url.href) ?? url.origin,
      original_referrer: cleanUrl(document.referrer),
      entry_brand: BRAND_KEY,
      first_landing_timestamp: new Date().toISOString(),
      ...readUtm(url.searchParams),
      ...readClickIds(url.searchParams),
    };
    store.setItem(FIRST_TOUCH_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable — attribution is best-effort, never blocking
  }
}

/** Merge immutable first-touch with the current last-touch context. */
export function getAttribution(): EcosystemAttribution {
  const empty: EcosystemAttribution = {
    landing_page: null,
    conversion_page: null,
    original_referrer: null,
    latest_referrer: null,
    first_touch_source: null,
    first_touch_medium: null,
    first_touch_campaign: null,
    last_touch_source: null,
    last_touch_medium: null,
    last_touch_campaign: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    gclid: null,
    gbraid: null,
    wbraid: null,
    msclkid: null,
    linkedin_click_id: null,
    fgv_journey_id: null,
    fgv_entry_brand: null,
    fgv_referrer: null,
    first_landing_timestamp: null,
    last_activity_timestamp: null,
  };
  if (typeof window === "undefined") return empty;

  const first = readFirstTouch();
  const url = new URL(window.location.href);
  const latest = readUtm(url.searchParams);
  const clicks = readClickIds(url.searchParams);
  const referrer = cleanUrl(document.referrer);

  return {
    ...empty,
    landing_page: first?.landing_page ?? cleanUrl(url.href),
    conversion_page: cleanUrl(url.href),
    original_referrer: first?.original_referrer ?? referrer,
    latest_referrer: referrer,
    first_touch_source: first?.utm_source ?? null,
    first_touch_medium: first?.utm_medium ?? null,
    first_touch_campaign: first?.utm_campaign ?? null,
    last_touch_source: latest.utm_source ?? first?.utm_source ?? null,
    last_touch_medium: latest.utm_medium ?? first?.utm_medium ?? null,
    last_touch_campaign: latest.utm_campaign ?? first?.utm_campaign ?? null,
    utm_source: latest.utm_source ?? first?.utm_source ?? null,
    utm_medium: latest.utm_medium ?? first?.utm_medium ?? null,
    utm_campaign: latest.utm_campaign ?? first?.utm_campaign ?? null,
    utm_content: latest.utm_content ?? first?.utm_content ?? null,
    utm_term: latest.utm_term ?? first?.utm_term ?? null,
    gclid: clicks.gclid ?? first?.gclid ?? null,
    gbraid: clicks.gbraid ?? first?.gbraid ?? null,
    wbraid: clicks.wbraid ?? first?.wbraid ?? null,
    msclkid: clicks.msclkid ?? first?.msclkid ?? null,
    linkedin_click_id: clicks.li_fat_id ?? first?.li_fat_id ?? null,
    fgv_journey_id: getJourneyId(),
    fgv_entry_brand: first?.entry_brand ?? BRAND_KEY,
    // Referrer only counts as a cross-brand hop when it is another FGV domain.
    fgv_referrer: isEcosystemReferrer(referrer) ? referrer : null,
    first_landing_timestamp: first?.first_landing_timestamp ?? null,
    last_activity_timestamp: new Date().toISOString(),
  };
}

const ECOSYSTEM_HOSTS = [
  "flowgroupventures.com",
  "taasflow.com",
  "omniflowco.com",
  "flowplaced.com",
  "neuronflowco.com",
];

export function isEcosystemReferrer(referrer: string | null): boolean {
  if (!referrer) return false;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    return ECOSYSTEM_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function getPageContext() {
  if (typeof window === "undefined") {
    return { source_page_url: null, source_page_title: null };
  }
  return {
    source_page_url: cleanUrl(window.location.href),
    source_page_title: trim(document.title, 300),
  };
}
