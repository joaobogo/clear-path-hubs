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

type CalendlyApi = {
  initPopupWidget?: (opts: { url: string }) => void;
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

export async function openCalendlyPopup() {
  await ensureCalendlyLoaded();
  calendly()?.initPopupWidget?.({ url: CALENDLY_URL });
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
