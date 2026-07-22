import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("terms");

export const Route = createFileRoute("/terms")({
  head: () => marketingHead(entry, "/terms", { title: "Terms of Service — TaaSFlow", description: "Terms of Service governing use of TaaSFlow." }),
  component: () => <ContentPage entry={entry} eyebrow="Legal" fallbackTitle="Terms of Service" />,
});
