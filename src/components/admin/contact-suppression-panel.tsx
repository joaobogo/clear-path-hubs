import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getContactStatus,
  requestContactException,
} from "@/lib/outreach-suppression.functions";
import {
  scopeLabel,
  type ContactStatus,
  type SuppressionChannel,
} from "@/lib/outreach-suppression";

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Shared read of contact permission. Enforcement is server-side; this only
 * mirrors it. `blocked` is true while loading is done and on any error, so a
 * composer that gates on it fails closed.
 */
export function useContactAllowed(args: {
  organizationId: string | null | undefined;
  candidateProfileId: string | null | undefined;
  channel?: SuppressionChannel;
}) {
  const fetchStatus = useServerFn(getContactStatus);
  const enabled = !!args.organizationId && !!args.candidateProfileId;

  const query = useQuery({
    queryKey: ["contact-status", args.organizationId, args.candidateProfileId],
    enabled,
    queryFn: () =>
      fetchStatus({
        data: {
          organization_id: args.organizationId as string,
          candidate_profile_id: args.candidateProfileId as string,
        },
      }),
  });

  const status = query.data as ContactStatus | undefined;
  const verdict = args.channel
    ? status?.verdicts.find((v) => v.channel === args.channel)
    : undefined;

  const allowed = args.channel
    ? !!verdict?.allowed
    : !!status && status.verdicts.some((v) => v.allowed);

  return {
    ...query,
    status,
    verdict,
    /** Never allow while loading or on error — the block is the safe default. */
    canSend: query.isSuccess && allowed,
    blockReason: args.channel
      ? (verdict?.reasonLabel ?? null)
      : (status?.verdicts.find((v) => !v.allowed)?.reasonLabel ?? null),
  };
}

/** Small inline badge for composer surfaces and list rows. */
export function ContactSuppressionBadge(props: {
  organizationId: string | null | undefined;
  candidateProfileId: string | null | undefined;
  channel?: SuppressionChannel;
}) {
  const { isLoading, isError, canSend, blockReason, status } = useContactAllowed(props);

  if (isLoading) return <Skeleton className="h-5 w-28 rounded-full" />;
  if (isError)
    return (
      <Badge variant="destructive" className="gap-1">
        <ShieldAlert className="h-3 w-3" /> Contact status unavailable — sending blocked
      </Badge>
    );
  if (canSend && !status?.suppressed) return null;

  return (
    <Badge variant={canSend ? "secondary" : "destructive"} className="gap-1">
      <ShieldAlert className="h-3 w-3" />
      {canSend ? "Opted out — exception in force" : (blockReason ?? "Contact blocked")}
    </Badge>
  );
}

export function ContactSuppressionPanel(props: {
  organizationId: string | null | undefined;
  candidateProfileId: string | null | undefined;
  candidateMatchId: string;
}) {
  const qc = useQueryClient();
  const { isLoading, isError, error, refetch, status } = useContactAllowed({
    organizationId: props.organizationId,
    candidateProfileId: props.candidateProfileId,
  });
  const grant = useServerFn(requestContactException);
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const mutation = useMutation({
    mutationFn: () =>
      grant({ data: { candidate_match_id: props.candidateMatchId, reason } }),
    onSuccess: async () => {
      toast.success("Exception recorded. Contact is unblocked and audited.");
      setOpen(false);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["contact-status"] });
      await refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!props.organizationId || !props.candidateProfileId) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border p-3">
        <Skeleton className="h-5 w-40 rounded-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Contact status unavailable — sending is blocked</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm">
            We could not confirm whether this person may be contacted, so every channel
            is treated as blocked until we can. {(error as Error)?.message}
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!status) return null;

  // Nothing to show when this person is contactable and has never opted out.
  if (!status.suppressed && !status.fullyBlocked) return null;

  const activeException = status.exceptions.find(
    (e) => !e.revoked_at && (!e.expires_at || new Date(e.expires_at) > new Date()),
  );

  return (
    <div
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3"
      data-qa="contact-suppression-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        {status.suppressed ? (
          <ShieldAlert className="h-4 w-4 text-destructive" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        )}
        <h3 className="text-sm font-semibold">
          {status.suppressed ? "This person opted out of outreach" : "Contact is blocked"}
        </h3>
        {activeException && (
          <Badge variant="secondary">Exception in force until {fmt(activeException.expires_at) === "—" ? "revoked" : fmt(activeException.expires_at)}</Badge>
        )}
      </div>

      {status.optOuts.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {status.optOuts.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{o.channelLabel}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{scopeLabel(o.scope)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{fmt(o.created_at)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                matched on {o.matched_by === "email" ? "email address" : "candidate record"}
              </span>
              {o.reason && (
                <span className="text-muted-foreground">— “{o.reason}”</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {status.verdicts.map((v) => (
          <div
            key={v.channel}
            className="flex items-start gap-2 rounded-md border bg-background/60 p-2 text-sm"
          >
            <span className="min-w-16 font-medium">{v.label}</span>
            {v.allowed ? (
              <span className="text-muted-foreground">Sending allowed</span>
            ) : (
              <span className="text-destructive">
                {v.reasonLabel}
                {v.explanation ? (
                  <span className="block text-xs text-muted-foreground">
                    {v.explanation}
                  </span>
                ) : null}
              </span>
            )}
          </div>
        ))}
      </div>

      {!activeException && status.suppressed && (
        <div className="space-y-2">
          {!open ? (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Request an exception
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border bg-background p-3">
              <Label htmlFor="suppression-exception-reason">
                Why contact is justified <span aria-hidden="true">*</span>
              </Label>
              <Textarea
                id="suppression-exception-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Explain the lawful basis and who agreed to it. At least 20 characters; this is recorded against the candidate."
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={reason.trim().length < 20 || mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Record exception
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Sending stays blocked in the database until an exception is recorded. There is
            no override without one.
          </p>
        </div>
      )}

      {status.exceptions.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {status.exceptions.length} exception
          {status.exceptions.length === 1 ? "" : "s"} on record · latest granted{" "}
          {fmt(status.exceptions[0]?.granted_at ?? null)}
        </div>
      )}
    </div>
  );
}
