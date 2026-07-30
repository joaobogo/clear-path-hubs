/**
 * First-touch and latest-touch attribution capture (browser only).
 * Stores no personal information — campaign and page context only.
 */

const FIRST_TOUCH_KEY = "taasflow.attribution.first";

export type Attribution = {
  landing_page: string | null;
  original_referrer: string | null;
  latest_referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

type FirstTouch = {
  landing_page: string;
  original_referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

function readUtm(search: URLSearchParams) {
  const get = (k: string) => {
    const v = search.get(k);
    return v && v.trim().length > 0 ? v.trim().slice(0, 200) : null;
  };
  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_content: get("utm_content"),
    utm_term: get("utm_term"),
  };
}

/** Call once on app start (client side). Safe to call repeatedly. */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(FIRST_TOUCH_KEY)) return;
    const url = new URL(window.location.href);
    const value: FirstTouch = {
      landing_page: `${url.origin}${url.pathname}`,
      original_referrer: document.referrer || null,
      ...readUtm(url.searchParams),
    };
    window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable — attribution is best-effort
  }
}

function readFirstTouch(): FirstTouch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FIRST_TOUCH_KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : null;
  } catch {
    return null;
  }
}

/** Merge first-touch with the current (latest-touch) context at submit time. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") {
    return {
      landing_page: null,
      original_referrer: null,
      latest_referrer: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
    };
  }
  const first = readFirstTouch();
  const url = new URL(window.location.href);
  const latest = readUtm(url.searchParams);
  return {
    landing_page: first?.landing_page ?? `${url.origin}${url.pathname}`,
    original_referrer: first?.original_referrer ?? (document.referrer || null),
    latest_referrer: document.referrer || null,
    utm_source: latest.utm_source ?? first?.utm_source ?? null,
    utm_medium: latest.utm_medium ?? first?.utm_medium ?? null,
    utm_campaign: latest.utm_campaign ?? first?.utm_campaign ?? null,
    utm_content: latest.utm_content ?? first?.utm_content ?? null,
    utm_term: latest.utm_term ?? first?.utm_term ?? null,
  };
}

export function getPageContext() {
  if (typeof window === "undefined") {
    return { source_page_url: null, source_page_title: null };
  }
  const url = new URL(window.location.href);
  return {
    source_page_url: `${url.origin}${url.pathname}`,
    source_page_title: document.title || null,
  };
}
