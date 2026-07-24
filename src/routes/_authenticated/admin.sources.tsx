import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getSourceAttribution } from "@/lib/sources.functions";
import { SourceAttributionView } from "@/components/sources/source-attribution-view";

export const Route = createFileRoute("/_authenticated/admin/sources")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-source-attribution"],
      queryFn: () => getSourceAttribution({ data: { scope: "all" } }),
    }),
  head: () => ({
    meta: [
      { title: "Source of hire · TaaSFlow admin" },
      {
        name: "description",
        content:
          "Cross-tenant sourcing intelligence: channel funnel, reply rate, shortlist rate, hires, and cost per hire.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
  component: AdminSourcesPage,
});

function AdminSourcesPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-source-attribution"],
    queryFn: () => getSourceAttribution({ data: { scope: "all" } }),
  });
  return (
    <SourceAttributionView
      data={data}
      title="Source of hire — all clients"
      subtitle="Aggregated channel attribution across every org. Prove that TaaSFlow is not just job ads."
    />
  );
}
