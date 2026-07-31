/**
 * Staff desk for personalised dashboards: who has access, who's asked for a
 * custom build, and what that pipeline is worth.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getStaffDashboardDesk,
  grantDashboardAccess,
  revokeDashboardAccess,
  setDashboardRequestOutcome,
} from "@/lib/admin-dashboards.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/dashboard-requests")({
  head: () => ({
    meta: [
      { title: "Dashboard requests and access | TaaSFlow staff" },
      {
        name: "description",
        content:
          "Staff desk for personalised dashboards: quote custom builds, track agreed work, and manage which accounts have dashboard access.",
      },
      { property: "og:title", content: "Dashboard requests | TaaSFlow staff" },
      {
        property: "og:description",
        content: "Quote, agree and deliver custom dashboards, and manage dashboard entitlements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardRequestsPage,
});

function money(cents: number, currency = "gbp") {
  return (cents / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  });
}

function DashboardRequestsPage() {
  const deskFn = useServerFn(getStaffDashboardDesk);
  const outcomeFn = useServerFn(setDashboardRequestOutcome);
  const grantFn = useServerFn(grantDashboardAccess);
  const revokeFn = useServerFn(revokeDashboardAccess);
  const queryClient = useQueryClient();
  const [quotes, setQuotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["staff-dashboard-desk"],
    queryFn: () => deskFn(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff-dashboard-desk"] });

  const outcome = useMutation({
    mutationFn: (input: Parameters<typeof outcomeFn>[0]["data"]) => outcomeFn({ data: input }),
    onSuccess: (res) => {
      if ("error" in res) return toast.error(res.error);
      toast.success("Updated.");
      refresh();
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Access revoked.");
      refresh();
    },
  });

  const grantAgain = useMutation({
    mutationFn: (organizationId: string) =>
      grantFn({ data: { organizationId, source: "staff" as const, note: "Re-granted by staff" } }),
    onSuccess: () => {
      toast.success("Access granted.");
      refresh();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const open = data.requests.filter((r) => ["new", "quoted", "agreed"].includes(r.status));
  const closed = data.requests.filter((r) => !["new", "quoted", "agreed"].includes(r.status));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboards desk</h1>
        <p className="text-sm text-muted-foreground">
          Custom dashboard work is chargeable. Quote it, agree it, deliver it.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Quoted and agreed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{money(data.revenue.quotedCents)}</p>
            <p className="text-xs text-muted-foreground">{open.length} open requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{money(data.revenue.deliveredCents)}</p>
            <p className="text-xs text-muted-foreground">{data.grants.length} accounts with access</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Open requests
        </h2>
        {open.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Nothing waiting. New custom dashboard requests land here.
          </p>
        ) : (
          open.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{r.organizationName}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <Badge variant={r.status === "new" ? "default" : "secondary"}>{r.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">"{r.description}"</p>
                {r.quoteAmountCents != null && (
                  <p className="text-sm">
                    Quoted <strong>{money(r.quoteAmountCents, r.quoteCurrency)}</strong>
                    {r.quoteNote ? ` — ${r.quoteNote}` : ""}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="h-8 w-32"
                    inputMode="numeric"
                    placeholder="Quote £"
                    value={quotes[r.id] ?? ""}
                    onChange={(e) => setQuotes((q) => ({ ...q, [r.id]: e.target.value }))}
                    aria-label={`Quote for ${r.organizationName}`}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!Number(quotes[r.id])}
                    onClick={() =>
                      outcome.mutate({
                        id: r.id,
                        status: "quoted",
                        quoteAmountCents: Math.round(Number(quotes[r.id]) * 100),
                      })
                    }
                  >
                    Send quote
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => outcome.mutate({ id: r.id, status: "agreed" })}
                  >
                    Mark agreed
                  </Button>
                  <Button size="sm" onClick={() => outcome.mutate({ id: r.id, status: "delivered" })}>
                    Delivered
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => outcome.mutate({ id: r.id, status: "declined" })}
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Accounts with dashboard access
        </h2>
        {data.grants.length === 0 ? (
          <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No manual grants. Annual subscribers get access automatically.
          </p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {data.grants.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{g.organizationName}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.source} · {g.status}
                      {g.note ? ` · ${g.note}` : ""}
                    </p>
                  </div>
                  {g.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(g.id)}>
                      Revoke
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => grantAgain.mutate(g.organizationId)}
                    >
                      Grant again
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Closed
          </h2>
          <Card>
            <CardContent className="divide-y p-0">
              {closed.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="truncate">{r.organizationName}</span>
                  <span className="text-muted-foreground">
                    {r.status}
                    {r.quoteAmountCents ? ` · ${money(r.quoteAmountCents, r.quoteCurrency)}` : ""}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
