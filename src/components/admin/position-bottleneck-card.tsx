/**
 * Position bottleneck diagnosis card.
 *
 * Shows where candidates pile up for this role, with the org's own closed roles
 * as the only comparison. Below the pipeline threshold it says so instead of
 * guessing, and it never writes a narrative or an industry benchmark.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPositionBottleneck } from "@/lib/admin-position-bottleneck.functions";
import { addInternalNote } from "@/lib/admin-workbench.functions";
import { MIN_COMPARABLE_ROLES } from "@/lib/position-bottleneck";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Info, RefreshCw } from "lucide-react";

export function PositionBottleneckCard({
  positionId,
  organizationId,
  onOpenStage,
}: {
  positionId: string;
  organizationId?: string | null;
  onOpenStage?: (stage: string) => void;
}) {
  const qc = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["admin", "position-bottleneck", positionId],
    queryFn: () => getPositionBottleneck({ data: { position_id: positionId } }),
    staleTime: 60_000,
  });

  const addNote = useServerFn(addInternalNote);
  const saveNote = useMutation({
    mutationFn: (body: string) =>
      addNote({
        data: {
          entityType: "position",
          entityId: positionId,
          organizationId: organizationId ?? null,
          body,
          kind: "risk",
          pinned: false,
        },
      }),
    onSuccess: () => {
      toast.success("Note added");
      setNote("");
      setNoteOpen(false);
      void qc.invalidateQueries({ queryKey: ["internal-notes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the note"),
  });

  if (query.isLoading) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section className="rounded-lg border bg-card p-4 text-center">
        <AlertTriangle className="mx-auto h-5 w-5 text-destructive" />
        <p className="mt-2 text-sm font-medium">Could not load the bottleneck diagnosis</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {query.error instanceof Error ? query.error.message : "Unexpected error"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Retry
        </Button>
      </section>
    );
  }

  const data = query.data!;
  const diagnosed = data.state === "diagnosed";
  const comparisonAvailable = diagnosed && data.comparison.available;

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="bottleneck-heading">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="bottleneck-heading" className="text-sm font-semibold">
            Where this role is stuck
          </h2>
          <p className="text-xs text-muted-foreground">
            Flow over the last {data.window_days} days, compared with this client's closed roles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {diagnosed ? (
            <Badge variant="destructive">Bottleneck: {data.bottleneck_label}</Badge>
          ) : (
            <Badge variant="outline">Insufficient pipeline to diagnose</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh diagnosis"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {!diagnosed && (
        <p className="flex items-start gap-2 border-b bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Only {data.entered_total} candidate{data.entered_total === 1 ? "" : "s"} have entered this
          pipeline. At least {data.threshold} are needed before a stage can be named as the
          bottleneck — the stage figures below are shown as-is.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Stage</th>
              <th className="px-3 py-2 text-right">In</th>
              <th className="px-3 py-2 text-right">Out</th>
              <th className="px-3 py-2 text-right">Now</th>
              <th className="px-3 py-2 text-right">Median days</th>
              <th className="px-3 py-2 text-right">
                {comparisonAvailable ? "Closed roles" : "Closed roles*"}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.stages.map((s) => {
              const isBottleneck = diagnosed && s.stage === data.bottleneck_stage;
              return (
                <tr key={s.stage} className={isBottleneck ? "bg-destructive/5" : undefined}>
                  <td className="px-4 py-2.5 font-medium">
                    {s.label}
                    {isBottleneck && (
                      <span className="ml-2 text-xs font-normal text-destructive">
                        highest pile-up
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.entered}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.exited}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.current}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {s.median_days ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {comparisonAvailable ? (s.org_median_days ?? "—") : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {onOpenStage && s.current > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onOpenStage(s.stage)}
                      >
                        Open stage
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {comparisonAvailable
            ? `Compared with ${diagnosed ? data.comparison.roles_compared : 0} closed roles for this client.`
            : `*No comparison yet — this client needs at least ${MIN_COMPARABLE_ROLES} closed roles.`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setNoteOpen((v) => !v)}
        >
          Add internal note
        </Button>
      </div>

      {noteOpen && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <label htmlFor="bottleneck-note" className="text-xs font-medium">
            What is causing the delay?
          </label>
          <Textarea
            id="bottleneck-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1.5 text-sm"
            placeholder="Client has not returned feedback on the last three submissions…"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={note.trim().length < 2 || saveNote.isPending}
              onClick={() => saveNote.mutate(note.trim())}
            >
              Save note
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setNoteOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
