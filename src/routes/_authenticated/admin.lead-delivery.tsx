import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listLeadNotifications,
  retryLeadNotificationFn,
  sendLeadNotificationTest,
} from "@/lib/leads/lead-notifications.functions";
import { LEAD_TYPE_LABEL } from "@/config/lead-notifications";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/lead-delivery")({
  head: () => ({
    meta: [
      { title: "Lead delivery · TaaSFlow admin" },
      {
        name: "description",
        content:
          "Every lead captured on the website with the delivery result of its Teams message and internal email alert.",
      },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
  component: LeadDeliveryPage,
});

function StatusBadge({ status }: { status: string }) {
  if (status === "delivered" || status === "sent") {
    return <Badge variant="outline">Delivered</Badge>;
  }
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function LeadDeliveryPage() {
  const [onlyFailed, setOnlyFailed] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = ["admin-lead-delivery", onlyFailed] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listLeadNotifications({ data: { onlyFailed, limit: 100 } }),
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryLeadNotificationFn({ data: { id } }),
    onSuccess: (res) => {
      toast[res.ok ? "success" : "error"](
        res.ok ? "Notification re-sent." : "Retry did not fully succeed — see the detail column.",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-lead-delivery"] });
    },
    onError: () => toast.error("Retry failed."),
  });

  const test = useMutation({
    mutationFn: () => sendLeadNotificationTest({}),
    onSuccess: (res) => {
      const parts = [
        `Teams: ${res.teams.ok ? "delivered" : `failed (${res.teams.detail ?? "unknown"})`}`,
        `Email: ${res.email.ok ? `sent to ${res.email.recipients.join(", ")}` : `failed (${res.email.detail ?? "unknown"})`}`,
      ];
      toast[res.teams.ok && res.email.ok ? "success" : "error"](parts.join(" · "));
      void queryClient.invalidateQueries({ queryKey: ["admin-lead-delivery"] });
    },
    onError: () => toast.error("Test could not be sent."),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Lead delivery</h1>
          <p className="text-sm text-muted-foreground">
            Every lead captured on the website, with the real result of its Teams message and
            internal email alert. Nothing here is inferred — each row is a recorded delivery
            attempt.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOnlyFailed((v) => !v)}>
            {onlyFailed ? "Show all" : "Only failures"}
          </Button>
          <Button onClick={() => test.mutate()} disabled={test.isPending}>
            {test.isPending ? "Sending test…" : "Send test lead"}
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Leads shown</p>
            <p className="text-2xl font-semibold">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              With a failed channel
            </p>
            <p className="text-2xl font-semibold">{data?.failed ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest lead</p>
            <p className="text-sm font-medium">
              {items[0] ? new Date(items[0].createdAt).toLocaleString() : "None recorded yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery record</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading delivery record…</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {onlyFailed
                ? "No failed deliveries. Every lead notification has been delivered."
                : "No leads recorded yet. New website submissions will appear here immediately."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-3">Received</th>
                    <th className="p-3">Lead</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Teams</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">CRM</th>
                    <th className="p-3">Detail</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 align-top">
                      <td className="p-3 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                        {row.attempts > 1 ? (
                          <span className="block text-xs text-muted-foreground">
                            {row.attempts} attempts
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <span className="font-medium">{row.fullName ?? "Unnamed"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {[row.company, row.email].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {LEAD_TYPE_LABEL[row.leadType as keyof typeof LEAD_TYPE_LABEL] ??
                          row.leadType}
                        <span className="block text-xs text-muted-foreground">{row.source}</span>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={row.teamsStatus} />
                      </td>
                      <td className="p-3">
                        <StatusBadge status={row.emailStatus} />
                        <span className="block text-xs text-muted-foreground">
                          {row.emailRecipients.join(", ")}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{row.crmStatus}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[22rem]">
                        {[row.teamsDetail, row.emailDetail].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="p-3">
                        {row.teamsStatus === "failed" || row.emailStatus === "failed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(row.id)}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
