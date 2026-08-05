/**
 * Offer rows that say who owes what.
 *
 * Status, holder and the expected response date, in that order, for every
 * offer. Nothing is estimated: no acceptance odds, no negotiation advice, no
 * pay benchmarks, and no compensation figure the client did not enter.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HIRE_STATUS_LABEL,
  setOfferResponseDate,
  type HireRecordDTO,
} from "@/lib/hires.functions";
import {
  buildOfferRow,
  byOfferUrgency,
  type OfferHolder,
} from "@/lib/client-offer-holder";
import { ErrorState } from "@/components/client/states";

const HOLDER_TONE: Record<OfferHolder, string> = {
  you: "border-primary/40 bg-primary/10 text-foreground",
  candidate: "border-blue-300/60 bg-blue-50 text-foreground dark:bg-blue-950/30",
  taasflow: "border-slate-300/70 bg-muted text-foreground",
  none: "border-border bg-muted/60 text-muted-foreground",
};

function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function OfferHolderRows({
  orgId,
  hires,
  isPending,
  isError,
  onRetry,
  readOnly,
}: {
  orgId: string;
  hires: HireRecordDTO[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  readOnly: boolean;
}) {
  const now = new Date();
  const rows = [...hires].sort((a, b) => byOfferUrgency(a, b, now));

  if (isPending) {
    return (
      <ul className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-[74px] animate-pulse rounded-lg border bg-muted/50" />
        ))}
      </ul>
    );
  }
  if (isError) {
    return <ErrorState title="We couldn't load your offers" onRetry={onRetry} />;
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        No offers out.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((h) => {
        const row = buildOfferRow(h, now);
        return (
          <li
            key={h.id}
            className={`rounded-lg border bg-card p-3 ${
              row.needs_attention ? "border-amber-400/70" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {h.candidate_name}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {h.position_title}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.last_event_label}
                  {row.last_event ? ` · ${fmtDate(row.last_event.at)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{HIRE_STATUS_LABEL[h.status]}</Badge>
                <Badge variant="outline" className={HOLDER_TONE[row.holder]}>
                  {row.holder === "none" ? "Closed" : `Waiting on ${row.holder_label}`}
                </Badge>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {row.needs_attention ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              ) : (
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              )}
              <span className={row.needs_attention ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                {h.expected_response_date
                  ? `${fmtDate(h.expected_response_date)} — ${row.response.label}`
                  : row.response.label}
              </span>
              {!readOnly && row.open && (
                <ResponseDateDialog orgId={orgId} hire={h} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ResponseDateDialog({ orgId, hire }: { orgId: string; hire: HireRecordDTO }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(hire.expected_response_date ?? "");
  const qc = useQueryClient();
  const setFn = useServerFn(setOfferResponseDate);
  const mut = useMutation({
    mutationFn: (date: string | null) => setFn({ data: { orgId, id: hire.id, date } }),
    onSuccess: () => {
      toast.success(value ? "Response date recorded" : "Response date cleared");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["hires", orgId] });
      void qc.invalidateQueries({ queryKey: ["client-context"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't save the date"),
  });

  return (
    <>
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setOpen(true)}>
        {hire.expected_response_date ? "Change date" : "Set a date"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expected response date</DialogTitle>
            <DialogDescription>
              Record the date you and the recruiting team agreed on for{" "}
              {hire.candidate_name}. Leave it empty if nothing was agreed.
            </DialogDescription>
          </DialogHeader>
          <label className="block text-sm" htmlFor={`resp-${hire.id}`}>
            <span className="mb-1 block font-medium">Date</span>
            <Input
              id={`resp-${hire.id}`}
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => mut.mutate(null)}
              disabled={mut.isPending || !hire.expected_response_date}
            >
              Clear
            </Button>
            <Button
              onClick={() => mut.mutate(value ? value.slice(0, 10) : null)}
              disabled={mut.isPending}
            >
              {mut.isPending ? "Saving…" : "Save date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
