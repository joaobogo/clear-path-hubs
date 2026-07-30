import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  HandCoins,
  CalendarClock,
  User2,
  ArrowRight,
  Send,
  Check,
  X,
  Trophy,
  BadgeAlert,
  RotateCcw,
  ClipboardList,
  Handshake,
  BellRing,
  AlertTriangle,
} from "lucide-react";
import {
  listHires,
  transitionHire,
  nudgeOffer,
  assignHireOwner,
  upsertOfferDraft,
  listOfferOwners,
  getTimeToHireReport,
  HIRE_STATUSES,
  HIRE_STATUS_LABEL,
  CLOSE_REASON_LABEL,
  type HireRecordDTO,
  type HireStatus,
  type HireCloseReason,
} from "@/lib/hires.functions";
import { getClientContext } from "@/lib/client.functions";
import {
  isStalled,
  stallLabel,
  byStallDesc,
  stageEnteredAt,
  STALL_HOURS,
} from "@/lib/offer-stall";
import { formatAge } from "@/lib/time-age";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_authenticated/client/offers")({
  head: () => ({
    meta: [
      { title: "Offers & hires · TaaSFlow" },
      {
        name: "description",
        content:
          "Track every offer from draft through hire. Assigned owners, close reasons, and time-to-hire reporting in one board.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.offers.tsx"),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: OffersPage,
});

const COLUMN_ORDER: HireStatus[] = [
  "offer_drafted",
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
  "hire_confirmed",
  "offer_declined",
  "closed_lost",
];

const COLUMN_ICON: Record<HireStatus, React.ComponentType<{ className?: string }>> = {
  offer_drafted: ClipboardList,
  offer_sent: Send,
  offer_negotiating: Handshake,
  offer_accepted: Check,
  offer_declined: X,
  hire_confirmed: Trophy,
  closed_lost: BadgeAlert,
};

const COLUMN_TONE: Record<HireStatus, string> = {
  offer_drafted: "border-slate-300 bg-slate-50 dark:bg-slate-900/40",
  offer_sent: "border-blue-300/60 bg-blue-50/60 dark:bg-blue-950/30",
  offer_negotiating: "border-violet-300/60 bg-violet-50/60 dark:bg-violet-950/30",
  offer_accepted: "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/30",
  offer_declined: "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/30",
  hire_confirmed: "border-primary/40 bg-primary/5",
  closed_lost: "border-rose-300/60 bg-rose-50/60 dark:bg-rose-950/30",
};

function OffersPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listHires);
  const reportFn = useServerFn(getTimeToHireReport);

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const readOnly = ctx?.active?.role === "client_viewer";

  const { data, isPending, refetch } = useQuery({
    queryKey: ["hires", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const { data: report } = useQuery({
    queryKey: ["hires-report", orgId],
    queryFn: () => reportFn({ data: { orgId: orgId!, sinceDays: 180 } }),
    enabled: !!orgId,
  });

  const hires = data?.hires ?? [];
  const byStatus = useMemo(() => {
    const m = new Map<HireStatus, HireRecordDTO[]>();
    for (const s of HIRE_STATUSES) m.set(s, []);
    for (const h of hires) m.get(h.status)?.push(h);
    return m;
  }, [hires]);

  const stalled = useMemo(
    () => hires.filter((h) => isStalled(h)).sort((a, b) => byStallDesc(a, b)),
    [hires],
  );

  if (!orgId) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <HandCoins className="h-6 w-6 text-primary" aria-hidden />
            Offers & hires
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track every offer from draft through signed hire, with owner
            accountability, close reasons, and time-to-hire on one board.
          </p>
        </div>
      </header>

      {/* KPI strip */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Open offers"
          value={report?.totals.open_offers ?? 0}
          hint="Drafted, sent, or accepted"
        />
        <Kpi
          label="Hires confirmed"
          value={report?.totals.hires_confirmed ?? 0}
          hint="Last 180 days"
        />
        <Kpi
          label="Acceptance rate"
          value={
            report?.totals.acceptance_rate == null
              ? "—"
              : `${Math.round(report.totals.acceptance_rate * 100)}%`
          }
          hint="Accepted ÷ decided"
        />
        <Kpi
          label="Avg time to hire"
          value={
            report?.totals.avg_days_to_hire == null
              ? "—"
              : `${Math.round(report.totals.avg_days_to_hire)}d`
          }
          hint={
            report?.totals.median_days_to_hire == null
              ? "Application → signed"
              : `median ${Math.round(report.totals.median_days_to_hire)}d`
          }
        />
      </section>

      {/* Stalled offers */}
      {stalled.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
            {stalled.length} offer{stalled.length === 1 ? "" : "s"} stalled over{" "}
            {STALL_HOURS}h
          </h2>
          <ul className="mt-3 space-y-2">
            {stalled.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/80 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {h.candidate_name}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {h.position_title}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {HIRE_STATUS_LABEL[h.status]} · {stallLabel(h)} · owner{" "}
                    {h.owner_name ?? "unassigned"}
                    {h.nudge_count > 0 &&
                      ` · nudged ${h.nudge_count}× (last ${formatAge(h.last_nudged_at)} ago)`}
                  </p>
                </div>
                {!readOnly && <NudgeButton orgId={orgId} hire={h} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Board */}
      <section className="mt-6 overflow-x-auto">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Loading offers…</p>
        ) : hires.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid min-w-[1100px] grid-cols-6 gap-3">
            {COLUMN_ORDER.map((status) => (
              <Column
                key={status}
                status={status}
                items={byStatus.get(status) ?? []}
                orgId={orgId}
                readOnly={!!readOnly}
                onChanged={() => refetch()}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reporting: by owner + close reasons */}
      {report && report.totals.hires_confirmed + report.totals.closed_lost > 0 && (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Hires by owner</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {report.by_owner.slice(0, 8).map((o) => (
                <li
                  key={o.owner_user_id ?? "unassigned"}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">{o.owner_name}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{o.hires}</strong> hires
                    </span>
                    <span>
                      {o.avg_days_to_hire == null
                        ? "—"
                        : `${Math.round(o.avg_days_to_hire)}d avg`}
                    </span>
                  </span>
                </li>
              ))}
              {report.by_owner.length === 0 && (
                <li className="text-xs text-muted-foreground">No hires yet.</li>
              )}
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Close reasons</h2>
            {report.close_reasons.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No offers declined or closed lost in this window.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {report.close_reasons.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between">
                    <span>{CLOSE_REASON_LABEL[r.reason]}</span>
                    <Badge variant="outline" className="text-xs">
                      {r.count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center">
      <HandCoins className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 font-medium">No offers yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        When you extend an offer to a candidate, draft it here from their profile
        or from a role's candidate list. Everything after shortlist lives on this
        board.
      </p>
    </div>
  );
}

// ─── Board column ───────────────────────────────────────────────────────────

function Column({
  status,
  items,
  orgId,
  readOnly,
  onChanged,
}: {
  status: HireStatus;
  items: HireRecordDTO[];
  orgId: string;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const Icon = COLUMN_ICON[status];
  return (
    <div className={`rounded-xl border p-3 ${COLUMN_TONE[status]}`}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {HIRE_STATUS_LABEL[status]}
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {items.length}
        </Badge>
      </div>
      <ul className="mt-3 space-y-2">
        {items.length === 0 && (
          <li className="rounded-md border border-dashed border-border/60 bg-background/30 p-3 text-[11px] text-muted-foreground">
            Nothing here
          </li>
        )}
        {items.map((h) => (
          <HireCard
            key={h.id}
            hire={h}
            orgId={orgId}
            readOnly={readOnly}
            onChanged={onChanged}
          />
        ))}
      </ul>
    </div>
  );
}

// ─── Card + actions ─────────────────────────────────────────────────────────

const NEXT_STEPS: Record<HireStatus, HireStatus[]> = {
  offer_drafted: ["offer_sent", "closed_lost"],
  offer_sent: ["offer_negotiating", "offer_accepted", "offer_declined", "closed_lost"],
  offer_negotiating: ["offer_accepted", "offer_sent", "offer_declined", "closed_lost"],
  offer_accepted: ["hire_confirmed", "closed_lost"],
  offer_declined: ["offer_drafted", "closed_lost"],
  hire_confirmed: ["closed_lost"],
  closed_lost: ["offer_drafted"],
};

function HireCard({
  hire,
  orgId,
  readOnly,
  onChanged,
}: {
  hire: HireRecordDTO;
  orgId: string;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState<null | HireStatus>(null);
  const qc = useQueryClient();
  const transitionFn = useServerFn(transitionHire);

  const doTransition = useMutation({
    mutationFn: (to: HireStatus) =>
      transitionFn({ data: { orgId, id: hire.id, to } }),
    onSuccess: (_r, to) => {
      toast.success(`Moved to ${HIRE_STATUS_LABEL[to]}`);
      qc.invalidateQueries({ queryKey: ["hires", orgId] });
      qc.invalidateQueries({ queryKey: ["hires-report", orgId] });
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salary =
    hire.salary_amount != null
      ? `${hire.salary_currency ?? ""} ${new Intl.NumberFormat().format(
          hire.salary_amount,
        )}${hire.salary_period ? `/${hire.salary_period}` : ""}`.trim()
      : null;

  return (
    <li className="rounded-lg border bg-background/80 p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{hire.candidate_name}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {hire.position_title}
          </p>
        </div>
      </div>

      {isStalled(hire) && (
        <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertTriangle className="h-3 w-3" /> {stallLabel(hire)}
        </p>
      )}

      <dl className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <div className="flex justify-between">
          <dt>Comp</dt>
          <dd className={salary ? "text-foreground" : "italic"}>
            {salary ?? "not on record"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>{HIRE_STATUS_LABEL[hire.status]}</dt>
          <dd className="text-foreground">
            {stageEnteredAt(hire)
              ? new Date(stageEnteredAt(hire)!).toLocaleDateString()
              : "—"}
          </dd>
        </div>
        {hire.start_date && (
          <div className="flex items-center justify-between">
            <dt className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" /> Start
            </dt>
            <dd className="text-foreground">
              {new Date(hire.start_date).toLocaleDateString()}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="inline-flex items-center gap-1">
            <User2 className="h-3 w-3" /> Owner
          </dt>
          <dd className="truncate text-foreground">
            {hire.owner_name ?? "Unassigned"}
          </dd>
        </div>
      </dl>

      {hire.close_reason && (
        <div className="mt-2 rounded border border-dashed border-border/70 bg-muted/40 px-2 py-1 text-[11px]">
          <strong className="text-foreground">
            {CLOSE_REASON_LABEL[hire.close_reason]}
          </strong>
          {hire.close_reason_notes && (
            <p className="mt-0.5 line-clamp-2 text-muted-foreground">
              {hire.close_reason_notes}
            </p>
          )}
        </div>
      )}

      {!readOnly && isStalled(hire) && (
        <div className="mt-2">
          <NudgeButton orgId={orgId} hire={hire} />
        </div>
      )}

      {!readOnly && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => setEditOpen(true)}
          >
            Edit terms
          </Button>
          {NEXT_STEPS[hire.status].map((to) => {
            const needsReason = to === "offer_declined" || to === "closed_lost";
            const label =
              to === "hire_confirmed"
                ? "Confirm hire"
                : to === "offer_sent"
                  ? "Send offer"
                  : to === "offer_accepted"
                    ? "Accepted"
                    : to === "offer_declined"
                      ? "Declined"
                      : to === "closed_lost"
                        ? "Close lost"
                        : "Redraft";
            return (
              <Button
                key={to}
                size="sm"
                variant={to === "hire_confirmed" ? "default" : "outline"}
                className="h-6 gap-1 px-2 text-[11px]"
                disabled={doTransition.isPending}
                onClick={() =>
                  needsReason ? setCloseOpen(to) : doTransition.mutate(to)
                }
              >
                {to === "offer_drafted" && hire.status !== "offer_drafted" ? (
                  <RotateCcw className="h-3 w-3" />
                ) : (
                  <ArrowRight className="h-3 w-3" />
                )}
                {label}
              </Button>
            );
          })}
        </div>
      )}

      {editOpen && (
        <OfferTermsDialog
          hire={hire}
          orgId={orgId}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["hires", orgId] });
            onChanged();
          }}
        />
      )}
      {closeOpen && (
        <CloseReasonDialog
          orgId={orgId}
          hireId={hire.id}
          target={closeOpen}
          onClose={() => setCloseOpen(null)}
          onSaved={() => {
            setCloseOpen(null);
            qc.invalidateQueries({ queryKey: ["hires", orgId] });
            qc.invalidateQueries({ queryKey: ["hires-report", orgId] });
            onChanged();
          }}
        />
      )}
    </li>
  );
}

// ─── Dialogs ────────────────────────────────────────────────────────────────

function OfferTermsDialog({
  hire,
  orgId,
  onClose,
  onSaved,
}: {
  hire: HireRecordDTO;
  orgId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(upsertOfferDraft);
  const assignFn = useServerFn(assignHireOwner);
  const ownersFn = useServerFn(listOfferOwners);

  const [salaryAmount, setSalaryAmount] = useState(
    hire.salary_amount != null ? String(hire.salary_amount) : "",
  );
  const [salaryCurrency, setSalaryCurrency] = useState(hire.salary_currency ?? "EUR");
  const [salaryPeriod, setSalaryPeriod] = useState<string>(hire.salary_period ?? "year");
  const [startDate, setStartDate] = useState(hire.start_date ?? "");
  const [employmentType, setEmploymentType] = useState(hire.employment_type ?? "");
  const [workModel, setWorkModel] = useState(hire.work_model ?? "");
  const [location, setLocation] = useState(hire.location ?? "");
  const [notes, setNotes] = useState(hire.offer_notes ?? "");
  const [guaranteeDays, setGuaranteeDays] = useState(
    hire.guarantee_days != null ? String(hire.guarantee_days) : "",
  );
  const [guaranteeStartsOn, setGuaranteeStartsOn] = useState(hire.guarantee_starts_on ?? "");
  const [guaranteeTerms, setGuaranteeTerms] = useState(hire.guarantee_terms ?? "");
  const [guaranteeVisible, setGuaranteeVisible] = useState(
    hire.guarantee_visible_to_client !== false,
  );
  const [owner, setOwner] = useState<string>(hire.owner_user_id ?? "__unassigned__");

  const { data: ownersData } = useQuery({
    queryKey: ["hire-owners", orgId],
    queryFn: () => ownersFn({ data: { orgId } }),
  });

  const save = useMutation({
    mutationFn: async () => {
      await updateFn({
        data: {
          orgId,
          matchId: hire.candidate_match_id,
          terms: {
            salary_amount: salaryAmount ? Number(salaryAmount) : null,
            salary_currency: salaryCurrency || null,
            salary_period:
              (salaryPeriod as "year" | "month" | "hour") || null,
            start_date: startDate || null,
            employment_type: employmentType || null,
            work_model: workModel || null,
            location: location || null,
            offer_notes: notes || null,
            guarantee_days: guaranteeDays ? Number(guaranteeDays) : null,
            guarantee_starts_on: guaranteeStartsOn || null,
            guarantee_terms: guaranteeTerms || null,
            guarantee_visible_to_client: guaranteeVisible,
          },
        },
      });
      await assignFn({
        data: {
          orgId,
          id: hire.id,
          owner_user_id: owner === "__unassigned__" ? null : owner,
        },
      });
    },
    onSuccess: () => {
      toast.success("Offer terms saved");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Offer terms — {hire.candidate_name}</DialogTitle>
          <DialogDescription>{hire.position_title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Compensation">
            <div className="flex gap-1">
              <Input
                type="number"
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                placeholder="e.g. 90000"
              />
              <Input
                className="w-16"
                value={salaryCurrency}
                onChange={(e) => setSalaryCurrency(e.target.value.toUpperCase())}
                placeholder="EUR"
              />
              <Select value={salaryPeriod} onValueChange={setSalaryPeriod}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">/yr</SelectItem>
                  <SelectItem value="month">/mo</SelectItem>
                  <SelectItem value="hour">/hr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Employment type">
            <Input
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              placeholder="Full-time, contract, …"
            />
          </Field>
          <Field label="Work model">
            <Input
              value={workModel}
              onChange={(e) => setWorkModel(e.target.value)}
              placeholder="Remote, hybrid, on-site"
            />
          </Field>
          <Field label="Location">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Berlin, EU-remote, …"
            />
          </Field>
          <Field label="Owner">
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger><SelectValue placeholder="Assign owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {(ownersData?.owners ?? []).map((o) => (
                  <SelectItem key={o.user_id} value={o.user_id}>
                    {o.name} · {o.role.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bonus, equity, contingencies, negotiation history…"
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseReasonDialog({
  orgId,
  hireId,
  target,
  onClose,
  onSaved,
}: {
  orgId: string;
  hireId: string;
  target: HireStatus;
  onClose: () => void;
  onSaved: () => void;
}) {
  const transitionFn = useServerFn(transitionHire);
  const [reason, setReason] = useState<HireCloseReason>("candidate_declined");
  const [notes, setNotes] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      transitionFn({
        data: {
          orgId,
          id: hireId,
          to: target,
          close_reason: reason,
          close_reason_notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Marked as ${HIRE_STATUS_LABEL[target]}`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target === "offer_declined" ? "Record decline" : "Close lost"}
          </DialogTitle>
          <DialogDescription>
            Capture why this offer didn&apos;t land — it feeds the close-reason
            report and future rediscovery.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Reason">
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as HireCloseReason)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CLOSE_REASON_LABEL) as HireCloseReason[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CLOSE_REASON_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes (optional)">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Counter offer at €X, timing mismatch on start date, …"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ─── Nudge action ───────────────────────────────────────────────────────────

function NudgeButton({ orgId, hire }: { orgId: string; hire: HireRecordDTO }) {
  const qc = useQueryClient();
  const nudgeFn = useServerFn(nudgeOffer);
  const nudge = useMutation({
    mutationFn: () => nudgeFn({ data: { orgId, id: hire.id } }),
    onSuccess: () => {
      toast.success(`Nudge sent to ${hire.owner_name ?? "the offer owner"}`, {
        description: "We'll chase the candidate and update this record.",
      });
      qc.invalidateQueries({ queryKey: ["hires", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 gap-1 text-[11px]"
      disabled={nudge.isPending}
      onClick={() => nudge.mutate()}
    >
      <BellRing className="h-3 w-3" />
      {nudge.isPending ? "Nudging…" : "Nudge"}
    </Button>
  );
}
