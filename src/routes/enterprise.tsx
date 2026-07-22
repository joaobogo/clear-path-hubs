import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("enterprise");

export const Route = createFileRoute("/enterprise")({
  head: () => marketingHead(entry, "/enterprise", { title: "Enterprise — TaaSFlow", description: "Scaled subscription recruiting for enterprise hiring teams." }),
  component: () => <ContentPage entry={entry} eyebrow="Enterprise" fallbackTitle="Enterprise" />,
});
