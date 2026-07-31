import { useEffect } from "react";
import { openCalendlyPopup } from "@/lib/calendly";
import { trackCtaClick } from "@/lib/tracking/pixels";

/** Text that should always open the Calendly popup, wherever it appears. */
const BOOKING_LABEL = /^book (a|your) (call|consultation)\b/i;

function shouldIntercept(el: HTMLElement): boolean {
  if (el.closest("[data-no-calendly]")) return false;
  if (el.closest("[data-calendly]")) return true;

  const control = el.closest<HTMLElement>("a[href], button");
  if (!control) return false;
  // Never hijack tabs, menus or real form submissions.
  if (control.getAttribute("role") === "tab") return false;
  if (control instanceof HTMLButtonElement && control.type === "submit") return false;

  const href = control.getAttribute("href") ?? "";
  if (href.startsWith("/book-call")) return true;

  const label = (control.textContent ?? "").trim();
  return BOOKING_LABEL.test(label);
}

/**
 * Renders the persistent Calendly badge and turns every "Book a call" control
 * in the app into a Calendly popup — one listener at the root instead of a
 * prop threaded through dozens of pages.
 */
export function CalendlyBadge() {
  useEffect(() => {
    void initBadge();

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target || !shouldIntercept(target)) return;
      event.preventDefault();
      trackCtaClick("book_a_call", { page_path: window.location.pathname });
      void openCalendlyPopup();
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.querySelector(".calendly-badge-widget")?.remove();
    };
  }, []);

  return null;
}

async function initBadge() {
  const { initCalendlyBadge } = await import("@/lib/calendly");
  await initCalendlyBadge();
}
