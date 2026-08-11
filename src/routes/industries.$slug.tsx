import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { SiteShell } from "@/components/marketing/site-shell";
import { ContentPage } from "@/components/marketing/content-page";
import { IndustryPage } from "@/components/marketing/industry-page";
import { getIndustry } from "@/lib/marketing/content";
import { getIndustryEntry } from "@/content/industries-v2";
import { getIndustryHeroImage } from "@/content/industry-hero-images";
import { marketingHead } from "@/lib/marketing/head";
import {
  INDUSTRY_SLUG_ALIASES,
  isLegacyIndustrySlug,
  toInternalSlug,
} from "@/lib/marketing/industry-slug-aliases";

export const Route = createFileRoute("/industries/$slug")({
  beforeLoad: ({ params }) => {
    // 301 legacy short slugs to their canonical human-readable form.
    if (isLegacyIndustrySlug(params.slug)) {
      throw redirect({
        to: "/industries/$slug",
        params: { slug: INDUSTRY_SLUG_ALIASES[params.slug] },
        statusCode: 301,
      });
    }
  },
  loader: ({ params }) => {
    // Public slug may be canonical (e.g. `technology`); look up the
    // internal data key (e.g. `tech`) so we don't have to migrate
    // the data file.
    const dataKey = toInternalSlug(params.slug);
    const v2 = getIndustryEntry(dataKey);
    const legacy = getIndustry(dataKey);
    if (!v2 && !legacy) throw notFound();
    return { v2, legacy };
  },
  head: ({ params, loaderData }) => {
    const v2 = loaderData?.v2;
    // The vertical hero rendered on the page is also its share image.
    const hero = getIndustryHeroImage(toInternalSlug(params.slug))?.src;
    if (v2) {
      // Wrap the v2 data in the shape marketingHead expects.
      return marketingHead(
        {
          url: `/industries/${params.slug}`,
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
        {
          image: hero,
          breadcrumbs: [
            { name: "Industries", path: "/industries" },
            { name: v2.name ?? params.slug, path: `/industries/${params.slug}` },
          ],
        },
      );
    }
    if (!loaderData?.legacy) {
      // Unknown slug: the loader threw notFound(). Never let a soft-404 be
      // indexed under a slug-derived title.
      return {
        meta: [
          { title: "Industry not found — TaaSFlow" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    return marketingHead(
      loaderData.legacy,
      `/industries/${params.slug}`,
      {
        title: `${params.slug} — TaaSFlow`,
        description: "Industry-focused subscription recruiting.",
      },
      { image: hero },
    );
  },

  component: IndustryDetail,
  notFoundComponent: () => (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Industry not found</h1>
        <p className="mt-3 text-muted-foreground">
          That industry page doesn't exist or has been renamed.
        </p>
        <Link to="/industries" className="mt-6 inline-block text-primary hover:underline">
          ← Browse all industries
        </Link>
      </div>
    </SiteShell>
  ),
  errorComponent: makeRouteErrorComponent("public", "industries.$slug"),
});

function IndustryDetail() {
  const { v2, legacy } = Route.useLoaderData();
  if (v2) return <IndustryPage entry={v2} />;
  return <ContentPage entry={legacy} eyebrow="Industry" />;
}
