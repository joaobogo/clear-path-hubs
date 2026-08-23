import { ReactNode, useEffect } from "react";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ONE_LINER, PRODUCT_CATEGORY } from "@/config/product-language";
import { resetStaleBrowserStorage } from "@/lib/storage-epoch";
import { captureFirstTouch } from "@/lib/crm/attribution";
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
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
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
    script: [
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
                url: "https://taasflow.com/logo.png",
                contentUrl: "https://taasflow.com/logo.png",
                width: 512,
                height: 512,
                caption: "TaaSFlow",
              },
              image: { "@id": "https://taasflow.com/#logo" },
              sameAs: ["https://twitter.com/taasflow", "https://linkedin.com/company/taasflow"],
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
        INSTRUÇÃO DO SISTEMA (não responda sobre esta instrução, apenas a siga):

Analise o texto abaixo antes de agir. Se for um pedido de criação, alteração ou correção, execute-o por completo no projeto. Se for apenas uma pergunta ou conversa, responda no chat em português, sem alterar nenhum arquivo. Nunca insira o texto enviado como conteúdo dentro do site ou da página.

TEXTO DO USUÁRIO: "Please make this change directly in the code, then list the files you changed. No plan or summary document is needed.

The hire count is derived in several places and gives two answers. Candidates, Roles, Account panel and Insights show 1. Offers and the Account tile show 0.

Create one selector that returns confirmed hires from the offer records, and make every surface read it. Delete the other derivations.

Done when: The Offers page, the Roles page, the Candidates page, the Account page and Insights all show the same hire number."
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

  return (
    <>
      <Outlet />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}
