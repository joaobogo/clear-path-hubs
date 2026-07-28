/**
 * TaaSFlow tracking pixels.
 *
 * Single source of truth for every third-party tag. All injection happens on
 * the client after hydration. Every function is wrapped so a blocked or
 * failing tag can never break the app.
 *
 * Live: GA4, Apollo website tracker, RB2B (Retention.com).
 * Dormant until their env var is set: Meta, LinkedIn, Clarity, Hotjar.
 */

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
    reb2b?: unknown[] & { invoked?: boolean; SNIPPET_VERSION?: string };
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
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  // SPA: page views are dispatched manually on route change.
  window.gtag("config", GA_ID, { send_page_view: false });
  injectScript("ga4", { src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` });
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
  if (loaded.has("rb2b") || !RB2B_ID) return;
  loaded.add("rb2b");
  // Vendor snippet, verbatim semantics: reb2b is an array-based queue that the
  // remote bundle drains once it loads.
  injectScript("rb2b", {
    text: `!function(){var reb2b=window.reb2b=window.reb2b||[];if(reb2b.invoked)return;reb2b.invoked=true;reb2b.methods=["identify","collect"];reb2b.factory=function(method){return function(){var args=Array.prototype.slice.call(arguments);args.unshift(method);reb2b.push(args);return reb2b;};};for(var i=0;i<reb2b.methods.length;i++){var key=reb2b.methods[i];reb2b[key]=reb2b.factory(key);}reb2b.load=function(key){var script=document.createElement("script");script.type="text/javascript";script.async=true;script.setAttribute("data-tracker","rb2b");script.src="https://s3-us-west-2.amazonaws.com/b2bjsstore/b/"+key+"/reb2b.js.gz";var first=document.getElementsByTagName("script")[0];first.parentNode.insertBefore(script,first);};reb2b.SNIPPET_VERSION="1.0.1";reb2b.load("${RB2B_ID}");}();`,
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

export function initializeTrackers() {
  if (typeof window === "undefined") return;
  if (window._taasflow_tracking?.initialized) return;

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

  safe(initGA4);
  safe(initApollo);
  safe(initRB2B);
  safe(initMeta);
  safe(initLinkedIn);
  safe(initClarity);
  safe(initHotjar);
}

function trackerForUri(uri: string): string {
  if (/google-analytics|googletagmanager/.test(uri)) return "ga4";
  if (/apollo\.io/.test(uri)) return "apollo";
  if (/b2bjsstore|liadm|usbrowserspeed/.test(uri)) return "rb2b";
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

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  safe(() => {
    const payload = clean(params);
    const key = `${name}|${String(payload.page_path ?? payload.cta ?? "")}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < 500) return;
    recent.set(key, now);
    if (recent.size > 200) recent.clear();

    window.gtag?.("event", name, payload);
    window.dataLayer?.push({ event: name, ...payload });
    const metaName = META_EVENT_MAP[name];
    if (metaName) window.fbq?.("track", metaName, payload);
    window.lintrk?.("track", { conversion_id: name });
    window.clarity?.("event", name);
    window.hj?.("event", name);
  });
}

export function trackPageView(params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  safe(() => {
    window.gtag?.("event", "page_view", clean(params));
  });
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
    rb2b: build("rb2b", RB2B_ID, !!w.reb2b?.invoked),
    meta: build("meta", META_ID, typeof w.fbq === "function"),
    linkedin: build("linkedin", LINKEDIN_ID, typeof w.lintrk === "function"),
    clarity: build("clarity", CLARITY_ID, typeof w.clarity === "function"),
    hotjar: build("hotjar", HOTJAR_ID, typeof w.hj === "function"),
  };
}
