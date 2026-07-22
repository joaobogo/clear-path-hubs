import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("employer-onboarding");

export const Route = createFileRoute("/employer-onboarding")({
  head: () => marketingHead(entry, "/employer-onboarding", { title: "Employer onboarding — TaaSFlow", description: "Your onboarding roadmap for the first 14 days with TaaSFlow." }),
  component: () => <ContentPage entry={entry} eyebrow="Onboarding" fallbackTitle="Employer onboarding" />,
});
