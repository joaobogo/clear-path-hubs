import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listAdminMatches } from "@/lib/processing.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/matches")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-matches"],
      queryFn: () => listAdminMatches(),
    }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Couldn't load queue: {error.message}</div>
  ),
  head: () => ({
    meta: [
      { title: "Admin — Review queue · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchesPage,
});

const STATE_COLOR: Record<string, string> = {
  scored: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  manual_review_required: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  failed: "bg-destructive/10 text-destructive",
  provider_blocked: "bg-destructive/10 text-destructive",
  ocr_required: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function MatchesPage() {
  const { data: rows } = useSuspenseQuery({
    queryKey: ["admin-matches"],
    queryFn: () => listAdminMatches(),
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <div className="text-sm text-muted-foreground">{rows.length} matches</div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Fit</th>
              <th className="px-3 py-2 font-medium">Must-have</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Visibility</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{m.candidate_name}</div>
                  <div className="text-xs text-muted-foreground">{m.candidate_email}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{m.position_title}</div>
                  <div className="text-xs text-muted-foreground">{m.organization_name}</div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${
                      STATE_COLOR[m.processing_state] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.processing_state.replace(/_/g, " ")}
                  </span>
                  {m.contradiction_status && m.contradiction_status !== "none" && (
                    <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      ⚠ {m.contradiction_status.replace(/_/g, " ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {m.score == null ? "—" : m.score.toFixed(1)}
                </td>
                <td className="px-3 py-2">
                  {m.fit_label ? (
                    <Badge variant="outline">{m.fit_label.replace(/_/g, " ")}</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {m.must_have_coverage == null ? "—" : `${Math.round(m.must_have_coverage * 100)}%`}
                </td>
                <td className="px-3 py-2 capitalize">{m.admin_status}</td>
                <td className="px-3 py-2 capitalize">{m.client_visibility}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/admin/matches/$id"
                    params={{ id: m.id }}
                    className="text-primary hover:underline"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-16 text-center text-muted-foreground">
                  No matches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
