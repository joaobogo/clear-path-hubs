import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/legal-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

// Exported because automatic code splitting moves the route component into its
// own chunk, which then imports these bindings back from this module. A plain
// `const` here compiles to a missing export and breaks hydration app-wide.
export const FALLBACK_TITLE = "Terms of Service";
export const FALLBACK_DESCRIPTION =
  "Terms of Service governing the use of TaaSFlow.";
export const EXTRA_NOTE =
  "TaaSFlow runs on a managed Postgres database, authentication and file storage operated by Supabase, with application hosting, CDN and WAF services on Cloudflare's edge network. The full sub-processor register is published in section 6 of our Privacy Notice. This wording is pending review by TaaSFlow's legal counsel.";

export const Route = createFileRoute("/terms")({
  head: () =>
    marketingHead(getPage("terms"), "/terms", {
      title: "Terms of Service — TaaSFlow",
      description: FALLBACK_DESCRIPTION,
    }),
  component: TermsPage,
});

/**
 * Resolve the content entry inside the component. Automatic code splitting
 * lifts route components into their own chunk, so a module-scope binding they
 * close over is not guaranteed to be importable from the route module.
 */
function TermsPage() {
  return (
    <LegalPage
      entry={getPage("terms")}
      fallbackTitle={FALLBACK_TITLE}
      fallbackDescription={FALLBACK_DESCRIPTION}
      extraNote={EXTRA_NOTE}
    />
  );
}
