/**
 * TaaSFlow tracking pixels.
 *
 * CONSENT: no tag (except GA4 in restricted mode) boots until its consent
 * category is granted. GA4 is initialized with 'denied' by default and
 * updated once allowed.
 *
 * Single source of truth for every third-party tag. All injection happens on
 * the client after hydration. Every function is wrapped so a blocked or
 * failing tag can never break the app.
 *
 * Live: GA4, Apollo website tracker, RB2B (Retention.com), LinkedIn Insight Tag.
 * Dormant until their env var is set: Meta, Clarity, Hotjar.
 */

import { type ConsentCategory } from "./consent";
import { resolveConversion } from "./conversion-map";



const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HJ2ECKCNK4";
const APOLLO_ID = import.meta.env.VITE_APOLLO_APP_ID || "6981f9ca9255870019505836";
/** Exported so the root document head can boot RB2B before hydration. */
export const RB2B_ID = import.meta.env.VITE_RB2B_ID || "1N5W0H7RVEO5";
const META_ID = import.meta.env.VITE_META_PIXEL_ID || "";
const LINKEDIN_ID = import.meta.env.VITE_LINKEDIN_PARTNER_ID || "10685401";
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

/**
 * Inline snippets rendered into the server-rendered `<head>` (see
 * `src/routes/__root.tsx`).
 *
 * GA4 starts immediately but restricted by Consent Mode v2 (denied by default).
 * Other trackers (Apollo, RB2B, LinkedIn, Meta) are now injected dynamically
 * by the client-side initialisers ONLY after consent is granted.
 */
export const HEAD_BOOT_SNIPPETS: { key: TrackerKey; children: string }[] = [
  // GA4: define dataLayer/gtag and consent state before gtag.js arrives.
  // We initialize with 'denied' to prevent storage before consent.
  ...(GA_ID
    ? [
        {
          key: "ga4" as TrackerKey,
          children: `(function(id){if(window.__tfGa4)return;window.__tfGa4=1;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config',id,{send_page_view:false,anonymize_ip:true,client_storage:'none'});var s=document.createElement('script');s.async=true;s.setAttribute('data-tracker','ga4');s.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(s);})(${JSON.stringify(GA_ID)});`,
        },
      ]
    : []),
];

/** True when a tag's script is already in the document (head snippet ran). */
function alreadyInDocument(key: TrackerKey): boolean {
  return (
    typeof document !== "undefined" &&
    !!document.querySelector(`script[data-tracker="${key}"]`)
  );
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
  if (alreadyInDocument("ga4")) {
    loaded.add("ga4");
    syncGA4Consent();
    return;
  }
  if (loaded.has("ga4") || !GA_ID) return;
  loaded.add("ga4");

  const allowed = isTrackerAllowed("ga4", "analytics");

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };

  window.gtag("consent", "default", {
    analytics_storage: allowed ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: false,
    anonymize_ip: true,
    ...(allowed ? {} : { client_storage: "none" }),
  });
  injectScript("ga4", { src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` });
}

/** Upgrades GA4 from cookieless to full measurement once analytics is allowed. */
function syncGA4Consent() {
  if (!window.gtag) return;
  const allowed = isTrackerAllowed("ga4", "analytics");
  window.gtag("consent", "update", {
    analytics_storage: allowed ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  if (allowed) {
    window.gtag("config", GA_ID, {
      send_page_view: false,
      anonymize_ip: true,
    });
  }
}


/* ------------------------------------------------------------- Apollo --- */

function initApollo() {
  // Already booted by the server-rendered head snippet — never double-load.
  if (alreadyInDocument("apollo")) {
    loaded.add("apollo");
    return;
  }
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
  // Already booted by the server-rendered head snippet — never double-load.
  if (alreadyInDocument("rb2b")) {
    loaded.add("rb2b");
    return;
  }
  // Primary boot is the inline snippet in the server-rendered head, so
  // identification starts while the document parses, before hydration and
  // before any consent choice. This is the fallback for anything the head
  // snippet missed; it never double-loads.
  if (loaded.has("rb2b") || !RB2B_ID) return;
  loaded.add("rb2b");
  if (typeof window !== "undefined" && window.reb2b) return;
  injectScript("rb2b", {
    // Current RB2B snippet (CloudFront delivery).
    text: `!function(key){if(window.reb2b)return;window.reb2b={loaded:true};var s=document.createElement("script");s.async=true;s.setAttribute("data-tracker","rb2b");s.src="https://ddwl4m2hdecbv.cloudfront.net/b/"+key+"/"+key+".js.gz";var first=document.getElementsByTagName("script")[0];first.parentNode.insertBefore(s,first);}("${RB2B_ID}");`,
  });
}



/* --------------------------------------------------- dormant trackers --- */

function initMeta() {
  // Already booted by the server-rendered head snippet — never double-load.
  if (alreadyInDocument("meta")) {
    loaded.add("meta");
    return;
  }
  if (loaded.has("meta") || !META_ID) return;
  loaded.add("meta");
  injectScript("meta", {
    text: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_ID}');fbq('track','PageView');`,
  });
}

function initLinkedIn() {
  // Already booted by the server-rendered head snippet — never double-load.
  if (alreadyInDocument("linkedin")) {
    loaded.add("linkedin");
    return;
  }
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

    window.addEventListener("securitypolicyviolation", (e) => {
      diagnostics.push({
        tracker: trackerForUri(e.blockedURI),
        uri: e.blockedURI,
        at: new Date().toISOString(),
      });
    });
  }

  // GA4 is special: it boots early but restricted.
  safe(initGA4);

  // Other trackers only boot if explicitly allowed.
  for (const key of Object.keys(INITIALISERS) as TrackerKey[]) {
    if (key === "ga4") continue;
    const category = TRACKER_CATEGORY[key];
    if (isTrackerAllowed(key, category)) {
      safe(INITIALISERS[key]);
    }
  }

  // Any view raised during hydration was queued — report it now.
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

/* ------------------------------------------------- session event log --- */

/** One tracked event, as it was fanned out to each provider. */
export type TrackedEventRecord = {
  /** Monotonic id within the session. */
  seq: number;
  at: string;
  /** Canonical event name, e.g. `page_view`, `form_submit`. */
  name: string;
  payload: Record<string, unknown>;
  ga4Event: string;
  label: string;
  metaEvent: string | null;
  linkedinConversionId: string | null;
  /** Which providers were actually reachable when the event fired. */
  delivered: string[];
  /** True while the event sits in the pre-boot queue. */
  queued: boolean;
};

const EVENT_LOG_LIMIT = 200;
const eventLog: TrackedEventRecord[] = [];
let eventSeq = 0;
const logListeners = new Set<() => void>();

function recordEvent(record: Omit<TrackedEventRecord, "seq" | "at">) {
  eventLog.push({ seq: ++eventSeq, at: new Date().toISOString(), ...record });
  if (eventLog.length > EVENT_LOG_LIMIT) eventLog.splice(0, eventLog.length - EVENT_LOG_LIMIT);
  logListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a broken listener must never break tracking */
    }
  });
}

/** Snapshot of every event tracked during this page session (newest last). */
export function getTrackedEvents(): TrackedEventRecord[] {
  return eventLog.slice();
}

/** Subscribe to event-log changes. Returns an unsubscribe function. */
export function subscribeTrackedEvents(listener: () => void): () => void {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

/** Clears the in-memory diagnostics log (does not affect the providers). */
export function clearTrackedEvents() {
  eventLog.length = 0;
  logListeners.forEach((l) => l());
}

function send(name: string, payload: Record<string, unknown>) {
  // Each provider gets its own event name and property shape — see
  // src/lib/tracking/conversion-map.ts for the canonical mapping table.
  const mapped = resolveConversion(name, payload);
  const delivered: string[] = [];

  // GA4 always receives the event; Consent Mode decides whether it is
  // cookieless or full. Session-recording tools stay consent-gated.
  if (window.gtag) delivered.push("ga4");
  window.gtag?.("event", mapped.ga4Event, payload);
  window.dataLayer?.push({ event: mapped.ga4Event, ...payload });
  if (window.clarity) delivered.push("clarity");
  window.clarity?.("event", mapped.label);
  if (window.hj) delivered.push("hotjar");
  window.hj?.("event", mapped.label);

  if (mapped.meta) {
    if (window.fbq) delivered.push("meta");
    window.fbq?.("track", mapped.meta.event, mapped.meta.params);
  }
  if (mapped.linkedin) {
    if (window.lintrk) delivered.push("linkedin");
    window.lintrk?.("track", mapped.linkedin);
  }

  recordEvent({
    name,
    payload,
    ga4Event: mapped.ga4Event,
    label: mapped.label,
    metaEvent: mapped.meta?.event ?? null,
    linkedinConversionId: mapped.linkedin ? String(mapped.linkedin) : null,
    delivered,
    queued: false,
  });
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
      if (pending.length < 50) {
        pending.push({ name, payload });
        const mapped = resolveConversion(name, payload);
        recordEvent({
          name,
          payload,
          ga4Event: mapped.ga4Event,
          label: mapped.label,
          metaEvent: mapped.meta?.event ?? null,
          linkedinConversionId: mapped.linkedin ? String(mapped.linkedin) : null,
          delivered: [],
          queued: true,
        });
      }
      return;
    }

    send(name, payload);
  });
}



/**
 * SPA navigations: several tags only measure a view at document load, so a
 * client-side route change needs an explicit nudge per provider on top of the
 * canonical `page_view` event.
 */
let firstViewReported = false;

function notifyRouteChange(params: Record<string, unknown>) {
  // The landing view is already measured by the head-boot snippets; only
  // subsequent client-side navigations need the manual nudge.
  if (!firstViewReported) {
    firstViewReported = true;
    return;
  }
  const path = String(params.page_path ?? "");
  const location = String(params.page_location ?? "");
  const title = String(params.page_title ?? "");

  // GA4: keep every subsequent event attributed to the new page.
  safe(() =>
    window.gtag?.("set", {
      page_path: path,
      page_location: location,
      page_title: title,
    }),
  );

  // Apollo: re-runs its page visit capture for the new URL.
  safe(() => window.trackingFunctions?.onLoad?.({ appId: APOLLO_ID }));

  // RB2B: re-trigger identification for the new page.
  safe(() => {
    const r = window.reb2b as
      | (Record<string, unknown> & { push?: (a: unknown) => void })
      | undefined;
    if (!r) return;
    if (typeof r.identify === "function") (r.identify as () => void)();
    else if (Array.isArray(r)) (r as unknown[]).push(["identify"]);
    else r.push?.(["identify"]);
  });

  // LinkedIn Insight Tag only reports on script load, so reload it per route.
  safe(() => {
    if (!LINKEDIN_ID || !window.lintrk) return;
    document
      .querySelectorAll('script[data-tracker-reload="linkedin"]')
      .forEach((el) => el.remove());
    const s = document.createElement("script");
    s.setAttribute("data-tracker-reload", "linkedin");
    s.async = true;
    s.setAttribute("data-tracker", "linkedin");
    s.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
    document.head.appendChild(s);
  });

  // Session-recording tools track virtual page changes explicitly.
  safe(() => window.hj?.("stateChange", location || path));
  safe(() => window.clarity?.("set", "page_path", path));
}

export function trackPageView(params: Record<string, unknown>) {
  // Single dispatch — trackEvent already fans out to GA4 and every other tag,
  // with duplicate suppression on (name + page_path).
  trackEvent("page_view", params);
  if (typeof window !== "undefined") notifyRouteChange(params);
}



/**
 * @deprecated Prefer `trackCtaClick` from `@/lib/tracking/conversions`, which
 * names the CTA location and destination explicitly. Kept as a thin alias so
 * existing call sites keep reporting the same canonical `cta_click` event.
 */
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

    const category = TRACKER_CATEGORY[key];
    const allowed = isTrackerAllowed(key, category);

    if (!allowed && key !== "ga4") {
      return { status: "missing", id, detail: `blocked by ${category} consent` };
    }

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
