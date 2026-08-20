import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminPayments } from "@/lib/admin-payments.functions";
import { getPaymentsOps } from "@/lib/admin-ops.functions";
import { getStripePaymentMode } from "@/lib/integration-health.functions";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, CheckCircle2, AlertTriangle, Timer } from "lucide-react";

type Filter = "all" | "paid" | "failed" | "refunded";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments ledger — Admin | TaaSFlow" },
      {
        name: "description",
        content:
          "Read-only ledger of every payment: organisation, role, amount, status, date and provider reference.",
      },
      { property: "og:title", content: "Payments ledger — Admin | TaaSFlow" },
      { property: "og:description", content: "Read-only record of every TaaSFlow payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPaymentsPage,
});

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function statusTone(status: string) {
  if (status === "paid") return "default";
  if (status === "refunded") return "destructive";
  if (status === "exempt") return "secondary";
  return "outline";
}

function AdminPaymentsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const includeTest = useIncludeTestRecords();
  const load = useServerFn(listAdminPayments);
  const loadMode = useServerFn(getStripePaymentMode);

  const paymentsQuery = useQuery({
    queryKey: ["admin-payments", includeTest, filter],
    queryFn: () => load({ data: { filter } }),
  });
  const modeQuery = useQuery({
    queryKey: ["stripe-payment-mode"],
    queryFn: () => loadMode(),
  });
  const { data, isLoading, error } = paymentsQuery;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          Read-only ledger. Payment records can't be edited here — the provider is the source of
          truth.
        </p>
      </div>

      {modeQuery.data?.mode === "sandbox" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sandbox mode — these are test transactions. No money has moved.
          </AlertDescription>
        </Alert>
      )}

      <OpsPanel />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>

        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="failed">Failed / unpaid</TabsTrigger>
          <TabsTrigger value="refunded">Refunded</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Loading payments" : `${data?.rows.length ?? 0} payments`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
              <p>
                We couldn't load the ledger. If this keeps happening you may not have access —
                ask a platform admin.
              </p>
              <Button variant="outline" size="sm" onClick={() => void paymentsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : !data?.rows.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No payments match this filter yet. Paid roles appear here the moment the provider
              confirms a charge.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.organizationName ?? "—"}
                        {row.environment !== "live" ? (
                          <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                            {row.environment}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.positionTitle ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(row.amountCents, row.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusTone(row.status) as any}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(row.paidAt ?? row.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                        {row.providerReference ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Payments & pilot operations panel ──────────────────────────────────────
// Real records only: confirmed charges, roles stuck before payment, live pilots.
function OpsPanel() {
  const includeTest = useIncludeTestRecords();
  const loadOps = useServerFn(getPaymentsOps);
  const opsQuery = useQuery({
    queryKey: ["admin-payments-ops", includeTest],
    queryFn: () => loadOps(),
    staleTime: 60_000,
  });
  const { data, isLoading, error } = opsQuery;

  if (isLoading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    );
  }
  if (!data) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center text-sm text-muted-foreground">
          <p>
            {error
              ? "We couldn't load payment operations. The ledger below is unaffected."
              : "Payment operations aren't available right now."}
          </p>
          <Button variant="outline" size="sm" onClick={() => void opsQuery.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totals = Object.entries(data.totals.paid_cents_by_currency);
  const linkedPilots = data.pilots.filter((p) => p.position_title);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-success" /> Who paid
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {totals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No confirmed charges yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                {totals.map(([cur, cents]) => (
                  <div key={cur}>
                    <div className="text-xl font-semibold tabular-nums">{money(cents, cur)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {cur} · {data.totals.paid_count} charge
                      {data.totals.paid_count === 1 ? "" : "s"}
                    </div>
                  </div>
                ))}
              </div>
              <ul className="space-y-1.5 text-xs">
                {data.paid.slice(0, 6).map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">
                      {p.org ?? "—"} · {p.position ?? "—"}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {money(p.amount_cents, p.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Abandoned before payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.abandoned.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody is stuck before payment right now.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {data.abandoned.slice(0, 8).map((a) => (
                <li key={a.positionId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.title}</div>
                    <div className="truncate text-muted-foreground">
                      {a.org ?? "—"} ·{" "}
                      {a.stage === "checkout_started" ? "checkout started" : "never started"}
                    </div>
                  </div>
                  <Link
                    to="/admin/positions/$id"
                    params={{ id: a.positionId }}
                    className="shrink-0 font-medium text-primary hover:underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {linkedPilots.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4 text-muted-foreground" /> Pilots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              {linkedPilots.slice(0, 8).map((p) => (
                <li key={p.orgId} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.org}</div>
                    <div className="truncate text-muted-foreground">
                      {p.position_title}
                      {p.override ? " · admin override" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant={p.status === "active" ? "default" : "outline"}>
                      {String(p.status ?? "—").replace(/_/g, " ")}
                    </Badge>
                    <div className="mt-0.5 tabular-nums text-muted-foreground">
                      {p.days_left == null
                        ? "no end date"
                        : p.days_left >= 0
                          ? `${p.days_left}d left`
                          : `ended ${Math.abs(p.days_left)}d ago`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
