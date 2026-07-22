import { createFileRoute, notFound } from "@tanstack/react-router";
import { ContentPage } from "@/components/marketing/content-page";
import { IndustryTemplate } from "@/components/marketing/industry-template";
import { getIndustry } from "@/lib/marketing/content";
import { getIndustryEntry } from "@/content/industries-v2";
import { marketingHead } from "@/lib/marketing/head";

export const Route = createFileRoute("/industries/$slug")({
  loader: ({ params }) => {
    const v2 = getIndustryEntry(params.slug);
    const legacy = getIndustry(params.slug);
    if (!v2 && !legacy) throw notFound();
    return { v2, legacy };
  },
  head: ({ params, loaderData }) => {
    const v2 = loaderData?.v2;
    if (v2) {
      // Wrap the v2 data in the shape marketingHead expects.
      return marketingHead(
        {
          markdown: "",
          meta: {
            title: v2.meta.title,
            description: v2.meta.description,
            "og:title": v2.meta.title,
            "og:description": v2.meta.description,
            "og:type": "website",
          },
        },
        `/industries/${params.slug}`,
        { title: v2.meta.title, description: v2.meta.description },
      );
    }
    return marketingHead(loaderData?.legacy, `/industries/${params.slug}`, {
      title: `${params.slug} — TaaSFlow`,
      description: "Industry-focused subscription recruiting.",
    });
  },
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
  const { v2, legacy } = Route.useLoaderData();
  if (v2) return <IndustryTemplate entry={v2} />;
  return <ContentPage entry={legacy} eyebrow="Industry" />;
}
