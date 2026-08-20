import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { AlarmClock, MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useConfirmAction } from "@/components/ds/confirm-action";
import {
  listOutcomeBreaches,
  sendPendingOutcomeNotices,
} from "@/lib/candidate/outcome-sla.functions";
import {
  OUTCOME_STATE_LABEL,
  OUTCOME_STATE_TONE,
  type OutcomeState,
} from "@/lib/candidate/outcome-sla";
import { REVIEW_WINDOW_BUSINESS_DAYS } from "@/lib/candidate/response-commitment";

export const Route = createFileRoute("/_authenticated/admin/outcome-sla")({
  head: () => ({
    meta: [
      { title: "Answers we owe candidates · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Every application past our review commitment with no outcome, and every decision the candidate was never told about.",
      },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.outcome-sla.tsx",
  ),
  component: OutcomeSla,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function OutcomeSla() {
  const fetchRows = useServerFn(listOutcomeBreaches);
  const sendNotices = useServerFn(sendPendingOutcomeNotices);
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirmAction();
  // One global scope, set on the admin layout.
  const showTest = useIncludeTestRecords();

  const query = useQuery({
    queryKey: ["admin", "outcome-sla", showTest],
    queryFn: () => fetchRows({ data: { include_test: showTest } }),
  });

  const send = useMutation({
    mutationFn: () => sendNotices({ data: {} } as Any),
    onSuccess: (res: Any) => {
      toast.success(
        res?.sent ? `${res.sent} outcome ${res.sent === 1 ? "notice" : "notices"} sent.` : "Nothing was due to send.",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "outcome-sla"] });
    },
    onError: (err: Any) => toast.error(err?.message ?? "Could not send the notices."),
  });

  /**
   * These notices reach real applicants, so the sweep asks first and names how
   * many people it will write to. Cancel is the safe default.
   */
  async function confirmSend() {
    const due = Number(counts.outcome_not_sent ?? 0);
    const result = await confirm({
      title: "Send outstanding outcome notices",
      object:
        due === 1
          ? "1 candidate who was decided but never told"
          : `${due} candidates who were decided but never told`,
      description:
        "Each of them receives the outcome message for their application, immediately. Nobody who was already told is written to again.",
      impact: [
        "One outcome message per candidate on this list",
        "Sent to the address on their application",
        "Every send is recorded on the audit trail",
      ],
      confirmLabel: "Send notices",
    });
    if (result.confirmed) send.mutate();
  }

  const data = query.data as Any;
  const rows: Any[] = data?.rows ?? [];
  const counts = data?.counts ?? { outcome_not_sent: 0, overdue: 0 };

  return (
    <div className="space-y-8 p-6">
      {confirmDialog}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Answers we owe candidates</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          We tell every applicant they hear from us either way, within{" "}
          {REVIEW_WINDOW_BUSINESS_DAYS} business days. This is where that promise is failing —
          decided applications nobody was told about first, then applications waiting past the
          window with no outcome at all.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={send.isPending} onClick={() => void confirmSend()}>
          {send.isPending ? "Sending…" : "Send outstanding outcome notices"}
        </Button>
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>We could not load the queue</AlertTitle>
          <AlertDescription>
            This is a read failure on our side, not an empty queue. Reload, and if it persists the
            outcome sweep should be checked directly.
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.failed ? (
        <Alert variant="destructive">
          <AlertTitle>Partial read</AlertTitle>
          <AlertDescription>
            The applications read failed, so this list is incomplete. Do not treat it as all clear.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MailWarning className="h-4 w-4 text-[color:var(--brand-danger)]" />
            Decided, never told
          </div>
          <p className="mt-1 text-2xl font-semibold">{counts.outcome_not_sent}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            An outcome exists and no message was sent. Fix these first.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlarmClock className="h-4 w-4" />
            Past the window, no outcome
          </div>
          <p className="mt-1 text-2xl font-semibold">{counts.overdue}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Still open past our commitment. Decide, or write with an honest status.
          </p>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading the queue…</p>
      ) : rows.length === 0 && !query.isError && !data?.failed ? (
        <p className="text-sm text-muted-foreground">
          Nobody is waiting past the commitment, and every decision has been sent.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Waiting</th>
                <th className="px-3 py-2 font-medium">What we owe</th>
                <th className="px-3 py-2 font-medium">Ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.application_id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.candidate_name ?? "Candidate"}</div>
                    <div className="text-xs text-muted-foreground">{row.candidate_email ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    {row.position_id ? (
                      <Link
                        to="/admin/positions/$id"
                        params={{ id: row.position_id }}
                        className="underline underline-offset-2"
                      >
                        {row.position_title ?? "Role"}
                      </Link>
                    ) : (
                      (row.position_title ?? "Role")
                    )}
                    <div className="text-xs text-muted-foreground">
                      {row.organization_name ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={OUTCOME_STATE_TONE[row.assessment.state as OutcomeState]}>
                      {OUTCOME_STATE_LABEL[row.assessment.state as OutcomeState]}
                    </Badge>
                    {row.is_test_record ? (
                      <div className="mt-1 text-xs text-muted-foreground">Test record</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.assessment.businessDaysWaiting} business days
                    {row.assessment.daysOverdue > 0 ? (
                      <div className="text-xs text-[color:var(--brand-danger)]">
                        {row.assessment.daysOverdue} past commitment
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.assessment.obligation}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
