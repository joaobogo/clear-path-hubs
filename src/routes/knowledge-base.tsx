import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("knowledge-base");

export const Route = createFileRoute("/knowledge-base")({
  head: () => marketingHead(entry, "/knowledge-base", { title: "Knowledge base — TaaSFlow", description: "How-to guides and reference material for TaaSFlow clients and candidates." }),
  component: () => <ContentPage entry={entry} eyebrow="Knowledge base" fallbackTitle="Knowledge base" />,
});
