import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("global-talent");

export const Route = createFileRoute("/global-talent")({
  head: () => marketingHead(entry, "/global-talent", { title: "Global talent — TaaSFlow", description: "Hire across 50+ countries with local sourcing and one flat monthly fee." }),
  component: () => <ContentPage entry={entry} eyebrow="Global reach" fallbackTitle="Global talent" />,
});
