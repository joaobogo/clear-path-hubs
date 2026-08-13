import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { CalendarClock, Copy, Loader2 } from "lucide-react";
import {
  approveStartWithoutPayment,
  closePendingLead,
  listPendingLeads,
  markCallOutcome,
} from "@/lib/pending-leads.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryState } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { PAYMENTS_ENABLED } from "@/config/commerce";


export const Route = createFileRoute("/_authenticated/admin/pending-leads")({
  head: () => ({
    meta: [
      { title: "Pending leads — calls and unpaid roles | TaaSFlow admin" },
      {
        name: "description",
        content:
          "Every client waiting on a call or a payment, oldest first, with one-click payment links and approvals.",
      },
      { property: "og:title", content: "Pending leads | TaaSFlow admin" },
      { property: "og:description", content: "Calls booked and roles waiting on payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PendingLeadsPage,
});

function PendingLeadsPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listPendingLeads);
  const approve = useServerFn(approveStartWithoutPayment);
  const close = useServerFn(closePendingLead);
  const outcome = useServerFn(markCallOutcome);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["admin-pending-leads"],
    queryFn: () => load(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-pending-leads"] });

  const approveMutation = useMutation({
    mutationFn: (vars: { positionId: string; reason: string }) => approve({ data: vars }),
    onSuccess: async (result) => {
      if (!result.ok) return toastError(result);
      toast.success("Start approved. The role can publish without payment.");
      await refresh();
    },
    onError: () => toast.error("We couldn't approve that start."),
  });

  const closeMutation = useMutation({
    mutationFn: (vars: { positionId: string; reason: string }) => close({ data: vars }),
    onSuccess: async () => {
      toast.success("Lead closed.");
      await refresh();
    },
  });

  const outcomeMutation = useMutation({
    mutationFn: (vars: { callId: string; outcome: "completed" | "no_show" | "cancelled" }) =>
      outcome({ data: vars }),
    onSuccess: async () => {
      toast.success("Call updated.");
      await refresh();
    },
  });

  const copyPaymentLink = async (positionId: string) => {
    const url = `${window.location.origin}/checkout?position=${positionId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Payment link copied.");
    } catch {
      toast.error("Copy failed — the link is /checkout?position=" + positionId);
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pending leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clients who chose to talk first, and roles still waiting on payment. Oldest first.
        </p>
      </div>

      <QueryState
        query={query}
        tone="admin"
        surface="admin/pending-leads"
        isEmpty={(d) => d.leads.length === 0}
        skeleton={<Skeleton className="h-64 w-full rounded-xl" />}
        empty={
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nothing pending. Every role in the system is paid, covered or exempt.
            </CardContent>
          </Card>
        }
      >
        {(data) => (
        <div className="space-y-4">
          {data.leads.map((lead) => (
            <Card key={lead.positionId}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {lead.positionTitle}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {lead.organizationName}
                      </span>
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Waiting {lead.waitingDays} day{lead.waitingDays === 1 ? "" : "s"}
                      {lead.contactEmail ? ` · ${lead.contactEmail}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={lead.paymentStatus === "pending" ? "default" : "outline"}>
                      {lead.paymentStatus === "pending" ? "Call booked" : "Unpaid"}
                    </Badge>
                    {lead.waitingDays >= 7 ? <Badge variant="destructive">Stalled</Badge> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.call ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    <span>
                      {new Intl.DateTimeFormat("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(lead.call.start))}
                    </span>
                    <Badge variant="outline">{lead.call.status}</Badge>
                    {lead.call.status === "booked" ? (
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            outcomeMutation.mutate({ callId: lead.call!.id, outcome: "completed" })
                          }
                        >
                          Call happened
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            outcomeMutation.mutate({ callId: lead.call!.id, outcome: "no_show" })
                          }
                        >
                          No show
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {PAYMENTS_ENABLED ? (
                    <Button size="sm" variant="outline" onClick={() => copyPaymentLink(lead.positionId)}>
                      <Copy className="mr-2 h-4 w-4" aria-hidden />
                      Copy payment link
                    </Button>
                  ) : null}

                  <Button asChild size="sm" variant="ghost">
                    <Link to="/admin/positions/$id" params={{ id: lead.positionId }}>
                      Open role
                    </Link>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Reason for ${lead.positionTitle}`}
                    placeholder="Reason (recorded against the role)"
                    value={reasons[lead.positionId] ?? ""}
                    onChange={(e) =>
                      setReasons((r) => ({ ...r, [lead.positionId]: e.target.value }))
                    }
                    className="max-w-sm"
                  />
                  <Button
                    size="sm"
                    disabled={
                      (reasons[lead.positionId] ?? "").trim().length < 5 ||
                      approveMutation.isPending
                    }
                    onClick={() =>
                      approveMutation.mutate({
                        positionId: lead.positionId,
                        reason: reasons[lead.positionId] ?? "",
                      })
                    }
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Approve start without payment
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={closeMutation.isPending}
                    onClick={() =>
                      closeMutation.mutate({
                        positionId: lead.positionId,
                        reason: reasons[lead.positionId] ?? "No reason given",
                      })
                    }
                  >
                    Close lead
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        )}
      </QueryState>
    </div>
  );
}
