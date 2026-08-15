/**
 * Intake aging and conversion tracker.
 *
 * Age comes from the intake's submitted timestamp. Conversion is detected by an
 * existing linked position, so a converted intake drops out of this list on the
 * next read — there is no manual "converted" flag. No scores, no forecasts.
 */
import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  assignIntakeOwner,
  getIntakeAging,
  setIntakeProceeding,
} from "@/lib/admin-intake-aging.functions";
import { listPositionOwnerOptions } from "@/lib/admin-attention.functions";
import { convertIntakeToPosition } from "@/lib/intake-admin.functions";
import {
  INTAKE_AGING_TIER_DAYS,
  type IntakeAgingFilter,
  type IntakeAgingTier,
} from "@/lib/intake-aging";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Loader2, RefreshCw, Undo2 } from "lucide-react";
import { TestScopeEmptyNote } from "@/components/admin/test-records-toggle";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { useScopedIncludeTest } from "@/lib/admin-scope";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

type AgingTable = Awaited<ReturnType<typeof getIntakeAging>>;
type Row = AgingTable["rows"][number];

const UNASSIGNED = "__none__";

const FILTERS: { key: IntakeAgingFilter; label: string }[] = [
  { key: "all", label: "All open" },
  { key: "watch", label: `${INTAKE_AGING_TIER_DAYS.watch}d+` },
  { key: "late", label: `${INTAKE_AGING_TIER_DAYS.late}d+` },
  { key: "critical", label: `${INTAKE_AGING_TIER_DAYS.critical}d+` },
];

function tierClass(tier: IntakeAgingTier): string {
  switch (tier) {
    case "critical":
      return "bg-destructive/10 text-destructive";
    case "late":
      return "bg-warning/15 text-warning-foreground";
    case "watch":
      return "bg-muted text-foreground";
    default:
      return "text-muted-foreground";
  }
}

function ageLabel(days: number): string {
  if (days === 0) return "today";
  return days === 1 ? "1 day" : `${days} days`;
}

export function IntakeAgingTable({ includeTest: explicit }: { includeTest?: boolean } = {}) {
  const includeTest = useScopedIncludeTest(explicit);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<IntakeAgingFilter>("all");
  const [showClosed, setShowClosed] = useState(false);
  const [closeFor, setCloseFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const queryKey = ["admin", "intake-aging", { filter, includeTest, showClosed }] as const;
  const query = useQuery<AgingTable>({
    queryKey,
    queryFn: () =>
      getIntakeAging({
        data: { filter, include_test: includeTest, include_closed: showClosed },
      }),
    staleTime: 30_000,
  });

  const owners = useQuery({
    queryKey: ["admin", "position-owner-options"],
    queryFn: () => listPositionOwnerOptions(),
    staleTime: 300_000,
  });

  const assignFn = useServerFn(assignIntakeOwner);
  const proceedFn = useServerFn(setIntakeProceeding);
  const convertFn = useServerFn(convertIntakeToPosition);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "intake-aging"] });
    void qc.invalidateQueries({ queryKey: ["admin", "intake-inbox"] });
  };

  const assign = useMutation({
    mutationFn: (input: { intake_id: string; owner_user_id: string | null }) =>
      assignFn({ data: input }),
    onSuccess: () => {
      toast.success("Owner updated");
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not assign the owner" }),
  });

  const proceeding = useMutation({
    mutationFn: (input: { intake_id: string; proceeding: boolean; reason?: string }) =>
      proceedFn({ data: input }),
    onSuccess: (_r, vars) => {
      toast.success(vars.proceeding ? "Intake reopened" : "Marked as not proceeding");
      setCloseFor(null);
      setReason("");
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not update the intake" }),
  });

  const convert = useMutation({
    mutationFn: (id: string) => convertFn({ data: { id } }),
    onSuccess: (res) => {
      toast.success(
        res.idempotent ? "This intake was already converted" : "Converted to a position",
      );
      invalidate();
    },
    onError: (e) => toastError(e, { fallback: "Could not convert the intake" }),
  });

  const rows = query.data?.rows ?? [];
  const counts = query.data?.counts;

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="intake-aging-heading">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="intake-aging-heading" className="text-sm font-semibold">
            Open intakes — aging and conversion
          </h2>
          <p className="text-xs text-muted-foreground">
            Time on the clock since submission. An intake leaves this list as soon as it is linked to
            a position.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {counts && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {counts.open} open · {counts.late} over {INTAKE_AGING_TIER_DAYS.late}d ·{" "}
              {counts.critical} over {INTAKE_AGING_TIER_DAYS.critical}d
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh intake aging"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setFilter(f.key);
              setShowClosed(false);
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              !showClosed && filter === f.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setShowClosed((v) => !v)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            showClosed
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Not proceeding{counts ? ` (${counts.not_proceeding})` : ""}
        </button>
      </div>

      <PanelState
        query={query}
        isEmpty={rows.length === 0}
        empty={
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            <PanelEmpty title={showClosed ? "Nothing marked as not proceeding" : "No open intakes"} />
            <TestScopeEmptyNote />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr className="whitespace-nowrap">
                <th className="px-4 py-2">Company / role</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Waiting</th>
                <th className="hidden px-3 py-2 lg:table-cell">Contact</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Blocking</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row: Row) => {
                const closed = row.lead_status === "closed";
                return (
                  <Fragment key={row.id}>
                    <tr className="align-top hover:bg-muted/30">
                      <td className="min-w-[14rem] px-4 py-3">
                        <Link
                          to="/admin/intake/$id"
                          params={{ id: row.id }}
                          className="font-medium hover:underline"
                        >
                          {row.company_name ?? row.organization_name ?? "Unnamed company"}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {row.role_title ?? "No role title"}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-muted-foreground">
                        {new Date(row.submitted_at).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium tabular-nums whitespace-nowrap ${tierClass(row.tier)}`}
                        >
                          {ageLabel(row.days_waiting)}
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 text-xs text-muted-foreground lg:table-cell">
                        {row.contact_email ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          value={row.owner_user_id ?? UNASSIGNED}
                          onValueChange={(v) =>
                            assign.mutate({
                              intake_id: row.id,
                              owner_user_id: v === UNASSIGNED ? null : v,
                            })
                          }
                          disabled={assign.isPending || closed}
                        >
                          <SelectTrigger className="h-8 w-[170px] text-xs">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                            {(owners.data ?? []).map((o) => (
                              <SelectItem key={o.user_id} value={o.user_id}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="min-w-[10rem] px-3 py-3 text-xs">
                        {closed ? (
                          <span className="text-muted-foreground whitespace-nowrap">
                            Not proceeding
                            {row.close_reason ? ` — ${row.close_reason}` : ""}
                          </span>
                        ) : row.blocking_reason ? (
                          <span className="text-warning-foreground whitespace-nowrap">{row.blocking_reason}</span>
                        ) : (
                          <Badge variant="outline" className="whitespace-nowrap">Ready to convert</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                            <Link to="/admin/intake/$id" params={{ id: row.id }}>
                              Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {closed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 px-2 text-xs"
                              onClick={() =>
                                proceeding.mutate({ intake_id: row.id, proceeding: true })
                              }
                              disabled={proceeding.isPending}
                            >
                              <Undo2 className="h-3.5 w-3.5" /> Reopen
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => convert.mutate(row.id)}
                                disabled={convert.isPending || !row.organization_id}
                                title={
                                  row.organization_id
                                    ? "Create the position from this intake"
                                    : "Link a client organization first"
                                }
                              >
                                {convert.isPending && convert.variables === row.id ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                Convert
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => {
                                  setCloseFor(closeFor === row.id ? null : row.id);
                                  setReason("");
                                }}
                              >
                                Not proceeding
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {closeFor === row.id && (
                      <tr className="bg-muted/30">
                        <td colSpan={7} className="px-4 py-3">
                          <label
                            htmlFor={`not-proceeding-${row.id}`}
                            className="text-xs font-medium"
                          >
                            Why is this intake not proceeding? (required)
                          </label>
                          <Textarea
                            id={`not-proceeding-${row.id}`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            className="mt-1.5 text-sm"
                            placeholder="Client paused hiring, budget pulled, duplicate of another brief…"
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              disabled={reason.trim().length < 10 || proceeding.isPending}
                              onClick={() =>
                                proceeding.mutate({
                                  intake_id: row.id,
                                  proceeding: false,
                                  reason: reason.trim(),
                                })
                              }
                            >
                              Mark not proceeding
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setCloseFor(null)}
                            >
                              Cancel
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              Reversible — you can reopen this intake later.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelState>
    </section>
  );
}
