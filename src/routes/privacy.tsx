import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("privacy");

export const Route = createFileRoute("/privacy")({
  head: () => marketingHead(entry, "/privacy", { title: "Privacy Notice — TaaSFlow", description: "How TaaSFlow collects, uses, and protects personal information." }),
  component: () => <ContentPage entry={entry} eyebrow="Legal" fallbackTitle="Privacy Notice" />,
});
