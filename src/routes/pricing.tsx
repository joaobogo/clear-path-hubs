import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("pricing");

export const Route = createFileRoute("/pricing")({
  head: () => marketingHead(entry, "/pricing", { title: "Pricing — TaaSFlow", description: "Flat monthly subscription recruiting. No placement fees. Cancel anytime." }),
  component: () => <ContentPage entry={entry} eyebrow="Pricing" fallbackTitle="Pricing" />,
});
