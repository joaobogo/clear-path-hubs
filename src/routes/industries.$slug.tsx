import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { getIndustry } from "@/lib/marketing/content";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/industries/$slug")({
  loader: ({ params }) => {
    const entry = getIndustry(params.slug);
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ params, loaderData }) =>
    marketingHead(
      loaderData?.entry,
      `/industries/${params.slug}`,
      { title: `${params.slug} — TaaSFlow`, description: "Industry-focused subscription recruiting." },
    ),
  component: IndustryDetail,
  notFoundComponent: () => (
    <ContentPage
      entry={undefined}
      eyebrow="Industry"
      fallbackTitle="Industry not found"
    />
  ),
});

function IndustryDetail() {
  const { entry } = Route.useLoaderData();
  return <ContentPage entry={entry} eyebrow="Industry" />;
}
