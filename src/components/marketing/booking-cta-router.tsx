import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { BOOKING_ROUTE, LEGACY_BOOKING_PATHS } from "@/config/booking";
import { trackCtaClick } from "@/lib/tracking/pixels";

/** Text that should always land on the TaaSFlow scheduler, wherever it appears. */
const BOOKING_LABEL = /^(book (a|your) (call|consultation|demo)|talk to sales|request a demo)\b/i;

/** Signed-in workspace paths own their own in-app scheduling surfaces. */
const WORKSPACE_PATHS = ["/client", "/admin", "/me", "/boardroom"];

function inWorkspace(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  return WORKSPACE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function ctaTarget(el: HTMLElement): { to: string; label: string } | null {
  if (el.closest("[data-no-booking]")) return null;
  if (inWorkspace()) return null;

  const control = el.closest<HTMLElement>("a[href], button");
  if (!control) return null;
  if (control.getAttribute("role") === "tab") return null;
  if (control instanceof HTMLButtonElement && control.type === "submit") return null;

  const href = control.getAttribute("href") ?? "";
  // Already going to the canonical flow — let the router handle it normally.
  if (href.startsWith(BOOKING_ROUTE)) return null;

  const label = (control.textContent ?? "").trim().slice(0, 60) || "book_a_call";

  // Legacy paths and stray external Calendly links get redirected in-app.
  if (LEGACY_BOOKING_PATHS.some((p) => href === p || href.startsWith(`${p}?`))) {
    return { to: BOOKING_ROUTE, label };
  }
  if (/^https?:\/\/([a-z0-9-]+\.)?calendly\.com\//i.test(href)) {
    return { to: BOOKING_ROUTE, label };
  }
  if (!href && BOOKING_LABEL.test(label)) return { to: BOOKING_ROUTE, label };
  return null;
}

/**
 * Routes every "book a call / demo / talk to sales" control in the marketing
 * site to the single native scheduler at /book — one root listener instead of a
 * prop threaded through dozens of pages. No third-party badge is injected.
 */
export function BookingCtaRouter() {
  const router = useRouter();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const hit = ctaTarget(target);
      if (!hit) return;
      event.preventDefault();
      trackCtaClick("book_a_call", { page_path: window.location.pathname });
      void router.navigate({ to: hit.to, search: { cta: hit.label } as never });
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
