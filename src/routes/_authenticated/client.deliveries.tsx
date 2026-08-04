import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import {
  listDeliveries,
  getUpcomingDeliverySchedule,
  submitDeliveryFeedback,
  type DeliveryRow,
} from "@/lib/deliveries.functions";
import { EmptyState, SkeletonCards, NoWorkspaceState, ErrorState } from "@/components/client/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Users, TrendingUp, Sparkles, PackageOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/deliveries")({
  head: () => ({
    meta: [
      { title: "Deliveries · Client workspace" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Weekly shortlist deliveries, batch review, calibration and next scheduled dates.",
      },
    ],
  }),
  component: DeliveriesPage,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DeliveriesPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listDeliveries);
  const scheduleFn = useServerFn(getUpcomingDeliverySchedule);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctxQuery.data?.active?.organization_id ?? null;

  const deliveries = useQuery({
    queryKey: ["client", "deliveries", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId!, limit: 16 } }),
    enabled: !!orgId,
  });
  const schedule = useQuery({
    queryKey: ["client", "delivery-schedule", orgId],
    queryFn: () => scheduleFn({ data: { organization_id: orgId!, weeks: 4 } }),
    enabled: !!orgId,
  });

  const trend = useMemo(() => {
    const rows = deliveries.data?.deliveries ?? [];
    if (rows.length === 0) return null;
    const grouped = new Map<string, { total: number; high: number }>();
    for (const d of rows) {
      const g = grouped.get(d.iso_week) ?? { total: 0, high: 0 };
      g.total += d.candidate_count;
      g.high += d.band_high;
      grouped.set(d.iso_week, g);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-8);
  }, [deliveries.data]);

  if (!orgId) return <NoWorkspaceState />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Weekly ranked shortlists. Review, calibrate, and record outcomes.
        </p>
      </header>

      {/* Upcoming schedule */}
      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <CalendarClock className="h-4 w-4 text-primary" /> Upcoming deliveries
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(schedule.data?.schedule ?? []).map((s, i) => (
            <div key={s.scheduled_at} className="rounded-md border bg-background p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {i === 0 ? "Next" : `Week +${i}`}
              </div>
              <div className="font-medium">{fmtDate(s.scheduled_at)}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(s.scheduled_at).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Cadence: weekly. Times shown in your local timezone.
        </p>
      </section>

      {/* Trend */}
      {trend && trend.length > 1 && (
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" /> Recent delivery trend
          </div>
          <div className="flex items-end gap-2">
            {trend.map(([wk, g]) => {
              const max = Math.max(...trend.map(([, x]) => x.total), 1);
              const h = Math.max(8, (g.total / max) * 96);
              return (
                <div key={wk} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-primary/70" style={{ height: h }} />
                  <div className="text-[10px] text-muted-foreground">{wk.slice(-3)}</div>
                  <div className="text-[10px] font-medium">{g.total}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Height = candidates delivered. Real data from your workspace — no sample metrics.
          </p>
        </section>
      )}

      {/* Deliveries list */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Delivery history</h2>
        {deliveries.isLoading ? (
          <SkeletonCards cards={3} />
        ) : deliveries.isError ? (
          <ErrorState
            title="We couldn't load your deliveries"
            onRetry={() => void deliveries.refetch()}
          />
        ) : (deliveries.data?.deliveries ?? []).length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No deliveries yet"
            description="Your recruiter publishes a ranked shortlist here each week."
            whatAppearsHere="Each delivery lists the candidates released to you, why they were shortlisted, and where you can leave calibration feedback."
            action={{ label: "See your roles", to: "/client/positions" }}
            secondaryAction={{ label: "Ask your recruiter", to: "/client/conversations" }}
          />
        ) : (
          <ul className="space-y-3">
            {(deliveries.data?.deliveries ?? []).map((d, i) => (
              <DeliveryCard
                key={d.key}
                delivery={d}
                orgId={orgId}
                index={i + 1}
                total={(deliveries.data?.deliveries ?? []).length}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DeliveryCard({
  delivery: d,
  orgId,
  index,
  total,
}: {
  delivery: DeliveryRow;
  orgId: string;
  index: number;
  total: number;
}) {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitDeliveryFeedback);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [outcome, setOutcome] = useState<"approved" | "calibrate" | "changes_requested">("approved");

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          organization_id: orgId,
          match_ids: d.match_ids,
          feedback: feedback.trim(),
          outcome,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      setFeedback("");
      qc.invalidateQueries({ queryKey: ["client", "deliveries", orgId] });
    },
  });

  const number = total - index + 1;

  return (
    <li className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Delivery #{number} · {d.iso_week}
          </div>
          <div className="mt-0.5 truncate text-base font-semibold">
            {d.position_title ?? "Untitled role"}
          </div>
          <div className="text-xs text-muted-foreground">
            {fmtDate(d.week_start)} – {fmtDate(d.week_end)}
          </div>
        </div>
        <Link
          to="/client/candidates"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open shortlist →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Candidates" value={d.candidate_count} icon={<Users className="h-3 w-3" />} />
        <Stat label="New" value={d.new_count} />
        <Stat label="Refreshed" value={d.refreshed_count} />
        <Stat label="Latest" value={fmtDateTime(d.latest)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <BandChip color="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" label="High ≥80" n={d.band_high} />
        <BandChip color="bg-amber-500/15 text-amber-700 dark:text-amber-400" label="Mid 60-79" n={d.band_mid} />
        <BandChip color="bg-muted text-muted-foreground" label="Below 60" n={d.band_low} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Review & submit feedback
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delivery review — {d.position_title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Outcome</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved calibration</SelectItem>
                    <SelectItem value="calibrate">Needs calibration</SelectItem>
                    <SelectItem value="changes_requested">Changes requested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Batch-level feedback</Label>
                <Textarea
                  rows={5}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g. Strong on domain; too senior on titles. Please widen to industry-adjacent for next refresh."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Feedback is recorded against every candidate in this batch and surfaces in the
                recruiter workflow immediately.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={submit.isPending || !feedback.trim()}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? "Sending…" : "Submit feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </li>
  );
}

function Stat({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function BandChip({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${color}`}>
      {label}: {n}
    </span>
  );
}
