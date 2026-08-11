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

    // The head manager writes the new <title> a few milliseconds after this
    // effect runs, so a dispatch on this tick would stamp every event with the
    // previous page's title. Wait until the title actually belongs to this
    // route (observed, with a short cap so a route that reuses a title still
    // reports), then read the URL live — it is committed by then.
    const titleAtNav = document.title;
    let done = false;
    let observer: MutationObserver | null = null;
    let timer = 0;

    const dispatch = () => {
      if (done) return;
      done = true;
      observer?.disconnect();
      window.clearTimeout(timer);

      const base = {
        page_path: pathname,
        page_title: document.title,
        page_location: new URL(href, window.location.origin).href,
        role_type: roleType(pathname),
        referrer: previous ?? document.referrer ?? "",
      };
      trackPageView(base);
      const evt = routeEvent(pathname);
      if (evt) trackEvent(evt, base);
    };

    const titleEl = document.querySelector("title");
    if (titleEl) {
      observer = new MutationObserver(() => {
        if (document.title !== titleAtNav) dispatch();
      });
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    // Cap: fires the event even when the route keeps the same title.
    timer = window.setTimeout(dispatch, 400);

    return () => {
      done = true;
      observer?.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname, href]);


  return null;
}

