import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("pilot");

export const Route = createFileRoute("/pilot")({
  head: () => marketingHead(entry, "/pilot", { title: "$399 Pilot — TaaSFlow", description: "Two-week pilot. Structured intake, full execution sprint, scored candidate results." }),
  component: () => <ContentPage entry={entry} eyebrow="2-week pilot" fallbackTitle="Start with a 2-Week Pilot" />,
});
