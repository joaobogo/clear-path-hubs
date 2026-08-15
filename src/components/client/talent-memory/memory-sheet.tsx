import { clientStageLabel } from "@/lib/client-stage-labels";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  Archive,
  ArchiveRestore,
  Award,
  History,
  RotateCw,
} from "lucide-react";
import {
  getSilverMedalist,
  updateSilverMedalist,
  logReengagement,
  REASON_LABELS,
  type SilverConsent,
} from "@/lib/talent-memory.functions";
import { QueryErrorCard } from "@/components/client/query-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toFitPresentation } from "@/lib/client-fit-presentation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WorkspaceRowsSkeleton } from "@/components/workspace/pending-states";
import { formatEnumLabel } from "@/lib/human-labels";
import { formatDateTime } from "@/lib/format/datetime";

export function MemorySheet({
  orgId,
  id,
  readOnly,
  onClose,
}: {
  orgId: string;
  id: string | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getSilverMedalist);
  const updateFn = useServerFn(updateSilverMedalist);
  const reengageFn = useServerFn(logReengagement);

  const {
    data,
    isError: detailIsError,
    error: detailError,
    isFetching: detailIsFetching,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["talent-memory", "detail", orgId, id],
    queryFn: () => getFn({ data: { orgId, id: id! } }),
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updateFn>[0]["data"]) =>
      updateFn({ data: patch }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["talent-memory"] });
    },
    onError: (e: Error) => toastError(e),
  });

  const reengage = useMutation({
    mutationFn: (memId: string) => reengageFn({ data: { orgId, id: memId } }),
    onSuccess: () => {
      toast.success("Re-engagement logged");
      qc.invalidateQueries({ queryKey: ["talent-memory"] });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't reengage. Nothing was saved — please try again." }),
  });

  const m = data?.memory;
  const events = data?.events ?? [];
  const history = data?.match_history ?? [];

  return (
    <Sheet open={!!id} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {detailIsError ? (
          <div className="p-4">
            <QueryErrorCard
              title="We couldn't load this record"
              error={detailError}
              onRetry={() => refetchDetail()}
              retrying={detailIsFetching}
            />
          </div>
        ) : !m ? (
          <div className="p-4"><WorkspaceRowsSkeleton rows={3} /></div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Award className="h-4 w-4 text-warning-strong" />
                {m.candidate.display_name}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-6 text-sm">
              {m.candidate.headline && (
                <p className="text-muted-foreground">{m.candidate.headline}</p>
              )}

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Why they were passed
                </h3>
                <div className="mt-2 rounded-md border bg-muted/30 p-3">
                  <p className="font-medium">{REASON_LABELS[m.reason_category]}</p>
                  {m.role_title_snapshot && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      From role {m.role_title_snapshot}
                      {m.score_snapshot != null && (
                        <> · {toFitPresentation(null, m.score_snapshot).headline}</>
                      )}
                    </p>
                  )}
                  {m.reason_notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.reason_notes}</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Consent &amp; ownership
                </h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["granted", "pending", "declined", "withdrawn"] as SilverConsent[]).map(
                    (c) => (
                      <button
                        key={c}
                        disabled={readOnly || update.isPending}
                        onClick={() =>
                          update.mutate({ orgId, id: m.id, consent_status: c })
                        }
                        className={`rounded-full border px-3 py-1 text-xs capitalize ${
                          m.consent_status === c
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c}
                      </button>
                    ),
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Owner:{" "}
                  <span className="font-medium text-foreground">
                    {m.owner_name ?? "Unassigned"}
                  </span>{" "}
                  · Tagged by {m.tagged_by_name ?? "team"} on{" "}
                  {new Date(m.tagged_at).toLocaleDateString()}
                </p>
              </section>

              {m.skills_snapshot.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Skills snapshot
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.skills_snapshot.map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-normal">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {history.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Match history
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {history.map((h) => (
                      <li
                        key={h.match_id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-medium">{h.position_title}</p>
                          <p className="text-muted-foreground">
                            {clientStageLabel(h.stage)} ·{" "}
                            {new Date(h.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          to="/client/candidates/$id"
                          params={{ id: h.match_id }}
                          className="text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <History className="h-3 w-3" /> Timeline
                </h3>
                <ol className="mt-2 space-y-2 border-l pl-3">
                  {events.length === 0 ? (
                    <li className="text-xs text-muted-foreground">No events yet.</li>
                  ) : (
                    events.map((e) => (
                      <li key={e.id} className="text-xs">
                        <p className="font-medium capitalize">
                          {formatEnumLabel(e.event_type)}
                        </p>
                        <p className="text-muted-foreground">
                          {formatDateTime(e.created_at)}
                          {e.actor_name && <> · {e.actor_name}</>}
                        </p>
                        {e.notes && <p className="mt-0.5">{e.notes}</p>}
                      </li>
                    ))
                  )}
                </ol>
              </section>

              <div className="sticky bottom-0 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => reengage.mutate(m.id)}
                    disabled={readOnly || reengage.isPending}
                  >
                    <RotateCw className="mr-1 h-3.5 w-3.5" />
                    Log re-engagement
                  </Button>
                  {m.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update.mutate({ orgId, id: m.id, status: "archived" })
                      }
                      disabled={readOnly || update.isPending}
                    >
                      <Archive className="mr-1 h-3.5 w-3.5" />
                      Archive
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => update.mutate({ orgId, id: m.id, status: "active" })}
                      disabled={readOnly || update.isPending}
                    >
                      <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                      Re-open
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
