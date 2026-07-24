import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { getSourceAttribution } from "@/lib/sources.functions";
import { SourceAttributionView } from "@/components/sources/source-attribution-view";

export const Route = createFileRoute("/_authenticated/client/sources")({
  head: () => ({
    meta: [
      { title: "Source of hire · TaaSFlow" },
      {
        name: "description",
        content:
          "See how each sourcing channel converts: applications, reply rate, shortlist rate, hires, and cost per hire.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
  component: ClientSourcesPage,
});

function ClientSourcesPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const attrFn = useServerFn(getSourceAttribution);

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;

  const { data, isPending } = useQuery({
    queryKey: ["source-attribution", orgId],
    queryFn: () => attrFn({ data: { orgId: orgId!, scope: "org" } }),
    enabled: !!orgId,
  });

  if (!orgId || isPending || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <SourceAttributionView
      data={data}
      title="Source of hire"
      subtitle="Every application is tagged with its channel. This is where TaaSFlow proves the mix — inbound, sourced, referral — not just job ads."
    />
  );
}
