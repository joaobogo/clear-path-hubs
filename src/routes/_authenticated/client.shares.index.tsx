import { createFileRoute, Link } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  Copy,
  ExternalLink,
  Eye,
  MessageSquare,
  Share2,
  ShieldX,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  listShortlistShares,
  revokeShortlistShare,
} from "@/lib/shares.functions";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmAction } from "@/components/ds";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";

export const Route = createFileRoute("/_authenticated/client/shares/")({
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.shares.index.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  head: () => ({
    meta: [
      { title: "Shared shortlists · TaaSFlow" },
      {
        name: "description",
        content:
          "Manage read-only shortlist links you've shared with hiring managers and stakeholders.",
      },
    ],
  }),
  component: SharesPage,
});

function SharesPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctxState = useQueryState(ctxQuery);
  const ctx = ctxState.data;
  const orgId = ctx?.active?.organization_id;

  const listFn = useServerFn(listShortlistShares);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["shares-list", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const revoke = useServerFn(revokeShortlistShare);
  const { confirm, confirmDialog } = useConfirmAction();

  const revokeMut = useMutation({
    mutationFn: (id: string) => revoke({ data: { orgId: orgId!, id } }),
    onSuccess: () => {
      toast.success("Share link revoked");
      qc.invalidateQueries({ queryKey: ["shares-list", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Shared shortlists
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only links you've sent to hiring managers and stakeholders.
            Revoke or track engagement at any time.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/client/candidates">
            <Share2 className="mr-2 h-4 w-4" /> Create a new share
          </Link>
        </Button>
      </header>

      {ctxState.isError ? (
        <QueryErrorCard error={ctxState.error} onRetry={ctxState.retry} retrying={ctxState.retrying} />
      ) : list.isError ? (
        <QueryErrorCard error={list.error} onRetry={() => list.refetch()} retrying={list.isFetching} />
      ) : list.isLoading || !orgId ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (list.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Share2
            className="mx-auto h-8 w-8 text-muted-foreground"
            aria-hidden
          />
          <h2 className="mt-3 text-lg font-medium">No shares yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select candidates in the Candidates workspace and choose{" "}
            <span className="font-medium">Share shortlist</span> to send a
            stakeholder-friendly link.
          </p>
          <Button asChild className="mt-4">
            <Link to="/client/candidates">Go to candidates</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(list.data ?? []).map((s) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${s.token}`;
            const expires = new Date(s.expires_at);
            const now = Date.now();
            const daysLeft = Math.round(
              (expires.getTime() - now) / (24 * 60 * 60 * 1000),
            );
            const isExpired = s.revoked_at || expires.getTime() < now;
            return (
              <article
                key={s.id}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      {s.title ??
                        (s.position?.title
                          ? `Shortlist — ${s.position.title}`
                          : "Shortlist review")}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        {s.candidate_count} candidate
                        {s.candidate_count === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="outline">{s.default_mode}</Badge>
                      {s.allow_comments ? (
                        <Badge variant="outline">Comments on</Badge>
                      ) : (
                        <Badge variant="outline">Read-only</Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" aria-hidden />
                        Created{" "}
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {s.revoked_at ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : isExpired ? (
                      <Badge variant="secondary">Expired</Badge>
                    ) : (
                      <Badge className="gap-1" variant="secondary">
                        <Clock className="h-3 w-3" aria-hidden />
                        {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                      </Badge>
                    )}
                  </div>
                </header>

                <div className="mt-4 grid gap-4 text-xs text-muted-foreground md:grid-cols-3">
                  <Metric
                    icon={<Eye className="h-3.5 w-3.5" />}
                    label="Views"
                    value={s.view_count}
                  />
                  <Metric
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    label="Comments"
                    value={s.comment_count}
                  />
                  <Metric
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Last viewed"
                    value={
                      s.last_viewed_at
                        ? new Date(s.last_viewed_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "Not yet opened"
                    }
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                  <code className="flex-1 truncate rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                    {url}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      toast.success("Link copied");
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(url, "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" /> Open
                  </Button>
                  {!s.revoked_at && !isExpired && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={async () => {
                        const r = await confirm({
                          title: "Revoke share link",
                          object:
                            s.title ??
                            (s.position?.title
                              ? `Shortlist — ${s.position.title}`
                              : "Shortlist review"),
                          description:
                            "Anyone holding this link loses access immediately.",
                          impact: [
                            "The link stops working for every recipient",
                            "Views already recorded stay on the audit trail",
                            "You can create a fresh link at any time",
                          ],
                          confirmLabel: "Revoke link",
                          tone: "destructive",
                        });
                        if (r.confirmed) revokeMut.mutate(s.id);
                      }}
                      disabled={revokeMut.isPending}
                      aria-busy={revokeMut.isPending || undefined}
                    >
                      <ShieldX className="mr-2 h-4 w-4" /> Revoke
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {confirmDialog}
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
