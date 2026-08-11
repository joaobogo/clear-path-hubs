/**
 * TaaSFlow tracking pixels.
 *
 * CONSENT: region-based gate driven by the admin policy in
 * `public.tracking_policy` (edited at /admin/tracking). Only trackers the admin
 * marks strictly necessary may initialise before an affirmative choice — and an
 * essential GA4 runs cookieless (Consent Mode "denied") until consent. When
 * prior opt-in is required everywhere, no region is exempt; otherwise the gate
 * applies to the EU/EEA/UK/CH and other regions default to permitted.
 * Nothing initialises at all until the policy has been read.
 *
 * Single source of truth for every third-party tag. All injection happens on
 * the client after hydration. Every function is wrapped so a blocked or
 * failing tag can never break the app.
 *
 * Live: GA4, Apollo website tracker, RB2B (Retention.com).
 * Dormant until their env var is set: Meta, LinkedIn, Clarity, Hotjar.
 */

import {
  isAllowed,
  isTrackerAllowed,
  isTrackingPolicyLoaded,
  type ConsentCategory,
} from "./consent";



const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HJ2ECKCNK4";
const APOLLO_ID = import.meta.env.VITE_APOLLO_APP_ID || "6981f9ca9255870019505836";
const RB2B_ID = import.meta.env.VITE_RB2B_ID || "1N5W0H7RVEO5";
const META_ID = import.meta.env.VITE_META_PIXEL_ID || "";
const LINKEDIN_ID = import.meta.env.VITE_LINKEDIN_PARTNER_ID || "";
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID || "";
const HOTJAR_ID = import.meta.env.VITE_HOTJAR_ID || "";

type TrackerKey =
  | "ga4"
  | "apollo"
  | "rb2b"
  | "meta"
  | "linkedin"
  | "clarity"
  | "hotjar";

type TrackerStatus = {
  status: "loaded" | "pending" | "missing" | "missing-config";
  id: string | null;
  detail: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
    _fbq?: unknown;
    lintrk?: ((...args: unknown[]) => void) & { q?: unknown[] };
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
    clarity?: (...args: unknown[]) => void;
    hj?: ((...args: unknown[]) => void) & { q?: unknown[] };
    _hjSettings?: { hjid: number; hjsv: number };
    reb2b?: { loaded?: boolean; invoked?: boolean; SNIPPET_VERSION?: string } | unknown[];
    trackingFunctions?: { onLoad?: (opts: { appId: string }) => void };
    _taasflow_tracking?: {
      initialized: boolean;
      diagnostics: Array<{ tracker: string; uri: string; at: string }>;
      verify: () => Record<TrackerKey, TrackerStatus>;
    };
  }
}

const safe = (fn: () => void) => {
  try {
    fn();
  } catch {
    /* tracking must never break the app */
  }
};

const loaded = new Set<TrackerKey>();

function injectScript(
  key: TrackerKey,
  attrs: { src?: string; text?: string; async?: boolean; id?: string },
) {
  if (typeof document === "undefined") return;
  const el = document.createElement("script");
  el.setAttribute("data-tracker", key);
  if (attrs.id) el.id = attrs.id;
  if (attrs.src) {
    el.src = attrs.src;
    el.async = attrs.async ?? true;
  }
  if (attrs.text) el.text = attrs.text;
  document.head.appendChild(el);
}

/* ---------------------------------------------------------------- GA4 --- */

function initGA4() {
  if (loaded.has("ga4") || !GA_ID) return;
  loaded.add("ga4");
  const granted = isAllowed("analytics");
  window.dataLayer = window.dataLayer || [];
  // gtag.js only processes dataLayer entries that are real `arguments`
  // objects — pushing a plain array is silently ignored and nothing is sent.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };

  // Consent Mode v2. Before an affirmative choice GA4 runs cookieless:
  // no analytics/ad storage, no advertising signals, aggregate traffic only.
  window.gtag("consent", "default", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  window.gtag("js", new Date());
  // SPA: page views are dispatched manually on route change.
  window.gtag("config", GA_ID, {
    send_page_view: false,
    anonymize_ip: true,
    ...(granted ? {} : { client_storage: "none" }),
  });
  injectScript("ga4", { src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` });
}

/** Upgrades GA4 from cookieless to full measurement once analytics is allowed. */
function syncGA4Consent() {
  if (!loaded.has("ga4") || !window.gtag) return;
  const granted = isAllowed("analytics");
  window.gtag("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (granted) {
    window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });
  }
}


/* ------------------------------------------------------------- Apollo --- */

function initApollo() {
  if (loaded.has("apollo") || !APOLLO_ID) return;
  loaded.add("apollo");
  injectScript("apollo", {
    src: `https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache=${Math.random().toString(36).slice(2)}`,
  });
  const start = Date.now();
  const poll = window.setInterval(() => {
    if (window.trackingFunctions?.onLoad) {
      window.clearInterval(poll);
      safe(() => window.trackingFunctions!.onLoad!({ appId: APOLLO_ID }));
    } else if (Date.now() - start > 15_000) {
      window.clearInterval(poll);
    }
  }, 250);
}

/* --------------------------------------------------------------- RB2B --- */

function initRB2B() {
  // Loads on every page view, before any consent choice, so visitor
  // identification starts on the first pageview.
  if (loaded.has("rb2b") || !RB2B_ID) return;
  loaded.add("rb2b");
  injectScript("rb2b", {
    // Current RB2B snippet (CloudFront delivery).
    text: `!function(key){if(window.reb2b)return;window.reb2b={loaded:true};var s=document.createElement("script");s.async=true;s.setAttribute("data-tracker","rb2b");s.src="https://ddwl4m2hdecbv.cloudfront.net/b/"+key+"/"+key+".js.gz";var first=document.getElementsByTagName("script")[0];first.parentNode.insertBefore(s,first);}("${RB2B_ID}");`,
  });
}



/* --------------------------------------------------- dormant trackers --- */

function initMeta() {
  if (loaded.has("meta") || !META_ID) return;
  loaded.add("meta");
  injectScript("meta", {
    text: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_ID}');fbq('track','PageView');`,
  });
}

function initLinkedIn() {
  if (loaded.has("linkedin") || !LINKEDIN_ID) return;
  loaded.add("linkedin");
  window._linkedin_partner_id = LINKEDIN_ID;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(LINKEDIN_ID);
  injectScript("linkedin", {
    text: `(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s)})(window.lintrk);`,
  });
}

function initClarity() {
  if (loaded.has("clarity") || !CLARITY_ID) return;
  loaded.add("clarity");
  injectScript("clarity", {
    text: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${CLARITY_ID}");`,
  });
}

function initHotjar() {
  if (loaded.has("hotjar") || !HOTJAR_ID) return;
  loaded.add("hotjar");
  injectScript("hotjar", {
    text: `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${Number(HOTJAR_ID) || 0},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j;a.appendChild(r)})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
  });
}

/* ---------------------------------------------------------- lifecycle --- */

/** Which consent category each tracker belongs to. */
export const TRACKER_CATEGORY: Record<TrackerKey, ConsentCategory> = {
  ga4: "analytics",
  clarity: "analytics",
  hotjar: "analytics",
  apollo: "marketing",
  rb2b: "marketing",
  meta: "marketing",
  linkedin: "marketing",
};

const INITIALISERS: Record<TrackerKey, () => void> = {
  ga4: initGA4,
  apollo: initApollo,
  rb2b: initRB2B,
  meta: initMeta,
  linkedin: initLinkedIn,
  clarity: initClarity,
  hotjar: initHotjar,
};

/**
 * Boots every tracker whose consent category is permitted. Safe to call again
 * after the visitor changes their choice — already-loaded tags are skipped and
 * newly permitted ones start.
 */
export function initializeTrackers() {
  if (typeof window === "undefined") return;

  if (!window._taasflow_tracking?.initialized) {
    const diagnostics: Array<{ tracker: string; uri: string; at: string }> = [];
    window._taasflow_tracking = {
      initialized: true,
      diagnostics,
      verify: verifyTrackers,
    };

    // Attribute CSP blocks to the owning tracker for debugging.
    window.addEventListener("securitypolicyviolation", (e) => {
      diagnostics.push({
        tracker: trackerForUri(e.blockedURI),
        uri: e.blockedURI,
        at: new Date().toISOString(),
      });
    });
  }

  // RB2B fires on every page view, independent of the consent policy: it is
  // treated as strictly necessary B2B firmographic identification here.
  safe(initRB2B);

  // Nothing else initialises until the admin-configured policy is known: on a
  // first visit that means one tick after hydration, on a repeat visit the
  // cached policy answers immediately.
  if (!isTrackingPolicyLoaded()) return;

  for (const key of Object.keys(INITIALISERS) as TrackerKey[]) {
    if (key === "rb2b") continue; // already started above
    // Only trackers on the admin's strictly-necessary list may run before an
    // affirmative choice. Essential GA4 runs cookieless until consent.
    if (!isTrackerAllowed(key, TRACKER_CATEGORY[key])) continue;
    safe(INITIALISERS[key]);
  }


  // Reflect the current choice onto an already-loaded GA4 instance.
  safe(syncGA4Consent);

  // Any view raised during hydration (a direct page load always raises one)
  // was queued because no tracker existed yet — report it now.
  safe(flushPendingEvents);
}



function trackerForUri(uri: string): string {
  if (/google-analytics|googletagmanager/.test(uri)) return "ga4";
  if (/apollo\.io/.test(uri)) return "apollo";
  if (/b2bjsstore|ddwl4m2hdecbv|liadm|usbrowserspeed/.test(uri)) return "rb2b";
  if (/facebook|fbcdn/.test(uri)) return "meta";
  if (/licdn/.test(uri)) return "linkedin";
  if (/clarity\.ms/.test(uri)) return "clarity";
  if (/hotjar/.test(uri)) return "hotjar";
  return "unknown";
}

/* -------------------------------------------------------------- events -- */

const PII_KEYS = new Set([
  "email","phone","name","fullName","full_name","cv","resume","score","candidateId",
  "candidate_id","clientId","client_id","address","password","rawText","parsedData",
  "internalNote","adminComment","feedback","applicationId","application_id","cvUrl",
  "cv_url","resumeUrl","resume_url","adminNote","clientNote","token","access_token",
]);

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

function clean(params: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (PII_KEYS.has(k)) continue;
    if (typeof v === "string" && EMAIL_RE.test(v)) continue;
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

const META_EVENT_MAP: Record<string, string> = {
  page_view: "PageView",
  view_job_board: "ViewContent",
  view_job: "ViewContent",
  application_started: "InitiateCheckout",
  cv_selected: "AddPaymentInfo",
  application_submitted: "SubmitApplication",
  contact_form_submitted: "Contact",
  candidate_signup_started: "CompleteRegistration",
  candidate_account_invited: "CompleteRegistration",
};

const recent = new Map<string, number>();

/**
 * Events raised before any tracker booted. On a direct page load the first
 * page_view is dispatched during hydration, while the admin tracking policy is
 * still in flight, so GA4 does not exist yet and `send_page_view: false` means
 * nothing else reports that view. Hold those events here and flush them once
 * initialisation completes; drop them if no tracker is ever allowed.
 */
const pending: Array<{ name: string; payload: Record<string, unknown> }> = [];
let flushed = false;

/** Called from initializeTrackers once the policy is known. */
function flushPendingEvents() {
  flushed = true;
  const queued = pending.splice(0, pending.length);
  // No GA4 (declined and not strictly necessary) — the queue is dropped, never
  // replayed to a tracker the visitor did not allow.
  if (!window.gtag) return;
  for (const { name, payload } of queued) send(name, payload);
}

function send(name: string, payload: Record<string, unknown>) {
  // GA4 always receives the event; Consent Mode decides whether it is
  // cookieless or full. Session-recording tools stay consent-gated.
  window.gtag?.("event", name, payload);
  window.dataLayer?.push({ event: name, ...payload });
  if (isAllowed("analytics")) {
    window.clarity?.("event", name);
    window.hj?.("event", name);
  }

  if (isAllowed("marketing")) {
    const metaName = META_EVENT_MAP[name];
    if (metaName) window.fbq?.("track", metaName, payload);
    window.lintrk?.("track", { conversion_id: name });
  }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  // GA4 accepts events pre-consent because it runs cookieless in that state.
  // Storage-writing tags below stay behind their own category gate.
  safe(() => {
    const payload = clean(params);
    const key = `${name}|${String(payload.page_path ?? payload.cta ?? "")}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < 500) return;
    recent.set(key, now);
    if (recent.size > 200) recent.clear();

    if (!flushed && !window.gtag) {
      if (pending.length < 50) pending.push({ name, payload });
      return;
    }

    send(name, payload);
  });
}


export function trackPageView(params: Record<string, unknown>) {
  // Single dispatch — trackEvent already fans out to GA4 and every other tag,
  // with duplicate suppression on (name + page_path).
  trackEvent("page_view", params);
}


export function trackCtaClick(cta: string, params: Record<string, unknown> = {}) {
  trackEvent("cta_click", { cta, ...params });
}

/* --------------------------------------------------------- verification -- */

export function verifyTrackers(): Record<TrackerKey, TrackerStatus> {
  const has = (key: TrackerKey) =>
    typeof document !== "undefined" &&
    !!document.querySelector(`script[data-tracker="${key}"]`);

  const build = (
    key: TrackerKey,
    id: string,
    ready: boolean,
  ): TrackerStatus => {
    if (!id) return { status: "missing-config", id: null, detail: "env var not set" };
    if (ready) return { status: "loaded", id, detail: "global present" };
    if (has(key)) return { status: "pending", id, detail: "script injected, global not ready" };
    return { status: "missing", id, detail: "not injected" };
  };

  const w = typeof window === "undefined" ? ({} as Window) : window;
  return {
    ga4: build("ga4", GA_ID, typeof w.gtag === "function"),
    apollo: build("apollo", APOLLO_ID, !!w.trackingFunctions?.onLoad),
    rb2b: build("rb2b", RB2B_ID, !!w.reb2b),
    meta: build("meta", META_ID, typeof w.fbq === "function"),
    linkedin: build("linkedin", LINKEDIN_ID, typeof w.lintrk === "function"),
    clarity: build("clarity", CLARITY_ID, typeof w.clarity === "function"),
    hotjar: build("hotjar", HOTJAR_ID, typeof w.hj === "function"),
  };
}
