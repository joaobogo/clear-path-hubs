import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("contact");

export const Route = createFileRoute("/contact")({
  head: () => marketingHead(entry, "/contact", { title: "Contact — TaaSFlow", description: "Get in touch with the TaaSFlow team." }),
  component: () => <ContentPage entry={entry} eyebrow="Contact" fallbackTitle="Contact" />,
});
