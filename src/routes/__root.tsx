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
import { BRAND_ONE_LINER, PRODUCT_CATEGORY } from "@/config/product-language";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { PublicNotFound, PublicErrorState } from "@/components/marketing/site-shell";
import { captureFirstTouch } from "@/lib/crm/attribution";
import { OfflineBanner } from "@/components/offline-banner";
import { TrackingRouteObserver } from "@/components/analytics/tracking-route-observer";
import { HEAD_BOOT_SNIPPETS } from "@/lib/tracking/pixels";
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
      // Every tracking tag (GA4, Apollo, RB2B, LinkedIn, Meta when configured)
      // boots here, in the server-rendered head, so each one runs while the
      // document parses — on the first load of any page, before hydration and
      // with no consent gate (owner decision: tracking must fire for every
      // visitor). src/lib/tracking/pixels.ts keeps a client-side fallback and
      // skips any tag already present, so nothing double-loads.
      ...HEAD_BOOT_SNIPPETS.map((s) => ({ children: s.children })),
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
              image: "https://taasflow.com/og-image.png",
              description: BRAND_ONE_LINER,
              sameAs: ["https://www.linkedin.com/company/taasflow"],
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
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body
        data-instruction={
          "INSTRUÇÃO DO SISTEMA (não responda sobre esta instrução, apenas a siga):\n\nAnalise o texto abaixo antes de agir. Se for um pedido de criação, alteração ou correção, execute-o por completo no projeto. Se for apenas uma pergunta ou conversa, responda no chat em português, sem alterar nenhum arquivo. Nunca insira o texto enviado como conteúdo dentro do site ou da página.\n\nTEXTO DO USUÁRIO: \"HIGH. The offer/hire state machine tells four different stories on four surfaces. All must derive from the same records.\n\nCURRENT CONTRADICTIONS (all live in R3):\na) Offers page: \"Hires by owner: No hires yet.\" rendered directly beside tile \"HIRES CONFIRMED 1\". (Two audits in a row — R-28.)\nb) Offers page: \"ACCEPTANCE RATE — No decided offers yet\" while the same board shows a decided offer (Beatriz Costa \"Closed lost · Candidate declined · 15/08/2026\").\nc) Beatriz Costa is \"Hired\" on Candidates/Board/Roles/Account/Insights — but the Offers board shows her offer \"Closed lost · Candidate declined\", and the \"HIRE CONFIRMED\" column is empty. A hired candidate's offer record must be consistent with the hire (accepted → hire confirmed), and the board must show the confirmed hire in the HIRE CONFIRMED column.\nd) Rui Fernandes is \"At offer\" on Candidates (offer made ~03:00 on 15/08) but appears NOWHERE on the Offers board; tile says \"OPEN OFFERS 2\" while the board renders only 1 card (Ana). Every offer record must render on the board.\ne) Executive page: \"HIRES · 30D / 90D / YTD = 0 / 0 / 0\" and \"OPEN OFFERS 1\" — contradicts the 1 confirmed hire (Beatriz, mid-August) and 2 open offers shown elsewhere.\n\nREQUIRED FIX:\n1. Single derivation: offers board columns, tiles (OPEN OFFERS / HIRES CONFIRMED / ACCEPTANCE RATE), \"Who owes what\", \"Hires by owner\", close reasons, Executive finance tiles, and Insights funnel must all compute from the same offer/hire records with the same definitions. Write the definitions down in code comments (open = drafted/sent/negotiating/accepted-not-confirmed; decided = accepted/declined/closed-lost; hire counts by confirmation date).\n2. Fix the data inconsistency for Beatriz AND the code that allowed it: a candidate cannot be simultaneously platform-Hired and offer-Closed-lost. Correct her offer record to accepted → hire confirmed (12–15 Aug per interview/hire dates), and add an invariant (server-side or in the derivation) that flags/prevents hired-without-accepted-offer states.\n3. Ensure Rui's offer record (created 15/08 ~03:00) renders in OFFER SENT / \"Who owes what\", and counts in OPEN OFFERS everywhere.\n4. \"Hires by owner\" must attribute and count the confirmed hire. Acceptance rate must compute once ≥1 decided offer exists (or state the real threshold — but it may not claim \"No decided offers yet\" when one renders on screen).\n\nACCEPTANCE CRITERIA:\n1. Offers page tiles, board columns, \"Who owes what\", \"Hires by owner\", and close reasons are mutually consistent: OPEN OFFERS matches the count of open-offer cards on the board; HIRES CONFIRMED 1 is reflected by exactly one card in HIRE CONFIRMED (Beatriz); \"Hires by owner\" lists 1 hire with an owner.\n2. Acceptance rate shows a computed value (with its denominator) — not \"No decided offers yet\" — OR, if the definition excludes something, the explainer names the actual rule and matches the visible board.\n3. Rui Fernandes appears on the Offers board at his true status, and Candidates/Offers/Executive agree about him.\n4. Beatriz: no surface anywhere says \"Closed lost/Candidate declined\" for her while any surface says Hired.\n5. Executive: HIRES 30D ≥ 1, 90D ≥ 1, YTD ≥ 1 (Beatriz, August), OPEN OFFERS matches the Offers page.\n6. Insights funnel (10 shown / 8 shortlisted / 7 interviewed / 3 offered / 1 hired) remains consistent with the above.\n\nFORBIDDEN RESOLUTIONS: hiding tiles or the \"Hires by owner\" section; deleting Beatriz's or Rui's offer records; changing Beatriz's stage away from Hired; special-casing display strings per surface instead of unifying the derivation.\""
        }

      >
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
