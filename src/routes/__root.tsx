import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { FGV } from "@/config/ecosystem";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { PublicNotFound, PublicErrorState } from "@/components/marketing/site-shell";
import { captureFirstTouch } from "@/lib/crm/attribution";
import { OfflineBanner } from "@/components/offline-banner";
import { TrackingRouteObserver } from "@/components/analytics/tracking-route-observer";
import { RB2B_ID } from "@/lib/tracking/pixels";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { BookingCtaRouter } from "@/components/marketing/booking-cta-router";

/** Brand webfonts. Attached after first paint — see the inline script in head(). */
const FONT_CSS_HREF =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";



function NotFoundComponent() {
  return <PublicNotFound />;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <PublicErrorState
      onRetry={() => {
        router.invalidate();
        reset();
      }}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:site_name", content: "TaaSFlow" },
      // No sitewide og:image here: a root-level image is concatenated into
      // every match and can win over a page's own hero/cover. Routes that
      // render a meaningful hero set og:image/twitter:image in their own
      // head(); hosting supplies the preview for the rest.

    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "alternate icon", href: "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        // Warm the webfont CSS without blocking the parser. The stylesheet
        // itself is attached by the inline script below (outside React's head
        // management, which would otherwise reset any attribute we flip).
        rel: "preload",
        as: "style",
        href: FONT_CSS_HREF,
      },
    ],
    scripts: [
      // RB2B visitor identification boots here, in the server-rendered head,
      // so it runs while the document parses — before hydration and with no
      // consent gate (owner decision: identification must fire on the very
      // first pageview for every visitor). src/lib/tracking/pixels.ts keeps a
      // client-side fallback and skips this tag when it is already present.
      {
        children: `!function(key){if(window.reb2b)return;window.reb2b={loaded:true};var s=document.createElement("script");s.async=true;s.setAttribute("data-tracker","rb2b");s.src="https://ddwl4m2hdecbv.cloudfront.net/b/"+key+"/"+key+".js.gz";var f=document.getElementsByTagName("script")[0];f.parentNode.insertBefore(s,f);}(${JSON.stringify(RB2B_ID)});`,
      },
      {
        // Attaches the Google Fonts stylesheet after first paint. Headings and
        // body text declare fallbacks with font-display: swap, so text (the LCP
        // element on the homepage) paints immediately instead of waiting on a
        // third-party CSS round trip.
        children: `(function(){if(document.getElementById('taasflow-webfonts'))return;var l=document.createElement('link');l.id='taasflow-webfonts';l.rel='stylesheet';l.href=${JSON.stringify(FONT_CSS_HREF)};document.head.appendChild(l);})();`,
      },



      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://taasflow.com/#organization",
              name: "TaaSFlow",
              url: "https://taasflow.com",
              logo: "https://taasflow.com/og-image.png",
              description:
                "TaaSFlow is a software-enabled recruiting system — ATS, recruiting agents, multichannel outreach, and curated talent data delivered as a subscription, not a traditional agency.",
              parentOrganization: {
                "@type": "Organization",
                name: FGV.name,
                url: FGV.url,
              },
            },
            {
              "@type": "SoftwareApplication",
              "@id": "https://taasflow.com/#software",
              name: "TaaSFlow",
              applicationCategory: "BusinessApplication",
              applicationSubCategory: "AI Hiring Intelligence Platform",
              operatingSystem: "Web",
              url: "https://taasflow.com/platform",
              description:
                "AI Hiring Intelligence Platform — Intake Engine, Blueprint Compiler, Agent Layer, Evidence Graph, Scoring Engine and Decision Workspace in one governed system.",
              publisher: { "@id": "https://taasflow.com/#organization" },
            },
            {
              "@type": "WebSite",
              "@id": "https://taasflow.com/#website",
              url: "https://taasflow.com",
              name: "TaaSFlow",
              publisher: { "@id": "https://taasflow.com/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            alt=""
            src="https://px.ads.linkedin.com/collect/?pid=10685401&fmt=gif"
          />
        </noscript>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // First-touch attribution capture (campaign + landing page only).
  useEffect(() => {
    captureFirstTouch();
  }, []);

  // Preview / non-production hosts (e.g. *.lovable.app) must not
  // compete with taasflow.com in search. Inject a robots noindex
  // meta on the client for any host that isn't the canonical one.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname;
    const isCanonical = host === "taasflow.com" || host === "www.taasflow.com";
    if (isCanonical) return;
    const existing = document.querySelector<HTMLMetaElement>(
      'meta[name="robots"][data-preview-guard]',
    );
    if (existing) return;
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex,follow");
    meta.setAttribute("data-preview-guard", "1");
    document.head.appendChild(meta);
  }, []);

  // Single, app-wide auth subscriber. Keeps every open tab consistent:
  // signing out in one tab drops the others out of protected routes, and a
  // sign-in elsewhere refreshes this tab's data instead of showing stale
  // content from the previous identity. Filtered to identity transitions —
  // unfiltered it also fires on TOKEN_REFRESHED (~hourly, plus tab focus)
  // and INITIAL_SESSION (every mount), which would thrash router and cache.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // The _authenticated gate re-runs on invalidate and bounces to /login
      // when the session is gone, so expired sessions self-correct here too.
      router.invalidate();
      // Never refetch on SIGNED_OUT: those queries would 401 against a
      // cleared session. The sign-out path clears the cache itself.
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>

      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <TrackingRouteObserver />
      <ConsentBanner />
      <BookingCtaRouter />
      <OfflineBanner />
      <Toaster />
    </QueryClientProvider>
  );
}
