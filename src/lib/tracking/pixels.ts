/**
 * TaaSFlow tracking pixels.
 *
 * CONSENT: RB2B is exempt — it runs on every public page whatever the visitor
 * chose (owner's decision, 2026-09-07; see rb2bHeadLinks below and
 * ALWAYS_ON_TRACKERS in ./consent). GA4 boots restricted by Consent Mode with
 * storage denied and upgrades only if analytics is allowed. Every OTHER tag
 * waits for its consent category, where "permitted before the visitor decides"
 * is the regional rule in ./consent — prior opt-in in the EU/EEA, UK and
 * Switzerland, permitted by default elsewhere.
 *
 * Single source of truth for every third-party tag. RB2B is a server-rendered
 * head tag; everything else is injected on the client. Every function is
 * wrapped so a blocked or failing tag can never break the app.
 *
 * Live: GA4, RB2B (Retention.com), LinkedIn Insight Tag.
 * Dormant until their env var is set: Meta, Clarity, Hotjar.
 */

import { type ConsentCategory, isTrackerAllowed } from "./consent";
import { resolveConversion } from "./conversion-map";



const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HJ2ECKCNK4";

/**
 * The signed-in workspace. No analytics runs here, at all.
 *
 * ONE definition. The inline head snippet below is a string of JavaScript, so
 * it cannot import this — it is built from the same array instead, and
 * pixels-workspace-gate.test.ts asserts the two agree. A second hand-written
 * copy of the path list would be free to drift out of step with the React gate
 * in __root.tsx, which is how GA came to run inside the workspace at all.
 */
export const WORKSPACE_PATH_PREFIXES = ["admin", "client", "me"] as const;

export function isWorkspacePath(pathname: string): boolean {
  // Case-INSENSITIVE, because the router is: TanStack matches routes with
  // caseSensitive false by default, so /Client?org=<uuid> and /ADMIN/candidates
  // serve the workspace. A case-sensitive guard let those URLs through and ran
  // trackers over a page carrying an organisation id.
  const l = pathname.toLowerCase();
  return WORKSPACE_PATH_PREFIXES.some((p) => l === `/${p}` || l.startsWith(`/${p}/`));
}

/** The same test, as source, for the inline snippet that runs before React. */
const WORKSPACE_TEST_JS = `[${WORKSPACE_PATH_PREFIXES.map((p) => JSON.stringify(`/${p}`)).join(
  ",",
)}].some(function(p){var l=location.pathname.toLowerCase();return l===p||l.indexOf(p+"/")===0})`;

/** GA4's documented kill switch. Set before gtag.js loads, it never sends. */
export function gaDisableFlag(): string {
  return `ga-disable-${GA_ID}`;
}

/**
 * Stop or resume GA for the current route.
 *
 * The head snippet boots GA before any React gate can run, so route-gating the
 * observer and the banner was not enough: gtag.js still loaded on /admin,
 * /client and /me and Consent Mode still transmitted, carrying the workspace
 * URL — including the client organisation id in the query string — to Google
 * (audit #8, TF8-03 and TF8-04). This is also the only thing that helps after
 * a client-side navigation from a public page, where gtag is already resident.
 */
export function setAnalyticsDisabledForRoute(disabled: boolean): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>)[gaDisableFlag()] = disabled;
}
/** Exported so the root document head can boot RB2B before hydration. */
export const RB2B_ID = import.meta.env.VITE_RB2B_ID || "1N5W0H7RVEO5";
const META_ID = import.meta.env.VITE_META_PIXEL_ID || "";
const LINKEDIN_ID = import.meta.env.VITE_LINKEDIN_PARTNER_ID || "10685401";
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID || "";
const HOTJAR_ID = import.meta.env.VITE_HOTJAR_ID || "";

type TrackerKey =
  | "ga4"
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
    _taasflow_tracking?: {
      initialized: boolean;
      diagnostics: Array<{ tracker: string; uri: string; at: string }>;
      verify: () => Record<TrackerKey, TrackerStatus>;
    };
  }
}

/** RB2B's CDN and API — preconnected from the root head so the boot is not waiting on DNS/TLS. */
export const RB2B_ORIGINS = ["https://ddwl4m2hdecbv.cloudfront.net", "https://app.rb2b.com"] as const;

/** The vendor script for this account. */
export const RB2B_SRC = RB2B_ID
  ? `https://ddwl4m2hdecbv.cloudfront.net/b/${RB2B_ID}/${RB2B_ID}.js.gz`
  : "";

/**
 * RB2B's head tags for a path — the ONLY place it is booted on a document load.
 *
 * RB2B runs unconditionally on public pages: before hydration, before the
 * tracking policy is read, whatever the visitor's region or consent choice.
 * Owner's decision (2026-09-07): it is the lead-identification tool, a visitor
 * who bounces early is exactly the one worth identifying, and the consent gate
 * had kept it from firing at all.
 *
 * Two deliberate choices about HOW:
 *
 * 1. An external `async` script, not an inline loader. An inline script cannot
 *    execute while a stylesheet is still loading, and this head links the
 *    Google Fonts CSS — so an inline RB2B loader waited on a cold
 *    fonts.googleapis.com round trip before it could even reveal the vendor
 *    URL. An external tag is found by the preload scanner during initial parse
 *    and, being async, executes the moment it arrives. The `preload` link
 *    below sits ahead of the stylesheets in the head, so the fetch starts
 *    first.
 *
 * 2. The workspace exclusion is decided HERE, on the server, from the matched
 *    path — so the tag is simply absent from /admin, /client and /me HTML
 *    rather than present-but-guarded. A visit there is never a lead and those
 *    URLs carry organisation and candidate ids.
 */
type HeadLink = {
  rel: string;
  href: string;
  as?: string;
  fetchPriority?: "high" | "low" | "auto";
};

type HeadScript = { src: string; async: boolean; "data-tracker": string };

export function rb2bHeadLinks(pathname: string): HeadLink[] {
  if (!RB2B_SRC || isWorkspacePath(pathname)) return [];
  return [
    ...RB2B_ORIGINS.flatMap((href): HeadLink[] => [
      { rel: "preconnect", href },
      { rel: "dns-prefetch", href },
    ]),
    { rel: "preload", as: "script", href: RB2B_SRC, fetchPriority: "high" },
  ];
}

export function rb2bHeadScripts(pathname: string): HeadScript[] {
  if (!RB2B_SRC || isWorkspacePath(pathname)) return [];
  // data-tracker is what `alreadyInDocument` looks for, so the client
  // initialiser sees this tag and never loads a second copy.
  return [{ src: RB2B_SRC, async: true, "data-tracker": "rb2b" }];
}

/**
 * Inline snippets rendered into the server-rendered `<head>` (see
 * `src/routes/__root.tsx`).
 *
 * GA4 only. It starts immediately but restricted by Consent Mode v2 (denied by
 * default). RB2B is not here — it is an external tag, see above. Every other
 * tracker (LinkedIn, Meta, Clarity, Hotjar) is injected by the client-side
 * initialisers only once its category is permitted.
 */
export const HEAD_BOOT_SNIPPETS: { key: TrackerKey; children: string }[] = [
  // GA4: define dataLayer/gtag and consent state before gtag.js arrives.
  // We initialize with 'denied' to prevent storage before consent.
  ...(GA_ID
    ? [
        {
          key: "ga4" as TrackerKey,
          children: `(function(id){if(window.__tfGa4)return;if(${WORKSPACE_TEST_JS}){window["ga-disable-"+id]=true;return;}window.__tfGa4=1;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config',id,{send_page_view:false,anonymize_ip:true,client_storage:'none'});var s=document.createElement('script');s.async=true;s.setAttribute('data-tracker','ga4');s.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(s);})(${JSON.stringify(GA_ID)});`,
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
    return;
  }
  // Denying analytics_storage stops GA writing NEW cookies; it does not remove
  // ones already on the origin, so a visitor who declined kept a _ga carrying
  // a persistent client id and a session count, and the next hit sent that id
  // (audit #8, TF8-05). Withdrawing consent has to undo what consent created.
  clearGaCookies();
}

/** Remove GA's own cookies (_ga and _ga_<measurement id>) from this origin. */
function clearGaCookies(): void {
  if (typeof document === "undefined") return;
  try {
    const names = document.cookie
      .split(";")
      .map((c) => c.split("=")[0]?.trim() ?? "")
      .filter((n) => n === "_ga" || n.startsWith("_ga_"));
    // GA writes on the registrable domain, so clearing has to be attempted on
    // each parent of the current host as well as the bare host.
    const host = window.location.hostname;
    const parts = host.split(".");
    const domains = ["", host, ...parts.map((_, i) => "." + parts.slice(i).join("."))];
    for (const name of new Set(names)) {
      for (const domain of new Set(domains)) {
        document.cookie =
          `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` +
          (domain ? `; domain=${domain}` : "");
      }
    }
  } catch {
    /* tracking must never break the app */
  }
}


/* --------------------------------------------------------------- RB2B --- */

function initRB2B() {
  // The normal case: the server-rendered head tag is already there.
  if (alreadyInDocument("rb2b")) {
    loaded.add("rb2b");
    return;
  }
  // Fallback only — a document served WITHOUT the tag, which means the head
  // was rendered for a workspace path. Reached when the visitor then navigates
  // client-side to a public page. RB2B is always-on, so the consent loop
  // always calls this; the guard above is what prevents a second copy.
  if (loaded.has("rb2b") || !RB2B_SRC) return;
  if (typeof window === "undefined" || isWorkspacePath(window.location.pathname)) return;
  loaded.add("rb2b");
  if (window.reb2b) return;
  injectScript("rb2b", { src: RB2B_SRC, async: true });
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
  rb2b: "marketing",
  meta: "marketing",
  linkedin: "marketing",
};

const INITIALISERS: Record<TrackerKey, () => void> = {
  ga4: initGA4,
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

  // Every tracker except GA4 boots only if `isTrackerAllowed` says so. GA4
  // stays special: it loads in Consent Mode v2 with storage denied, and
  // upgrades when analytics consent arrives. RB2B passes the gate always — it
  // is on ALWAYS_ON_TRACKERS in ./consent — and has normally been booted by
  // the head snippet already, so its initialiser is a no-op here.
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
  // app.rb2b.com is the API the vendor script calls once loaded; without it a
  // CSP violation on the newly declared origin would be logged as "unknown".
  if (/b2bjsstore|ddwl4m2hdecbv|rb2b\.com|liadm|usbrowserspeed/.test(uri)) return "rb2b";
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

  // RB2B: re-trigger identification for the new page.
  //
  // This used to call `r.identify()`, fall back to `r.push(["identify"])`, and
  // fall back again to array push. The vendor object exposes NONE of those —
  // it is a frozen `{loaded, assignIdentity, collect}` — so all three branches
  // were silent no-ops and RB2B only ever saw the landing page. On a SPA that
  // means a visitor who arrives on / and reads three more pages counted once.
  // `collect` is the method it actually exposes.
  //
  // Guarded on the path: the vendor script can still be resident after a
  // client-side navigation into the workspace (sign-in hands off that way),
  // and a re-collect there would carry a URL with an organisation id.
  safe(() => {
    const r = window.reb2b as { collect?: () => void } | undefined;
    if (!r || typeof r.collect !== "function") return;
    if (isWorkspacePath(path || window.location.pathname)) return;
    r.collect();
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

    // What is actually running comes first. A tag that booted under an
    // earlier policy, or before consent was withdrawn, is still running — a
    // diagnostic that reads "blocked by consent" for a script that is present
    // and executing would be describing the rule, not the page.
    if (ready) return { status: "loaded", id, detail: "global present" };
    if (has(key)) return { status: "pending", id, detail: "script injected, global not ready" };

    // RB2B always passes the gate (ALWAYS_ON_TRACKERS), so `allowed` is true
    // for it and a missing RB2B correctly reads "not injected" — which on a
    // workspace path is the intended state, not a fault.
    if (!allowed && key !== "ga4") {
      return { status: "missing", id, detail: `blocked by ${category} consent` };
    }
    return { status: "missing", id, detail: "not injected" };
  };

  const w = typeof window === "undefined" ? ({} as Window) : window;
  return {
    ga4: build("ga4", GA_ID, typeof w.gtag === "function"),
    rb2b: build("rb2b", RB2B_ID, !!w.reb2b),
    meta: build("meta", META_ID, typeof w.fbq === "function"),
    linkedin: build("linkedin", LINKEDIN_ID, typeof w.lintrk === "function"),
    clarity: build("clarity", CLARITY_ID, typeof w.clarity === "function"),
    hotjar: build("hotjar", HOTJAR_ID, typeof w.hj === "function"),
  };
}
