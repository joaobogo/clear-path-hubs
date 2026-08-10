import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/legal-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

export const entry = getPage("terms");

export const Route = createFileRoute("/terms")({
  head: () =>
    marketingHead(entry, "/terms", {
      title: "Terms of Service — TaaSFlow",
      description: "Terms of Service governing the use of TaaSFlow.",
    }),
  component: () => (
    <LegalPage
      entry={entry}
      fallbackTitle="Terms of Service"
      fallbackDescription="Terms of Service governing the use of TaaSFlow."
      extraNote="TaaSFlow runs on a managed Postgres database, authentication and file storage operated by Supabase, with application hosting, CDN and WAF services on Cloudflare's edge network. Payments are processed by Stripe. The full sub-processor register is published in section 6 of our Privacy Notice. This wording is pending review by TaaSFlow's legal counsel."
    />
  ),
});
