import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("partnerships-staffing");

export const Route = createFileRoute("/partnerships/staffing")({
  head: () => marketingHead(entry, "/partnerships/staffing", { title: "Staffing partnerships — TaaSFlow", description: "White-label sourcing capacity for staffing agencies." }),
  component: () => <ContentPage entry={entry} eyebrow="Partnerships" fallbackTitle="Staffing partnerships" />,
});
