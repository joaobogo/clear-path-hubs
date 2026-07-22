import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listIntakes } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/intakes")({
  head: () => ({
    meta: [
      { title: "Admin — Intakes" },
      { name: "description", content: "Review submitted intakes." },
      { property: "og:title", content: "Admin — Intakes" },
      { property: "og:description", content: "Review submitted intakes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminIntakes,
});

function AdminIntakes() {
  const list = useServerFn(listIntakes);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "intakes"],
    queryFn: () => list(),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          If this says "Forbidden", promote your user to admin by inserting a row into user_roles.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Client intakes</h1>
        <p className="text-sm text-muted-foreground">Newest first. Click through to review.</p>
      </div>
      <Card className="divide-y">
        {(data ?? []).length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No intakes yet.</div>
        )}
        {(data ?? []).map((i: any) => (
          <Link
            key={i.id}
            to="/admin/intakes/$id"
            params={{ id: i.id }}
            className="flex items-center justify-between gap-4 p-4 hover:bg-accent/40"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{i.submitter_email}</div>
              <div className="text-xs text-muted-foreground truncate">
                trace {i.trace_id?.slice(0, 8)} · {new Date(i.created_at).toLocaleString()}
              </div>
            </div>
            <Badge
              variant={
                i.status === "completed"
                  ? "default"
                  : i.status === "preparation_failed"
                    ? "destructive"
                    : "secondary"
              }
            >
              {i.status}
            </Badge>
          </Link>
        ))}
      </Card>
    </div>
  );
}
