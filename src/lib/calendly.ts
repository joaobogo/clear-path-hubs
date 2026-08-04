/**
 * Calendly popup + badge loader.
 *
 * The widget assets are fetched on demand (first "Book a call" click, or when
 * the badge mounts) so no page pays for them up front. Every call is safe to
 * repeat — the script and stylesheet are only ever added once.
 */

const CALENDLY_URL = "https://calendly.com/christian-brogger-taasflow";
const WIDGET_SCRIPT_URL = "https://assets.calendly.com/assets/external/widget.js";
const WIDGET_CSS_URL = "https://assets.calendly.com/assets/external/widget.css";

export const CALENDLY_BOOKING_URL = CALENDLY_URL;

type CalendlyPrefill = { name?: string; email?: string };

type CalendlyApi = {
  initPopupWidget?: (opts: { url: string; prefill?: CalendlyPrefill }) => void;
  initInlineWidget?: (opts: {
    url: string;
    parentElement: HTMLElement;
    prefill?: CalendlyPrefill;
  }) => void;
  initBadgeWidget?: (opts: {
    url: string;
    text: string;
    color: string;
    textColor: string;
    branding: boolean;
  }) => void;
};

function calendly(): CalendlyApi | undefined {
  return (window as unknown as { Calendly?: CalendlyApi }).Calendly;
}

let scriptLoaded = false;

function ensureCalendlyLoaded(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }
  if (scriptLoaded && calendly()) return Promise.resolve();

  return new Promise((resolve) => {
    if (!document.querySelector(`link[href="${WIDGET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.href = WIDGET_CSS_URL;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const existing = document.querySelector(`script[src="${WIDGET_SCRIPT_URL}"]`);
    if (existing) {
      if (calendly()) {
        scriptLoaded = true;
        resolve();
      } else {
        existing.addEventListener("load", () => {
          scriptLoaded = true;
          resolve();
        });
        // Never leave a click hanging if the vendor script is blocked.
        existing.addEventListener("error", () => resolve());
      }
      return;
    }

    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

/**
 * Popup scheduler. Returns false when the vendor widget never loaded (blocked
 * by an extension, offline, CSP) so callers can fall back to a real link
 * instead of pretending a booking happened.
 */
export async function openCalendlyPopup(prefill?: CalendlyPrefill): Promise<boolean> {
  await ensureCalendlyLoaded();
  const api = calendly();
  if (!api?.initPopupWidget) return false;
  api.initPopupWidget({ url: CALENDLY_URL, prefill });
  return true;
}

/** Inline scheduler — survives navigation-free flows and popup blockers. */
export async function initCalendlyInline(
  parentElement: HTMLElement,
  prefill?: CalendlyPrefill,
): Promise<boolean> {
  await ensureCalendlyLoaded();
  const api = calendly();
  if (!api?.initInlineWidget) return false;
  parentElement.innerHTML = "";
  api.initInlineWidget({ url: CALENDLY_URL, parentElement, prefill });
  return true;
}

/**
 * Fires once the visitor actually confirms a time. Calendly posts this from the
 * embed; without listening for it we can only guess that a call was booked.
 */
export function onCalendlyScheduled(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: MessageEvent) => {
    const data = event.data as { event?: string } | null;
    if (typeof data === "object" && data && data.event === "calendly.event_scheduled") {
      handler();
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export async function initCalendlyBadge() {
  await ensureCalendlyLoaded();
  calendly()?.initBadgeWidget?.({
    url: CALENDLY_URL,
    text: "Schedule time with me",
    color: "#0069ff",
    textColor: "#ffffff",
    branding: true,
  });
}
