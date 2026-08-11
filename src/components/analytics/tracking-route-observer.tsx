import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { initializeTrackers, trackEvent, trackPageView } from "@/lib/tracking/pixels";
import {
  onConsentChange,
  onTrackingPolicyChange,
  setTrackingPolicy,
} from "@/lib/tracking/consent";
import { fetchTrackingPolicy } from "@/lib/tracking/policy.functions";


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
  const href = useRouterState({ select: (s) => s.location.href });
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The admin-configured policy decides which trackers count as strictly
    // necessary. Until it lands, no script initialises at all.
    void fetchTrackingPolicy()
      .then((p) => {
        if (cancelled) return;
        setTrackingPolicy({
          essentialTrackers: p.essentialTrackers,
          requirePriorOptInEverywhere: p.requirePriorOptInEverywhere,
        });
      })
      .catch(() => {
        /* fail closed — nothing boots */
      });

    // Re-run on both consent and policy changes; loaded tags are skipped.
    const offConsent = onConsentChange(() => initializeTrackers());
    const offPolicy = onTrackingPolicyChange(() => initializeTrackers());
    return () => {
      cancelled = true;
      offConsent();
      offPolicy();
    };
  }, []);


  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastPath.current === pathname) return;
    const previous = lastPath.current;
    lastPath.current = pathname;

    // `page_location` is built from the router's own location rather than
    // window.location: on an SPA navigation this effect runs before the
    // history entry is committed, so window.location.href would still be the
    // previous page. `document.title` is written by the head manager in a
    // later effect, so the dispatch waits two frames for it to settle —
    // otherwise every event carries the previous page's title.
    const location = new URL(href, window.location.origin).href;

    let frame = 0;
    const dispatch = () => {
      const base = {
        page_path: pathname,
        page_title: document.title,
        page_location: location,
        role_type: roleType(pathname),
        referrer: previous ?? document.referrer ?? "",
      };
      trackPageView(base);
      const evt = routeEvent(pathname);
      if (evt) trackEvent(evt, base);
    };

    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(dispatch);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, href]);

  return null;
}

