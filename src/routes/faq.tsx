import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("faq");

export const Route = createFileRoute("/faq")({
  head: () => marketingHead(entry, "/faq", { title: "FAQ — TaaSFlow", description: "Common questions about subscription recruiting with TaaSFlow." }),
  component: () => <ContentPage entry={entry} eyebrow="FAQ" fallbackTitle="Frequently Asked Questions" />,
});
