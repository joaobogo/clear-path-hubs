import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, ExternalLink, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ds";
import {
  applyDataHealthRepair,
  getDataHealthExceptions,
  previewDataHealthRepair,
} from "@/lib/data-health-exceptions.functions";
import {
  KIND_EXPLAINER,
  KIND_LABEL,
  REPAIR_LABEL,
  type DataHealthException,
} from "@/lib/data-health-exceptions";
import { setMatchClientVisibility } from "@/lib/admin.functions";

type PreviewState = {
  exception: DataHealthException;
  repair: "acknowledge_orphan" | "realign_match_org" | "retry_parse";
  repair_label: string;
  changes: string[];
};

/**
 * Operational exception board for broken records. Client-visible breakages sort
 * first, then oldest. Repairs are previewed before they run; nothing here
 * deletes data.
 */
export function DataHealthExceptionsPanel() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [note, setNote] = useState("");

  const load = useServerFn(getDataHealthExceptions);
  const previewFn = useServerFn(previewDataHealthRepair);
  const applyFn = useServerFn(applyDataHealthRepair);
  const hideFn = useServerFn(setMatchClientVisibility);

  const query = useQuery({
    queryKey: ["data-health-exceptions"],
    queryFn: () => load({ data: {} }),
  });

  const previewMut = useMutation({
    mutationFn: async (key: string) => await previewFn({ data: { key } }),
    onSuccess: (res) => {
      if (!res.found) {
        toast.info("That exception is gone — the list has been refreshed.");
        void qc.invalidateQueries({ queryKey: ["data-health-exceptions"] });
        return;
      }
      if (res.repair === "none") {
        toast.info("No safe automatic repair — open the record to fix it by hand.");
        return;
      }
      setNote("");
      setPreview(res as PreviewState);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Nothing previewed.");
      return await applyFn({
        data: {
          key: preview.exception.key,
          previewed_repair: preview.repair,
          note: note.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Repair applied and audited.");
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ["data-health-exceptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hideMut = useMutation({
    mutationFn: async (matchId: string) =>
      await hideFn({ data: { match_id: matchId, visibility: "hidden" } }),
    onSuccess: () => {
      toast.success("Hidden from the client workspace.");
      void qc.invalidateQueries({ queryKey: ["data-health-exceptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden />
            Data health exceptions
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Broken records that make screens fail. Anything a client can see right now sorts
            first, then oldest. Repairs are previewed and audited; nothing is deleted here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {query.data && (
            <div className="text-right text-xs text-muted-foreground">
              <div className="tabular-nums">
                <strong className="text-foreground">{query.data.totals.all}</strong> open
              </div>
              <div className="tabular-nums">
                {query.data.totals.client_visible} client-visible ·{" "}
                {query.data.totals.repairable} repairable
              </div>
            </div>
          )}
        </div>
      </header>

      {query.isPending ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="p-5">
          <ErrorState
            title="Could not load data health exceptions"
            description={(query.error as Error)?.message}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : rows.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">
          No data health exceptions.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Exception</th>
                <th className="px-4 py-2 font-medium">Affected record</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Visible</th>
                <th className="px-4 py-2 font-medium tabular-nums">Age</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((e) => (
                <tr key={e.key} className="align-top hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle
                        className={
                          "h-3.5 w-3.5 " +
                          (e.client_visible ? "text-destructive" : "text-muted-foreground")
                        }
                        aria-hidden
                      />
                      {KIND_LABEL[e.kind]}
                    </div>
                    <p className="mt-1 max-w-md text-xs text-muted-foreground">
                      {KIND_EXPLAINER[e.kind]}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.record_label}</div>
                    <p className="mt-0.5 max-w-sm text-xs text-muted-foreground">{e.detail}</p>
                    {e.position_title && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {e.position_title}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">{e.client_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {e.client_visible ? (
                      <Badge variant="destructive">Client-visible</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        Internal
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{e.age_days}d</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={e.repair === "none" || previewMut.isPending}
                        onClick={() => previewMut.mutate(e.key)}
                      >
                        <Wrench className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {e.repair === "none" ? "No auto-repair" : "Preview repair"}
                      </Button>
                      {e.candidate_match_id && e.client_visible && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={hideMut.isPending}
                          onClick={() => hideMut.mutate(e.candidate_match_id as string)}
                        >
                          <EyeOff className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Hide from client
                        </Button>
                      )}
                      {e.candidate_match_id ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link
                            to="/admin/candidates/$id"
                            params={{ id: e.candidate_match_id }}
                          >
                            Open
                            <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Button>
                      ) : e.position_id ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/admin/positions/$id" params={{ id: e.position_id }}>
                            Open
                            <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {preview ? REPAIR_LABEL[preview.repair] : "Preview repair"}
            </DialogTitle>
            <DialogDescription>
              {preview
                ? `${KIND_LABEL[preview.exception.kind]} · ${preview.exception.record_label}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <ul className="space-y-1.5 rounded-md border bg-muted/40 p-3 text-sm">
                {preview.changes.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden>·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
              <div>
                <Label htmlFor="dh-note" className="text-xs">
                  Note for the audit trail (optional)
                </Label>
                <Textarea
                  id="dh-note"
                  value={note}
                  onChange={(ev) => setNote(ev.target.value)}
                  rows={3}
                  className="mt-1"
                  placeholder="Why this repair, and anything the next person should know."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button disabled={applyMut.isPending} onClick={() => applyMut.mutate()}>
              {applyMut.isPending ? "Applying…" : "Apply repair"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
