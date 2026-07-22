import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("resources");

export const Route = createFileRoute("/resources")({
  head: () => marketingHead(entry, "/resources", { title: "Resources — TaaSFlow", description: "Playbooks, guides, and templates for modern talent teams." }),
  component: () => <ContentPage entry={entry} eyebrow="Resources" fallbackTitle="Resources" />,
});
