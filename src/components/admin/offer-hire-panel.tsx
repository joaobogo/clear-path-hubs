import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, BadgeCheck, CalendarCheck2, ShieldCheck } from "lucide-react";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import {
  closePositionWithOutcomeFn,
  getOfferHireRollup,
  getPositionOfferTracking,
  recordOfferOutcomeFn,
  setHireStartDateFn,
} from "@/lib/offer-hire.functions";
import {
  CLOSE_REASONS,
  DEFAULT_GUARANTEE_DAYS,
  OFFER_OUTCOMES,
  OFFER_STATUS_LABEL,
  OUTCOMES_REQUIRING_REASON,
  type CloseReason,
  type OfferOutcome,
  type OfferRow,
} from "@/lib/offer-hire";

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm font-medium">We could not load offer tracking.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Nothing has been changed. Try again in a moment.
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function GuaranteeCell({ offer }: { offer: OfferRow }) {
  if (!offer.guarantee) {
    return <span className="text-muted-foreground">No start date</span>;
  }
  const g = offer.guarantee;
  return (
    <span className="inline-flex items-center gap-1.5">
      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="tabular-nums">{g.ends_on}</span>
      <span className="text-xs text-muted-foreground">
        {g.state === "active"
          ? `${g.days_remaining}d left`
          : g.state === "not_started"
            ? "not started"
            : "elapsed"}
      </span>
    </span>
  );
}

/** Offer & hire tracking for a single position. */
export function PositionOfferTrackingPanel({ positionId }: { positionId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["offer-tracking", positionId],
    queryFn: () => getPositionOfferTracking({ data: { position_id: positionId } }),
  });

  const [outcomeFor, setOutcomeFor] = useState<OfferRow | null>(null);
  const [outcome, setOutcome] = useState<OfferOutcome>("offer_sent");
  const [closeReason, setCloseReason] = useState<CloseReason>("candidate_declined");
  const [notes, setNotes] = useState("");

  const [startFor, setStartFor] = useState<OfferRow | null>(null);
  const [startDate, setStartDate] = useState("");
  const [guaranteeDays, setGuaranteeDays] = useState(String(DEFAULT_GUARANTEE_DAYS));

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeOutcome, setCloseOutcome] = useState<"filled" | "closed">("filled");
  const [closeNote, setCloseNote] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["offer-tracking"] });
    void queryClient.invalidateQueries({ queryKey: ["offer-hire-rollup"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-position", positionId] });
  };

  const record = useMutation({
    mutationFn: (vars: {
      hire_id: string;
      outcome: OfferOutcome;
      close_reason?: CloseReason;
      notes?: string;
    }) => recordOfferOutcomeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Offer outcome recorded");
      setOutcomeFor(null);
      setNotes("");
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const setStart = useMutation({
    mutationFn: (vars: { hire_id: string; start_date: string; guarantee_days?: number }) =>
      setHireStartDateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Start date confirmed — guarantee window derived");
      setStartFor(null);
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const closePosition = useMutation({
    mutationFn: (vars: { position_id: string; outcome: "filled" | "closed"; reason: string }) =>
      closePositionWithOutcomeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Position closed");
      setCloseOpen(false);
      setCloseNote("");
      invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const data = query.data;
  const closed = data ? data.position_status === "filled" || data.position_status === "closed" : false;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <BadgeCheck className="h-4 w-4" />
            Offers and hire confirmation
          </h3>
          <p className="text-sm text-muted-foreground">
            Guarantee end dates are derived from the recorded start date.
          </p>
        </div>
        {data && !closed && (
          <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
            Close position
          </Button>
        )}
      </header>

      <PanelState
        query={query}
        isEmpty={(data?.offers.length ?? 0) === 0}
        empty={<PanelEmpty title="No offers on this role" description="Offers extended for this position will appear here." />}
      >
      {data && (
      <>
      {!data.can_close_filled && !closed && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{data.close_blocked_reason}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Offers extended" value={data.totals.extended} />
        <Stat label="Accepted" value={data.totals.accepted} />
        <Stat label="Declined" value={data.totals.declined} />
        <Stat label="Start dates confirmed" value={data.totals.start_dates_confirmed} />
      </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Start date</th>
                <th className="px-3 py-2">Guarantee ends</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.offers.map((o) => (
                <tr key={o.hire_id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/candidates/$id"
                      params={{ id: o.candidate_profile_id }}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {o.candidate_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={o.status === "hire_confirmed" ? "default" : "secondary"}>
                      {OFFER_STATUS_LABEL[o.status]}
                    </Badge>
                    {o.close_reason && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {CLOSE_REASONS.find((r) => r.value === o.close_reason)?.label}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{fmtDate(o.start_date)}</td>
                  <td className="px-3 py-2">
                    <GuaranteeCell offer={o} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{o.owner_name ?? "Unassigned"}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStartFor(o);
                          setStartDate(o.start_date ?? "");
                          setGuaranteeDays(
                            String(o.guarantee?.days ?? DEFAULT_GUARANTEE_DAYS),
                          );
                        }}
                      >
                        Start date
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setOutcomeFor(o);
                          setOutcome("offer_sent");
                          setNotes("");
                        }}
                      >
                        Record outcome
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
      )}
      </PanelState>

      {/* Record outcome */}
      <Dialog open={outcomeFor != null} onOpenChange={(v) => !v && setOutcomeFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record offer outcome</DialogTitle>
            <DialogDescription>{outcomeFor?.candidate_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="offer-outcome">Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as OfferOutcome)}>
                <SelectTrigger id="offer-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFER_OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {OUTCOMES_REQUIRING_REASON.includes(outcome) && (
              <div className="space-y-1.5">
                <Label htmlFor="offer-reason">Reason</Label>
                <Select
                  value={closeReason}
                  onValueChange={(v) => setCloseReason(v as CloseReason)}
                >
                  <SelectTrigger id="offer-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOSE_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="offer-notes">Notes (optional)</Label>
              <Textarea
                id="offer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOutcomeFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={record.isPending}
              onClick={() =>
                outcomeFor &&
                record.mutate({
                  hire_id: outcomeFor.hire_id,
                  outcome,
                  ...(OUTCOMES_REQUIRING_REASON.includes(outcome)
                    ? { close_reason: closeReason }
                    : {}),
                  ...(notes.trim() ? { notes: notes.trim() } : {}),
                })
              }
            >
              Record outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start date */}
      <Dialog open={startFor != null} onOpenChange={(v) => !v && setStartFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set start date</DialogTitle>
            <DialogDescription>
              The guarantee window is calculated from this date — it cannot be typed in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date">Start date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guarantee-days">Guarantee period (days)</Label>
              <Input
                id="guarantee-days"
                type="number"
                min={0}
                max={365}
                value={guaranteeDays}
                onChange={(e) => setGuaranteeDays(e.target.value)}
              />
              {startDate && (
                <p className="text-xs text-muted-foreground">
                  Guarantee ends{" "}
                  {new Date(
                    new Date(`${startDate}T00:00:00Z`).getTime() +
                      (Number(guaranteeDays) || DEFAULT_GUARANTEE_DAYS) * 86_400_000,
                  )
                    .toISOString()
                    .slice(0, 10)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStartFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={setStart.isPending || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)}
              onClick={() =>
                startFor &&
                setStart.mutate({
                  hire_id: startFor.hire_id,
                  start_date: startDate,
                  guarantee_days: Number(guaranteeDays) || DEFAULT_GUARANTEE_DAYS,
                })
              }
            >
              Save start date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close position */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close position</DialogTitle>
            <DialogDescription>
              Closing as filled requires a confirmed hire on this role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="close-outcome">Outcome</Label>
              <Select
                value={closeOutcome}
                onValueChange={(v) => setCloseOutcome(v as "filled" | "closed")}
              >
                <SelectTrigger id="close-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filled" disabled={!data?.can_close_filled}>
                    Filled {data?.can_close_filled ? "" : "(no confirmed hire)"}
                  </SelectItem>
                  <SelectItem value="closed">Closed without a hire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="close-reason-text">Reason</Label>
              <Textarea
                id="close-reason-text"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                rows={3}
                placeholder="Why is this role closing?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                closePosition.isPending ||
                closeNote.trim().length < 3 ||
                (closeOutcome === "filled" && !data?.can_close_filled)
              }
              onClick={() =>
                closePosition.mutate({
                  position_id: positionId,
                  outcome: closeOutcome,
                  reason: closeNote.trim(),
                })
              }
            >
              Close position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** Portfolio rollup for /admin. */
export function OfferHireRollupPanel() {
  const query = useQuery({
    queryKey: ["offer-hire-rollup"],
    queryFn: () => getOfferHireRollup({ data: {} }),
  });

  const d = query.data;
  const empty = d
    ? d.totals.extended === 0 && d.missing_hire_records.length === 0 && d.totals.hires_confirmed === 0
    : false;

  return (
    <section className="space-y-4">
      <header>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CalendarCheck2 className="h-4 w-4" />
          Offers and hires
        </h3>
        <p className="text-sm text-muted-foreground">
          Recorded outcomes only. Guarantee windows are derived from start dates.
        </p>
      </header>

      <PanelState
        query={query}
        isEmpty={empty}
        empty={<PanelEmpty title="No offers on record" description="Offer and hire outcomes will appear here once recorded." />}
      >
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Offers extended" value={d.totals.extended} />
            <Stat label="Accepted" value={d.totals.accepted} />
            <Stat label="Hires confirmed" value={d.totals.hires_confirmed} />
            <Stat label="Guarantees active" value={d.totals.guarantees_active} />
          </div>

          {d.missing_hire_records.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                {d.missing_hire_records.length} position
                {d.missing_hire_records.length === 1 ? "" : "s"} marked filled without a confirmed
                hire record
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {d.missing_hire_records.slice(0, 8).map((m) => (
                  <li key={m.position_id}>
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: m.position_id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {m.position_title}
                    </Link>
                    <span className="text-muted-foreground"> — {m.organization_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.upcoming_starts.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Upcoming start dates</p>
              <ul className="mt-2 space-y-1 text-sm">
                {d.upcoming_starts.slice(0, 8).map((o) => (
                  <li key={o.hire_id} className="flex items-center justify-between gap-3">
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: o.position_id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {o.candidate_name} — {o.position_title}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">{o.start_date}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.guarantees_active.length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Guarantee periods running</p>
              <ul className="mt-2 space-y-1 text-sm">
                {d.guarantees_active.slice(0, 8).map((o) => (
                  <li key={o.hire_id} className="flex items-center justify-between gap-3">
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: o.position_id }}
                      className="underline-offset-2 hover:underline"
                    >
                      {o.candidate_name} — {o.position_title}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">
                      ends {o.guarantee?.ends_on} ({o.guarantee?.days_remaining}d)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      </PanelState>
    </section>
  );
}
