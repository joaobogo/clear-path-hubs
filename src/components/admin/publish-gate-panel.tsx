import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublishGateQueue } from "@/lib/publish-gate.functions";
import { setPositionStatus } from "@/lib/admin.functions";
import {
  PUBLISH_BLOCKER_FIELD,
  PUBLISH_BLOCKER_LABEL,
  type PublishBlocker,
} from "@/lib/publish-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { PaymentExemptionDialog } from "@/components/admin/payment-exemption-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Lock, PencilLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { useScopedIncludeTest } from "@/lib/admin-scope";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE, day: "numeric", month: "short", year: "numeric" });
}

function BlockerChip({ blocker, positionId }: { blocker: PublishBlocker; positionId: string }) {
  const field = PUBLISH_BLOCKER_FIELD[blocker];
  const label = PUBLISH_BLOCKER_LABEL[blocker];
  if (!field) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
        <Lock className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return (
    <Link
      to="/admin/positions/$id/edit"
      params={{ id: positionId }}
      search={{ step: undefined }}
      hash={field}
      className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning-foreground underline-offset-2 hover:underline"
    >
      <PencilLine className="h-3 w-3" />
      {label}
    </Link>
  );
}

/**
 * "Publish blockers" — every unpublished role with the reason it cannot go live,
 * read from the same server gate that runs on publish. No client-side bypass of
 * the payment check: the only way past it is a real payment or an audited
 * exemption granted through the existing exempt function.
 */
export function PublishGatePanel({ 
  includeTest: explicit,
  q: qTerm,
}: { 
  includeTest?: boolean;
  q?: string;
} = {}) {
  const includeTest = useScopedIncludeTest(explicit);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<any | null>(null);
  const fetchQueue = useServerFn(getPublishGateQueue);
  const publish = useServerFn(setPositionStatus);

  const query = useQuery({
    queryKey: ["publish-gate-queue", includeTest, explicit, qTerm],
    queryFn: () => fetchQueue({ data: { includeTest, q: qTerm } }),
  });

  const publishMut = useMutation({
    mutationFn: async (positionId: string) => {
      setBusy(positionId);
      return await publish({ data: { id: positionId, action: "activate" } });
    },
    onSuccess: async () => {
      toast.success("Role published. The change is audited.");
      await qc.invalidateQueries({ queryKey: ["publish-gate-queue"] });
    },
    onError: (e: Error) => toastError(e),
    onSettled: () => setBusy(null),
  });

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="publish-gate-heading">
      <Dialog open={!!confirmRow} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish role to client workspace?</DialogTitle>
            <DialogDescription>
              This will make <span className="font-semibold text-foreground">{confirmRow?.title}</span> live for{" "}
              <span className="font-semibold text-foreground">{confirmRow?.organization_name}</span>.
              This is a real notification, sent immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-md bg-warning/10 p-3 text-sm text-warning-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Once live, candidates will be able to see this role if visibility is public.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRow(null)}>
              Cancel
            </Button>
            <Button
              disabled={publishMut.isPending}
              onClick={() => {
                if (confirmRow) {
                  publishMut.mutate(confirmRow.position_id);
                  setConfirmRow(null);
                }
              }}
            >
              {publishMut.isPending ? "Publishing…" : "Confirm & Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="publish-gate-heading" className="text-sm font-semibold">
            Publish blockers
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Why each unpublished role is not live yet — read from the same checks that run on publish.
          </p>
        </div>
        {query.data && (
          <Badge variant="secondary" className="tabular-nums">
            {query.data.rows.filter((r) => !r.can_publish).length} blocked ·{" "}
            {query.data.rows.filter((r) => r.can_publish).length} ready
          </Badge>
        )}
      </header>

      <div className="p-4">
        <PanelState
          query={query}
          isEmpty={(query.data?.rows.length ?? 0) === 0}
          empty={<PanelEmpty title="All roles publishable" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr className="whitespace-nowrap">
                  <th className="px-3 py-2 font-medium">Role · Client</th>
                  <th className="px-3 py-2 font-medium">Publish state</th>
                  <th className="px-3 py-2 font-medium">Payment</th>
                  <th className="px-3 py-2 font-medium">Blocking</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Publish-ready</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {query.data?.rows.map((r) => (
                  <tr key={r.position_id} className="align-top">
                    <td className="min-w-[12rem] px-3 py-2">
                      <Link
                        to="/admin/positions/$id"
                        params={{ id: r.position_id }}
                        className="font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.organization_name}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs capitalize">
                      {r.status.replace(/_/g, " ")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      <span
                        className={
                          r.payment_satisfied
                            ? "text-success dark:text-success"
                            : "font-medium text-destructive"
                        }
                      >
                        {r.payment_status ?? "unpaid"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.blockers.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success dark:text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Nothing blocking
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.blockers.map((b) => (
                            <BlockerChip key={b} blocker={b} positionId={r.position_id} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {r.owner_name ?? (r.owner_user_id ? "Assigned" : "Unassigned")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
                      {r.can_publish ? fmtDate(r.publish_ready_at) : "Not ready"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {!r.payment_satisfied && (
                          <PaymentExemptionDialog
                            positionId={r.position_id}
                            paymentStatus={r.payment_status}
                          />
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!r.can_publish || busy === r.position_id}
                          onClick={() => setConfirmRow(r)}
                          title={
                            r.can_publish
                              ? "Publish this role"
                              : "Resolve the blocking items before publishing"
                          }
                        >
                          {busy === r.position_id ? "Publishing…" : "Publish"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelState>
      </div>
    </section>
  );
}
