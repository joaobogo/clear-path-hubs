import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { initializeTrackers, trackEvent, trackPageView } from "@/lib/tracking/pixels";

/** Maps a pathname to the extra route-level event fired alongside page_view. */
function routeEvent(path: string): string | null {
  if (path === "/") return "homepage_view";
  if (path === "/jobs" || path.startsWith("/jobs?")) return "view_job_board";
  if (/^\/jobs\/[^/]+/.test(path)) return "view_job";
  if (path.startsWith("/pricing")) return "pricing_view";
  if (path.startsWith("/pilot")) return "pilot_page_view";
  if (path.startsWith("/contact")) return "contact_form_started";
  if (path.startsWith("/candidate-join")) return "candidate_signup_started";
  if (path.startsWith("/admin")) return "admin_dashboard_view";
  if (path.startsWith("/client")) return "client_dashboard_view";
  if (path.startsWith("/me")) return "candidate_dashboard_view";
  return null;
}

function roleType(path: string) {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/client")) return "client";
  if (path.startsWith("/me") || path.startsWith("/candidate")) return "candidate";
  return "public";
}

/**
 * Boots every pixel once after hydration, then emits a page_view (plus the
 * route-specific event) on each SPA navigation.
 */
export function TrackingRouteObserver() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    initializeTrackers();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastPath.current === pathname) return;
    const previous = lastPath.current;
    lastPath.current = pathname;

    const base = {
      page_path: pathname,
      page_title: document.title,
      page_location: window.location.href,
      role_type: roleType(pathname),
      referrer: previous ?? document.referrer ?? "",
    };

    trackPageView(base);
    const evt = routeEvent(pathname);
    if (evt) trackEvent(evt, base);
  }, [pathname]);

  return null;
}
