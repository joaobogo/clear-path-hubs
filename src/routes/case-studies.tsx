import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("case-studies");

export const Route = createFileRoute("/case-studies")({
  head: () => marketingHead(entry, "/case-studies", { title: "Case studies — TaaSFlow", description: "Real companies, real timelines, real cost savings — documented end to end." }),
  component: () => <ContentPage entry={entry} eyebrow="Case studies" fallbackTitle="Measured Results. Not Marketing Claims." />,
});
