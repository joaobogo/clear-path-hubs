import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/marketing/legal-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("terms");

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
      extraNote="References to legacy hosting or backend providers in the text below are pending update. The current TaaSFlow application runs on the platforms listed above."
    />
  ),
});
