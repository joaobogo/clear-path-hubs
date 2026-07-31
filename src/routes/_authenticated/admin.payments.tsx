import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminPayments } from "@/lib/admin-payments.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Lock } from "lucide-react";

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
  const load = useServerFn(listAdminPayments);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-payments", filter],
    queryFn: () => load({ data: { filter } }),
  });

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
            <p className="py-8 text-center text-sm text-muted-foreground">
              You don't have access to the payments ledger. Ask a platform admin.
            </p>
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
