import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Copy, Users, Undo2 } from "lucide-react";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import {
  getDuplicateReview,
  markPersonsDistinctFn,
  mergeDuplicatePersonsFn,
  revertDuplicateDecisionFn,
} from "@/lib/duplicate-candidates.functions";
import {
  MATCH_LABEL,
  type DuplicatePair,
  type DuplicatePersonSide,
} from "@/lib/duplicate-candidates";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE }) : "—";
}

function useDuplicates() {
  return useQuery({
    queryKey: ["duplicate-review"],
    queryFn: () => getDuplicateReview(),
  });
}

/** Banner shown above the candidate list when exact-identifier duplicates exist. */
export function DuplicateCandidatesBanner({ onReview }: { onReview: () => void }) {
  const query = useDuplicates();
  const count = query.data?.pairs.length ?? 0;
  if (query.isPending || query.isError || count === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Copy className="h-4 w-4 text-amber-600" />
        <span>
          <strong>
            {count} possible duplicate {count === 1 ? "pair" : "pairs"}
          </strong>{" "}
          — same email or phone across more than one person record.
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={onReview}>
        Review duplicates
      </Button>
    </div>
  );
}

function SideCard({
  side,
  label,
}: {
  side: DuplicatePersonSide;
  label: string;
}) {
  return (
    <div className="flex-1 rounded-md border bg-card p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {side.candidate_profile_id ? (
          <Link
            to="/admin/candidates/$id"
            params={{ id: side.candidate_profile_id }}
            target="_blank"
            className="text-xs underline"
          >
            Open profile
          </Link>
        ) : null}
      </div>
      <p className="font-medium">{side.display_name ?? "Unnamed person"}</p>
      <p className="text-xs text-muted-foreground">
        {side.emails.join(", ") || side.primary_email || "No email"}
      </p>
      {side.phones.length ? (
        <p className="text-xs text-muted-foreground">{side.phones.join(", ")}</p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">First seen {fmtDate(side.first_seen_at)}</p>
      <div className="mt-2 space-y-1">
        {side.applications.length === 0 ? (
          <p className="text-xs text-muted-foreground">No applications</p>
        ) : (
          side.applications.slice(0, 5).map((app, i) => (
            <div key={`${app.application_id ?? i}`} className="text-xs">
              <span className="font-medium">{app.position_title ?? "Unknown role"}</span>
              {app.organization_name ? (
                <span className="text-muted-foreground"> · {app.organization_name}</span>
              ) : null}
              <span className="text-muted-foreground">
                {" "}
                · {fmtDate(app.applied_at)}
                {app.stage ? ` · ${app.stage.replace(/_/g, " ")}` : ""}
              </span>
            </div>
          ))
        )}
        {side.applications.length > 5 ? (
          <p className="text-xs text-muted-foreground">
            +{side.applications.length - 5} more applications
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PairRow({ pair }: { pair: DuplicatePair }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<"merge_a" | "merge_b" | "distinct" | null>(null);
  const [note, setNote] = useState("");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["duplicate-review"] });
    void qc.invalidateQueries({ queryKey: ["admin-candidates"] });
  };

  const merge = useMutation({
    mutationFn: (input: { keep: string; drop: string }) =>
      mergeDuplicatePersonsFn({
        data: { keep_person_id: input.keep, merge_person_id: input.drop, note: note || undefined },
      }),
    onSuccess: () => {
      toast.success("Merged into a single person");
      setOpen(null);
      setNote("");
      invalidate();
    },
    onError: (e: Error) => toastError(e, { fallback: "Merge failed" }),
  });

  const distinct = useMutation({
    mutationFn: () =>
      markPersonsDistinctFn({
        data: {
          person_a_id: pair.person_a.person_id,
          person_b_id: pair.person_b.person_id,
          note: note || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Marked as distinct people");
      setOpen(null);
      setNote("");
      invalidate();
    },
    onError: (e: Error) => toastError(e, { fallback: "Could not save" }),
  });

  const busy = merge.isPending || distinct.isPending;

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {pair.matched.map((m) => (
          <Badge key={`${m.kind}-${m.value}`} variant="secondary">
            {MATCH_LABEL[m.kind]}: {m.value}
          </Badge>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <SideCard side={pair.person_a} label="Person A" />
        <SideCard side={pair.person_b} label="Person B" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => setOpen("merge_a")}>
          Merge into Person A
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpen("merge_b")}>
          Merge into Person B
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen("distinct")}>
          Distinct people
        </Button>
      </div>

      <Dialog open={open !== null} onOpenChange={(v) => (v ? null : setOpen(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "distinct" ? "Mark as distinct people" : "Merge duplicate people"}
            </DialogTitle>
            <DialogDescription>
              {open === "distinct"
                ? "This pair will stop appearing in the duplicate list. A platform admin can undo it."
                : "All applications, evidence and history stay intact and become reachable under the surviving person. Nothing is deleted, and a platform admin can undo the merge."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`dup-note-${pair.pair_key}`}>Note (optional)</Label>
            <Textarea
              id={`dup-note-${pair.pair_key}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this decision was made"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (open === "distinct") {
                  distinct.mutate();
                } else if (open === "merge_a") {
                  merge.mutate({
                    keep: pair.person_a.person_id,
                    drop: pair.person_b.person_id,
                  });
                } else if (open === "merge_b") {
                  merge.mutate({
                    keep: pair.person_b.person_id,
                    drop: pair.person_a.person_id,
                  });
                }
              }}
            >
              {busy ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Full review list: suspected pairs plus previously resolved decisions. */
export function DuplicateCandidatesPanel() {
  const query = useDuplicates();
  const qc = useQueryClient();

  const revert = useMutation({
    mutationFn: (decisionId: string) =>
      revertDuplicateDecisionFn({ data: { decision_id: decisionId } }),
    onSuccess: () => {
      toast.success("Decision reverted");
      void qc.invalidateQueries({ queryKey: ["duplicate-review"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "forbidden"
          ? "Only a platform admin can undo duplicate decisions"
          : e.message || "Could not revert",
      ),
  });

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Possible duplicates</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Pairs are only listed on an exact email or phone match. Name similarity is never used, and
        nothing is merged automatically.
      </p>

      <PanelState
        query={query}
        isEmpty={(query.data?.pairs.length ?? 0) === 0}
        empty={<PanelEmpty title="No duplicate identifiers found" />}
      >
        <div className="space-y-3">
          {query.data?.pairs.map((pair) => (
            <PairRow key={pair.pair_key} pair={pair} />
          ))}
        </div>
      </PanelState>

      {query.data && query.data.resolved.length > 0 ? (
        <div className="space-y-2 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Resolved decisions
          </h3>
          {query.data.resolved.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
            >
              <span>
                <Badge variant={row.decision === "merged" ? "default" : "secondary"}>
                  {row.decision === "merged" ? "Merged" : "Distinct"}
                </Badge>{" "}
                <span className="text-muted-foreground">
                  {fmtDate(row.created_at)}
                  {row.decided_by_name ? ` · ${row.decided_by_name}` : ""}
                  {row.note ? ` · ${row.note}` : ""}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1"
                disabled={revert.isPending}
                onClick={() => revert.mutate(row.id)}
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
