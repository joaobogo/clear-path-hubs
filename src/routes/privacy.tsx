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
      extraNote="Personal data collected through the intake, application, and workspace flows is stored in a managed Postgres database, with the application served from an edge hosting network. CV files are held in private object storage with row-level access policies. The named providers behind this infrastructure are listed in the sub-processor register in section 6 below."
    />
  ),
});
