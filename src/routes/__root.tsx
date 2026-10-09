import { GlobalLoadingBar } from "@/components/ds/global-loading-bar";
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
import { BRAND_ONE_LINER } from "@/config/product-language";
import { SOCIAL_LINKS } from "@/config/public-navigation";
import { getHostIndexability } from "@/lib/seo/request-host.functions";
import { NON_PRODUCTION_ROBOTS } from "@/lib/seo/edge-policy";
import { GOOGLE_SITE_VERIFICATION } from "@/config/site-verification";
import { resetStaleBrowserStorage } from "@/lib/storage-epoch";
import { captureFirstTouch } from "@/lib/crm/attribution";
import {
  HEAD_BOOT_SNIPPETS,
  isWorkspacePath,
  rb2bHeadLinks,
  rb2bHeadScripts,
  setAnalyticsDisabledForRoute,
} from "@/lib/tracking/pixels";
import { TrackingRouteObserver } from "@/components/analytics/tracking-route-observer";
import { ConsentBanner } from "@/components/analytics/consent-banner";
import { GlobalRouteError } from "@/components/global-error";
import { PublicNotFound } from "@/components/marketing/site-shell";
import "@/styles.css";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  // Resolved once per document on the server; never refetched on client
  // navigation, so it adds no request to the workspace.
  loader: async () => {
    try {
      return await getHostIndexability();
    } catch {
      return { indexable: true };
    }
  },
  staleTime: Infinity,
  head: (ctx) => {
    // Preview and other non-production hosts: keep out of search. Canonical
    // tags and og:url still point at the production domain.
    const indexable = (ctx.loaderData as { indexable?: boolean } | undefined)?.indexable !== false;
    // The path this document is being rendered for, known on the SERVER. RB2B
    // is excluded from workspace HTML here rather than guarded at runtime, so
    // /admin, /client and /me never carry the tag at all.
    const pathname =
      ctx.matches?.[ctx.matches.length - 1]?.pathname ??
      (typeof window === "undefined" ? "/" : window.location.pathname);
    return {
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
      ...(indexable ? [] : [{ name: "robots", content: NON_PRODUCTION_ROBOTS }]),
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
      // Google Search Console ownership. Rendered only when a token is set —
      // an empty tag verifies nothing and reads as a mistake in the source.
      ...(GOOGLE_SITE_VERIFICATION
        ? [{ name: "google-site-verification", content: GOOGLE_SITE_VERIFICATION }]
        : []),
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
      // RB2B first, and BEFORE the stylesheets below: links are emitted in
      // order, so the preload starts the vendor fetch while the CSS is still
      // in flight instead of after it.
      ...rb2bHeadLinks(pathname),
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
        // One family, on its width and weight axes (The Run, tokens.css).
        href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap",
      },
    ],
    // NOTE: the key is `scripts` — TanStack ignores a `script` key silently,
    // which is why this sitewide graph was absent from the served HTML.
    scripts: [
      // RB2B: external and async, so the preload scanner fetches it during
      // initial parse and it executes on arrival rather than waiting for the
      // stylesheets an inline loader would have to wait for. Absent entirely
      // on workspace paths.
      ...rb2bHeadScripts(pathname),
      // Tracker boot snippets (GA4 consent-default). These were exported from
      // pixels.ts but never referenced, so /admin/health read "connected ·
      // not injected" for every tracker while ad budget ran (audit A-04).
      // GA4 boots with consent DENIED until the banner grants.
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
              // Only profile URLs already published in the site footer
              // (SOCIAL_LINKS). Never add a profile that is not linked there.
              sameAs: SOCIAL_LINKS.filter((l) => l.href.startsWith("https://")).map(
                (l) => l.href,
              ),
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
    };
  },
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
  // isWorkspacePath, not a fourth hand-written regex. The copy that used to
  // live here was case-sensitive while the router is not, so /Client?org=<id>
  // mounted the public tracking observer and the cookie banner on top of a
  // workspace page.
  const isWorkspace = isWorkspacePath(pathname);

  return (
    <>
      {/* Workspace only: a marketing page has no dashboard to be loading. */}
      {isWorkspace && <GlobalLoadingBar />}
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
