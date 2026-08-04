/**
 * Calendly embed layer.
 *
 * Calendly stays the scheduling infrastructure — it owns availability and the
 * host's calendar — but the visitor never leaves a TaaSFlow-designed page. This
 * module only mounts the inline widget and reports what it observes; it never
 * claims a booking happened.
 *
 * Everything here is public scheduling data. No API token, no signing key.
 */

const WIDGET_SCRIPT_URL = "https://assets.calendly.com/assets/external/widget.js";
const WIDGET_CSS_URL = "https://assets.calendly.com/assets/external/widget.css";
/** Past this, we show a controlled error state instead of spinning forever. */
const LOAD_TIMEOUT_MS = 12_000;

type CalendlyPrefill = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  customAnswers?: Record<string, string>;
};

type CalendlyUtm = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  salesforce_uuid?: string;
};

type InlineOptions = {
  url: string;
  parentElement: HTMLElement;
  prefill?: CalendlyPrefill;
  utm?: CalendlyUtm;
};

type CalendlyApi = {
  initInlineWidget?: (opts: InlineOptions) => void;
};

function calendly(): CalendlyApi | undefined {
  return (window as unknown as { Calendly?: CalendlyApi }).Calendly;
}

let loadPromise: Promise<boolean> | null = null;

/** Loads the widget assets once. Resolves false when they are unavailable. */
function ensureCalendlyLoaded(): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }
  if (calendly()) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (!ok) loadPromise = null; // allow an explicit retry
      resolve(ok);
    };

    if (!document.querySelector(`link[href="${WIDGET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.href = WIDGET_CSS_URL;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const timer = window.setTimeout(() => finish(Boolean(calendly())), LOAD_TIMEOUT_MS);
    const done = (ok: boolean) => {
      window.clearTimeout(timer);
      finish(ok && Boolean(calendly()));
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${WIDGET_SCRIPT_URL}"]`,
    );
    if (existing) {
      if (calendly()) return done(true);
      existing.addEventListener("load", () => done(true));
      existing.addEventListener("error", () => done(false));
      return;
    }

    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () => done(true);
    script.onerror = () => done(false);
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Query params that strip the vendor's own chrome so the scheduler reads as
 * part of the TaaSFlow page rather than a third-party page inside a frame.
 */
export function schedulerUrl(
  baseUrl: string,
  opts?: { hideDetails?: boolean; primaryColor?: string; textColor?: string; backgroundColor?: string },
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("hide_landing_page_details", "1");
  url.searchParams.set("hide_gdpr_banner", "1");
  if (opts?.hideDetails !== false) url.searchParams.set("hide_event_type_details", "1");
  if (opts?.primaryColor) url.searchParams.set("primary_color", opts.primaryColor);
  if (opts?.textColor) url.searchParams.set("text_color", opts.textColor);
  if (opts?.backgroundColor) url.searchParams.set("background_color", opts.backgroundColor);
  return url.toString();
}

export type InlineResult = { ok: true } | { ok: false; reason: "blocked" | "unsupported" };

/**
 * Mounts the inline scheduler. Survives popup blockers and never navigates the
 * visitor away. Returns a reason on failure so the caller can offer a retry
 * plus an honest external fallback.
 */
export async function mountCalendlyInline(params: {
  parentElement: HTMLElement;
  url: string;
  prefill?: CalendlyPrefill;
  utm?: CalendlyUtm;
  theme?: { primaryColor?: string; textColor?: string; backgroundColor?: string };
}): Promise<InlineResult> {
  const loaded = await ensureCalendlyLoaded();
  if (!loaded) return { ok: false, reason: "blocked" };
  const api = calendly();
  if (!api?.initInlineWidget) return { ok: false, reason: "unsupported" };

  params.parentElement.innerHTML = "";
  api.initInlineWidget({
    url: schedulerUrl(params.url, params.theme),
    parentElement: params.parentElement,
    prefill: params.prefill,
    utm: params.utm,
  });
  return { ok: true };
}

/* ------------------------------------------------------------- lifecycle -- */

export type CalendlyWidgetEvent =
  | "calendly.profile_page_viewed"
  | "calendly.event_type_viewed"
  | "calendly.date_and_time_selected"
  | "calendly.event_scheduled";

export type CalendlyScheduledPayload = {
  /** Calendly API URIs for the event and invitee, when the embed provides them. */
  eventUri: string | null;
  inviteeUri: string | null;
};

function calendlyOrigin(event: MessageEvent): boolean {
  return typeof event.origin === "string" && event.origin.endsWith("calendly.com");
}

/**
 * Subscribes to the embed's lifecycle messages. `event_scheduled` is the ONLY
 * trustworthy signal that a meeting exists; nothing upstream should treat form
 * submission as a booking.
 */
export function onCalendlyEvent(
  handler: (name: CalendlyWidgetEvent, payload: CalendlyScheduledPayload) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: MessageEvent) => {
    if (!calendlyOrigin(event)) return;
    const data = event.data as
      | { event?: string; payload?: { event?: { uri?: string }; invitee?: { uri?: string } } }
      | null;
    const name = data && typeof data === "object" ? data.event : undefined;
    if (typeof name !== "string" || !name.startsWith("calendly.")) return;
    handler(name as CalendlyWidgetEvent, {
      eventUri: data?.payload?.event?.uri ?? null,
      inviteeUri: data?.payload?.invitee?.uri ?? null,
    });
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
