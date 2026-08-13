/**
 * Approvals inbox — pending client-visible actions in one place.
 *
 * Approving here runs the exact same server paths as approving in-place
 * (publish gate + evidence gate + approve_candidate_match for candidates,
 * contact release for contact, position activate for publish). Declines always
 * require a written reason, and every decision writes an audit row.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  approveApprovalItem,
  bulkApproveApprovals,
  declineApprovalItem,
  getApprovalsInbox,
} from "@/lib/admin-approvals.functions";
import {
  AGE_TIER_LABEL,
  ageLabel,
  ageTier,
  bulkEligible,
  MIN_DECLINE_REASON,
  type ApprovalItem,
  type ApprovalsPayload,
} from "@/lib/admin-approvals";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Check, Loader2, RefreshCw, X } from "lucide-react";
import { useScopedIncludeTest } from "@/lib/admin-scope";
import { BlockedReason } from "@/components/admin/blocked-reason";
import { QueueShortcuts } from "@/components/admin/queue-shortcuts";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveQueueState } from "@/lib/empty-states/queue-states";
import {
  QUEUE_ROW_ACTIVE_CLASS,
  useQueueKeyboard,
  type QueueKeyboard,
} from "@/lib/admin/queue-keyboard";


function TierBadge({ days }: { days: number }) {
  const tier = ageTier(days);
  const cls =
    tier === "overdue"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tier === "watch"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {AGE_TIER_LABEL[tier]} · {ageLabel(days)}
    </span>
  );
}

function DeclineForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const tooShort = reason.trim().length < MIN_DECLINE_REASON;
  return (
    <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-3">
      <Label htmlFor="decline-reason" className="text-xs">
        Reason for declining
      </Label>
      <span className="sr-only">Required</span>
      <Textarea
        id="decline-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="What has to change before this can be approved?"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={tooShort || pending}
          onClick={() => onSubmit(reason.trim())}
        >
          {pending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Confirm decline
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          {tooShort ? `At least ${MIN_DECLINE_REASON} characters.` : "Recorded in the audit trail."}
        </span>
      </div>
    </div>
  );
}

function Row({
  item,
  selected,
  onToggle,
  onApprove,
  onDecline,
  busy,
  rowProps,
}: {
  item: ApprovalItem;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onApprove: () => void;
  onDecline: (reason: string) => void;
  busy: boolean;
  rowProps: ReturnType<QueueKeyboard["rowProps"]>;
}) {
  const [declining, setDeclining] = useState(false);
  const blocked = item.blockers.length > 0;
  return (
    <li
      {...rowProps}
      ref={rowProps.ref as (node: HTMLLIElement | null) => void}
      className={`border-b border-border/70 px-4 py-3 last:border-0 ${QUEUE_ROW_ACTIVE_CLASS}`}
    >

      <div className="flex flex-wrap items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={selected}
          disabled={blocked}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`Select ${item.target_label}`}
        />
        <div className="min-w-[14rem] flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.target_label}</span>
            <TierBadge days={item.age_days} />
          </div>
          <p className="text-xs text-muted-foreground">
            {[item.context_label, item.org_name ? `Client: ${item.org_name}` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Requested by {item.requester_name ?? "unknown"} ·{" "}
            {new Date(item.requested_at).toLocaleString()}
          </p>
          {blocked ? (
            <BlockedReason
              className="mt-1"
              reasons={item.blockers}
              {...(item.link ? { resolve: { to: item.link, label: "Open the record to clear this" } } : {})}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* One primary action per row: approve when it can be approved,
              otherwise the route that clears the blocker. */}
          {blocked ? (
            item.link ? (
              <Button size="sm" asChild>
                <Link to={item.link}>Open record</Link>
              </Button>
            ) : null
          ) : (
            <>
              <Button size="sm" onClick={onApprove} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Check className="mr-1 h-3 w-3" />
                )}
                Approve
              </Button>
              {item.link ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to={item.link}>Open record</Link>
                </Button>
              ) : null}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeclining((v) => !v)}
            disabled={busy}
          >
            <X className="mr-1 h-3 w-3" />
            Decline
          </Button>
        </div>

      </div>
      {declining ? (
        <DeclineForm
          pending={busy}
          onCancel={() => setDeclining(false)}
          onSubmit={(reason) => {
            setDeclining(false);
            onDecline(reason);
          }}
        />
      ) : null}
    </li>
  );
}

export function ApprovalsInbox({ includeTest: explicit }: { includeTest?: boolean } = {}) {
  const includeTest = useScopedIncludeTest(explicit);
  const qc = useQueryClient();
  const queryKey = ["admin", "approvals", includeTest] as const;
  const query = useQuery<ApprovalsPayload>({
    queryKey,
    queryFn: () => getApprovalsInbox({ data: { include_test: includeTest } }),
    staleTime: 20_000,
  });

  const approveFn = useServerFn(approveApprovalItem);
  const declineFn = useServerFn(declineApprovalItem);
  const bulkFn = useServerFn(bulkApproveApprovals);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey });
    void qc.invalidateQueries({ queryKey: ["publish-queue"] });
    void qc.invalidateQueries({ queryKey: ["admin", "matches"] });
    void qc.invalidateQueries({ queryKey: ["admin", "positions"] });
  };

  const approve = useMutation({
    mutationFn: (item: ApprovalItem) =>
      approveFn({
        data: {
          kind: item.kind,
          target_id: item.target_id,
          ...(item.match_ids.length ? { match_ids: item.match_ids } : {}),
        },
      }),
    onSuccess: (res) => {
      const errs = (res as { errors?: unknown[] })?.errors ?? [];
      if (errs.length > 0) toast.warning(`Approved with ${errs.length} failure(s).`);
      else toast.success("Approved.");
      setSelected({});
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Approval failed." }),
    onSettled: () => setBusyId(null),
  });

  const decline = useMutation({
    mutationFn: (args: { item: ApprovalItem; reason: string }) =>
      declineFn({
        data: { kind: args.item.kind, target_id: args.item.target_id, reason: args.reason },
      }),
    onSuccess: () => {
      toast.success("Declined — reason recorded.");
      setSelected({});
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Decline failed." }),
    onSettled: () => setBusyId(null),
  });

  const bulk = useMutation({
    mutationFn: (items: ApprovalItem[]) =>
      bulkFn({
        data: {
          kind: "candidate_visible" as const,
          position_id: items[0]!.position_id!,
          target_ids: items.map((i) => i.target_id),
        },
      }),
    onSuccess: (res) => {
      const errs = (res as { errors?: unknown[] })?.errors ?? [];
      if (errs.length > 0) toast.warning(`${errs.length} of the selected could not be approved.`);
      else toast.success("Approved.");
      setSelected({});
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Bulk approve failed." }),
  });

  const allItems = useMemo(
    () => (query.data?.groups ?? []).flatMap((g) => g.items),
    [query.data],
  );
  const selectedItems = useMemo(
    () => allItems.filter((i) => selected[i.id]),
    [allItems, selected],
  );
  const canBulk = bulkEligible(selectedItems) && selectedItems[0]?.kind === "candidate_visible";

  // allItems is flattened in render order, so keyboard indexes line up.
  const kb = useQueueKeyboard({
    count: allItems.length,
    onPrimary: (index) => {
      const item = allItems[index];
      if (!item || item.blockers.length > 0 || busyId) return;
      setBusyId(item.id);
      approve.mutate(item);
    },
    onOpen: (index) => {
      const link = allItems[index]?.link;
      if (link) window.location.assign(link);
    },
  });



  if (query.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Approvals could not be loaded
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {query.error instanceof Error ? query.error.message : "Unknown error."}
          </p>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const groups = query.data?.groups ?? [];
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No approvals pending.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-hydrated="ready">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="font-medium">{query.data?.total ?? 0} pending</span>
        <span className="text-muted-foreground">
          {selectedItems.length > 0 ? `${selectedItems.length} selected` : "Select rows to bulk approve"}
        </span>
        <Button
          size="sm"
          className="ml-auto"
          disabled={!canBulk || bulk.isPending}
          onClick={() => bulk.mutate(selectedItems)}
        >
          {bulk.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Bulk approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw className="mr-1 h-3 w-3" />
          Refresh
        </Button>
      </div>
      {selectedItems.length > 1 && !canBulk ? (
        <p className="text-xs text-muted-foreground">
          Bulk approve only works inside a single position and a single approval type, and only for
          rows with no blockers.
        </p>
      ) : null}

      {groups.map((group) => (
        <Card key={group.kind}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {group.label}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({group.items.length})
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">{group.blurb}</p>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ul className="divide-y divide-border/70">
              {group.items.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  selected={!!selected[item.id]}
                  onToggle={(checked) =>
                    setSelected((prev) => ({ ...prev, [item.id]: checked }))
                  }
                  busy={busyId === item.id}
                  onApprove={() => {
                    setBusyId(item.id);
                    approve.mutate(item);
                  }}
                  onDecline={(reason) => {
                    setBusyId(item.id);
                    decline.mutate({ item, reason });
                  }}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
