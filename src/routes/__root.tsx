import { ReactNode, useEffect } from "react";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ONE_LINER, PRODUCT_CATEGORY } from "@/config/product-language";
import { resetStaleBrowserStorage } from "@/lib/storage-epoch";
import { captureFirstTouch } from "@/lib/crm/attribution";
import { HEAD_BOOT_SNIPPETS } from "@/lib/tracking/pixels";
import { TrackingRouteObserver } from "@/components/analytics/tracking-route-observer";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { GlobalRouteError } from "@/components/global-error";
import { PublicNotFound } from "@/components/marketing/site-shell";
import "@/styles.css";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: `TaaSFlow | ${BRAND_ONE_LINER}`,
      },
      {
        name: "description",
        content: BRAND_ONE_LINER,
      },
      {
        name: "apple-mobile-web-app-title",
        content: "TaaSFlow",
      },
      {
        property: "og:site_name",
        content: "TaaSFlow",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:site",
        content: "@taasflow",
      },
    ],
    links: [
      // Only files that exist in /public — /favicon.svg and
      // /apple-touch-icon.png were referenced but never shipped, so every
      // page load logged 404s.
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/favicon.png",
      },
      {
        rel: "manifest",
        href: "/site.webmanifest",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    // NOTE: the key is `scripts` — TanStack ignores a `script` key silently,
    // which is why this sitewide graph was absent from the served HTML.
    scripts: [
      // Tracker boot snippets (GA4 consent-default + RB2B). These were
      // exported from pixels.ts but never referenced, so /admin/health read
      // "connected · not injected" for every tracker while ad budget ran
      // (audit A-04). GA4 boots with consent DENIED until the banner grants.
      ...HEAD_BOOT_SNIPPETS.map((s) => ({ children: s.children })),
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
              logo: {
                "@type": "ImageObject",
                "@id": "https://taasflow.com/#logo",
                url: "https://taasflow.com/favicon.png",
                contentUrl: "https://taasflow.com/favicon.png",
                caption: "TaaSFlow",
              },
              image: { "@id": "https://taasflow.com/#logo" },
              // sameAs intentionally omitted: only add profiles that are
              // verified to exist and to belong to TaaSFlow.
            },
            {
              "@type": "WebApplication",
              "@id": "https://taasflow.com/platform/#software",
              name: "TaaSFlow",
              applicationCategory: "BusinessApplication",
              applicationSubCategory: PRODUCT_CATEGORY,
              operatingSystem: "Web",
              url: "https://taasflow.com/platform",
              description: `${BRAND_ONE_LINER} Intake Engine, Blueprint Compiler, Agent Layer, Evidence Graph, Scoring Engine and Decision Workspace in one governed system.`,
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
  errorComponent: GlobalRouteError,
  notFoundComponent: PublicNotFound,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const router = useRouter();

  useEffect(() => {
    resetStaleBrowserStorage();
  }, []);

  useEffect(() => {
    captureFirstTouch();
  }, []);

  // Third-party trackers have no business on an authenticated workspace. The
  // admin candidate list alone renders 29 candidate email addresses, and RB2B
  // — an identity-resolution vendor — was loading over it, with the public
  // cookie banner rendered on top of the admin UI (audit #7, TF7-02).
  //
  // Gated by ROUTE, not by consent state: no consent a visitor gives on the
  // public site is consent to run a tracker across someone else's candidate
  // data. Marketing pages, the job board and the apply flow are unaffected.
  // From router state, not window.location: the latter is not reactive across
  // client navigation and differs between the server and client render.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isWorkspace = /^\/(admin|client|me)(\/|$)/.test(pathname);

  return (
    <>
      <Outlet />
      {/* The ONLY caller of initializeTrackers()/onConsentChange — without it
          mounted, consent could be granted and nothing ever injected. */}
      {!isWorkspace && (
        <>
          <TrackingRouteObserver />
          <ConsentBanner />
        </>
      )}
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}
