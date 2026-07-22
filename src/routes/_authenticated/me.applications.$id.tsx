import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyApplication, withdrawApplication } from "@/lib/candidate.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/me/applications/$id")({
  head: () => ({
    meta: [
      { title: "Application · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["me-application", params.id],
      queryFn: () => getMyApplication({ data: { id: params.id } }),
    }),
  errorComponent: ({ error }) => (
    <main className="p-8 text-destructive">Failed to load: {error.message}</main>
  ),
  notFoundComponent: () => <main className="p-8">Application not found.</main>,
  component: TrackPage,
});

function TrackPage() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();
  const fn = useServerFn(getMyApplication);
  const withdrawFn = useServerFn(withdrawApplication);
  const qc = useQueryClient();
  const { data = initial } = useQuery({
    queryKey: ["me-application", id],
    queryFn: () => fn({ data: { id } }),
    initialData: initial,
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawFn({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Application withdrawn.");
        qc.invalidateQueries({ queryKey: ["me-application", id] });
        qc.invalidateQueries({ queryKey: ["me-applications"] });
      } else {
        toast.error(r.message);
      }
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link
        to="/me/applications"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All applications
      </Link>
      <header className="mt-3 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{data.role_title}</h1>
            <p className="text-sm text-muted-foreground">
              {data.company ?? "Company disclosed after review"}
              {data.location ? ` · ${data.location}` : ""}
            </p>
          </div>
          <Badge variant="outline" className="whitespace-nowrap">
            {data.status}
          </Badge>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-5 mb-6">
        <h2 className="text-sm font-medium mb-2">Where things stand</h2>
        <p className="text-sm">{data.next_step ?? "No further updates at this time."}</p>
        {data.can_withdraw && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Withdraw this application?")) withdraw.mutate();
              }}
              disabled={withdraw.isPending}
            >
              Withdraw application
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5 mb-6">
        <h2 className="text-sm font-medium mb-3">Timeline</h2>
        <ol className="space-y-3">
          {data.events.map((e, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1">
                <div>{e.label}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.at).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {data.role_description && (
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-medium mb-2">The role</h2>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {data.role_description}
          </p>
        </section>
      )}
    </main>
  );
}
