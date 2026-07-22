import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("how-it-works");

export const Route = createFileRoute("/how-it-works")({
  head: () => marketingHead(entry, "/how-it-works", { title: "How it works — TaaSFlow", description: "From role intake to ranked shortlist in 14 days. See the repeatable TaaSFlow operating system." }),
  component: () => <ContentPage entry={entry} eyebrow="How it works" fallbackTitle="How TaaSFlow works" />,
});
