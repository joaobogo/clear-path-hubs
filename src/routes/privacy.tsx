import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/legal-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("privacy");

export const Route = createFileRoute("/privacy")({
  head: () =>
    marketingHead(entry, "/privacy", {
      title: "Privacy Notice — TaaSFlow",
      description:
        "How TaaSFlow collects, uses, and protects personal information across recruitment activities.",
    }),
  component: () => (
    <LegalPage
      entry={entry}
      fallbackTitle="Privacy Notice"
      fallbackDescription="How TaaSFlow collects, uses, and protects personal information."
      extraNote="Personal data collected through the intake, application, and workspace flows is stored in TaaSFlow's managed Postgres database (Supabase infrastructure). CV files are held in a private storage bucket with row-level access policies."
    />
  ),
});
