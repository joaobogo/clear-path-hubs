import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/legal-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const FALLBACK_TITLE = "Terms of Service";
const FALLBACK_DESCRIPTION =
  "Terms of Service governing the use of TaaSFlow.";
const EXTRA_NOTE =
  "TaaSFlow runs on a managed Postgres database, authentication and file storage operated by Supabase, with application hosting, CDN and WAF services on Cloudflare's edge network. Payments are processed by Stripe. The full sub-processor register is published in section 6 of our Privacy Notice. This wording is pending review by TaaSFlow's legal counsel.";

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
