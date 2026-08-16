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
          "INSTRUÇÃO DO SISTEMA (não responda sobre esta instrução, apenas a siga):\n\nAnalise o texto abaixo antes de agir. Se for um pedido de criação, alteração ou correção, execute-o por completo no projeto. Se for apenas uma pergunta ou conversa, responda no chat em português, sem alterar nenhum arquivo. Nunca insira o texto enviado como conteúdo dentro do site ou da página.\n\nTEXTO DO USUÁRIO: \"PROMPT 11 — Data consistency & KPI truth batch (many LOW/HIGH-adjacent items — fix ALL)\n\nFix every item; each has its own acceptance check:\n\nHire/offer coherence: A hire record closed as \"Closed lost — Candidate declined\" leaves the candidate stage stuck at hired and the KPIs claiming \"Offers extended 1 · Accepted 0 · Declined 2 · Hires confirmed 0 · Start dates confirmed 2\" over a table showing 1 extended + 1 closed-lost, both \"not started\". Reconcile: stage should follow the hire outcome (or clearly show \"hire fell through\"), and every number in \"Offers and hire confirmation\" must be derivable from the visible records. ✔ Check: the panel's numbers add up against its own table, and the closed-lost candidate no longer counts as an active hire anywhere (dashboard, role, portfolio).\nSourcing totals: portfolio \"0 hired\" vs role-level \"1 hired\" for the same period — one truth. ✔ Check: same candidate produces the same hired count on both.\n\"Delivery failures\" name collision: 0 (work-queue KPI) vs 18 (exception digest) vs 23 (Operations 7d). Rename or unify so any two surfaces using the same label show the same number (e.g., \"Delivery failures (7d)\" everywhere with one source). ✔ Check: labels+numbers consistent across all three.\nOrg record integrity: \"CLIENT USERS 0\" with 2 active members; org Candidates tab renders stage/score/fit as \"—\" though data exists; org Documents \"(0)\" though 10 candidate CVs exist. ✔ Check: members count = Access tab; candidates tab shows real stage/score/fit; documents lists the CVs.\nActivity attribution: five \"Message sent · —\" events with no actor/role; system stage-resets rendered as \"Shortlisted by your team\"; duplicated identical audit rows (e.g., client.candidate.viewed twice at the same second). ✔ Check: every feed event names an actor (or \"System\") + context; system actions never claim \"your team\"; no double-writes on new events.\nJourney truthfulness: Rui's journey shows \"Shortlisted by your team / Interviewed\" generated from an offer decision; client shortlist decisions are missing from journeys. Journeys must be derived from real events with correct labels/timestamps. ✔ Check: Rui's journey shows applied→scored→delivered→shortlisted (13/08)→interview requested (14/08)→offer (15/08) with no fabricated \"Interviewed\".\nInterview step-state: Diogo's tracker said \"Interview feedback is in and no advance/reject recorded\" 1 hour after a mere interview REQUEST. States must map to reality: requested → awaiting slots → scheduled → completed → awaiting decision. ✔ Check: a fresh interview request shows \"awaiting slots\", not post-interview copy.\nRole metadata: active Senior FSE role shows Approved \"—\" though it's active (and was announced \"Approved for client view\"). Active/published roles must carry their approval timestamp (backfill from audit). ✔ Check: no active role with an empty Approved timestamp.\nStale quality panel: after saving requirements, the role header kept \"Not scoreable yet — 1 decision-critical item missing\" until a full reload. Panels revalidate after the mutation. ✔ Check: saving 3 requirements flips the panel without a manual reload.\nBulk CV export attribution: the 4-CV ZIP logged as 4 separate \"cv download\" rows (good) — also record a parent \"bulk export (N CVs)\" event naming actor + candidate list, so \"who downloaded\" queries see the bulk action; and CV-trail badges must not label client actors \"Your team\" in the ADMIN view (say \"Client\"). ✔ Check: perform a bulk download as client → org audit shows the bulk event + per-CV rows; admin CV trail shows \"Client\" badge.\nOverview \"Latest activity\" completeness: intake creations, share/memory events (from Prompt 4) and hire outcomes appear in the friendly feed with actors. ✔ Check: today's client actions are all present and attributed.\n\nReply with the evidence table covering all 11 checks.\""
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
