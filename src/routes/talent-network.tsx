import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("talent-network");

export const Route = createFileRoute("/talent-network")({
  head: () => marketingHead(entry, "/talent-network", { title: "Talent network — TaaSFlow", description: "Join our global talent network of vetted professionals." }),
  component: () => <ContentPage entry={entry} eyebrow="For candidates" fallbackTitle="Talent network" />,
});
