import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getPage } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

const entry = getPage("about");

export const Route = createFileRoute("/about")({
  head: () => marketingHead(entry, "/about", { title: "About TaaSFlow", description: "Meet the team behind TaaSFlow and our approach to subscription recruiting." }),
  component: () => <ContentPage entry={entry} eyebrow="About" fallbackTitle="About TaaSFlow" />,
});
