/**
 * Client decision backlog — candidates submitted with no client decision.
 *
 * Everything shown comes from candidate_matches + client_decisions. Nudges are
 * rate limited server-side (one per candidate per 48h) and offline decisions
 * are always labelled as recorded by staff.
 */
import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  getDecisionBacklog,
  logOfflineClientDecision,
  nudgeClientDecision,
} from "@/lib/admin-decision-backlog.functions";
import { OFFLINE_DECISION_LABEL } from "@/lib/admin-decision-backlog";
import { OpenThreadButton } from "@/components/comms/open-thread-button";
import { Button } from "@/components/ui/button";
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
import { AlertTriangle, BellRing, Loader2, RefreshCw } from "lucide-react";
import { TestScopeEmptyNote } from "@/components/admin/test-records-toggle";
import { useScopedIncludeTest } from "@/lib/admin-scope";
import { useConfirmAction } from "@/components/ds/confirm-action";
import { CLIENT_COPY } from "@/lib/events";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

type Backlog = Awaited<ReturnType<typeof getDecisionBacklog>>;
type Row = Backlog["rows"][number];

const DECISIONS = Object.entries(OFFLINE_DECISION_LABEL) as Array<[string, string]>;

/** The exact client-facing copy a nudge delivers (CLIENT_COPY.approval_needed). */
const NUDGE_COPY = CLIENT_COPY["approval_needed"] ?? {
  title: "Something is waiting on you",
  body: "A decision is needed before work continues.",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE });
}

export function DecisionBacklogPanel({
  organizationId,
  includeTest: explicit,
  showClientColumn = false,
  className,
}: {
  organizationId?: string;
  includeTest?: boolean;
  showClientColumn?: boolean;
  className?: string;
}) {
  const includeTest = useScopedIncludeTest(explicit);
  const qc = useQueryClient();
  const queryKey = ["admin", "decision-backlog", organizationId ?? "all", includeTest] as const;
  const query = useQuery<Backlog>({
    queryKey,
    queryFn: () =>
      getDecisionBacklog({
        data: {
          ...(organizationId ? { organization_id: organizationId } : {}),
          include_test: includeTest,
        },
      }),
    staleTime: 30_000,
  });

  const nudgeFn = useServerFn(nudgeClientDecision);
  const logFn = useServerFn(logOfflineClientDecision);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmAction();

  const nudge = useMutation({
    mutationFn: (matchId: string) => nudgeFn({ data: { match_id: matchId } }),
    onSuccess: () => {
      toast.success("Follow-up sent to the client");
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e) => toastError(e, { fallback: "Could not send the follow-up" }),
  });

  /**
   * Nudge leaves the building the moment it is clicked, so it asks first and
   * shows the recipient plus the exact message. Cancel is the safe default.
   */
  async function confirmNudge(r: Row) {
    const recipients =
      r.notified.length > 0
        ? r.notified.map((n) => n.name).join(", ")
        : "everyone on the client team with decision notifications on";
    const result = await confirm({
      title: "Send a follow-up to the client",
      object: `${recipients} · ${r.client_name}`,
      description: `They are asked again to decide on ${r.candidate_name} for ${r.position_title}. This is a real notification, sent immediately.`,
      impact: [
        `Message title: “${NUDGE_COPY.title}”`,
        `Message body: “${NUDGE_COPY.body ?? ""}”`,
        "Links to the candidate in the client workspace",
        "Only one follow-up per candidate every 48 hours",
      ],
      confirmLabel: "Send follow-up",
    });
    if (result.confirmed) nudge.mutate(r.match_id);
  }


  const record = useMutation({
    mutationFn: (input: {
      match_id: string;
      decision: string;
      note: string;
      received_from: string;
    }) => logFn({ data: input as never }),
    onSuccess: () => {
      toast.success("Decision recorded on the client's behalf");
      setOpenFor(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (e) => toastError(e, { fallback: "Could not record the decision" }),
  });

  const rows = query.data?.rows ?? [];

  return (
    <section
      className={`rounded-lg border bg-card ${className ?? ""}`}
      aria-labelledby="decision-backlog-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="decision-backlog-heading" className="text-sm font-semibold">
            Awaiting client decision
          </h2>
          <p className="text-xs text-muted-foreground">
            Candidates submitted to the client with no decision recorded yet. Follow-ups are limited
            to one per candidate every 48 hours.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh decision backlog"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      {query.isPending ? (
        <div className="divide-y" aria-busy="true" aria-label="Loading decision backlog">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-44 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">
                Decision backlog could not be loaded
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {query.error instanceof Error ? query.error.message : "Unknown error"}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 h-7 text-xs"
                onClick={() => query.refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium">
            {organizationId
              ? "No candidates waiting on this client"
              : "No candidates waiting on a client decision"}
          </p>
          {/* TestScopeEmptyNote renders its own <p>, so it stays a sibling. */}
          <TestScopeEmptyNote />
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted candidates appear here until a decision is recorded.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Candidate
                </th>
                {showClientColumn ? (
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Client
                  </th>
                ) : null}
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Position
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Waiting
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Notified
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Last follow-up
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r: Row) => (
                <Fragment key={r.match_id}>
                  <tr className="hover:bg-muted/40">
                    <td className="max-w-[16rem] px-3 py-2">
                      <Link
                        to="/admin/candidates/$id"
                        params={{ id: r.match_id }}
                        className="block truncate font-medium hover:underline"
                      >
                        {r.candidate_name}
                      </Link>
                      <span className="text-[11px] text-muted-foreground">
                        Submitted {fmt(r.submitted_at)}
                      </span>
                    </td>
                    {showClientColumn ? (
                      <td className="max-w-[12rem] px-3 py-2">
                        <Link
                          to="/admin/clients/$id"
                          params={{ id: r.organization_id }}
                          className="block truncate hover:underline"
                        >
                          {r.client_name}
                        </Link>
                      </td>
                    ) : null}
                    <td className="max-w-[14rem] px-3 py-2">
                      <Link
                        to="/admin/positions/$id"
                        params={{ id: r.position_id }}
                        className="block truncate hover:underline"
                      >
                        {r.position_title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.days_waiting}d</td>
                    <td className="max-w-[14rem] px-3 py-2 text-xs text-muted-foreground">
                      {r.notified.length === 0
                        ? "No client notification recorded"
                        : r.notified.map((n) => n.name).join(", ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.last_nudge_at ? (
                        <>
                          {fmt(r.last_nudge_at)}
                          {r.last_nudge_by ? ` · ${r.last_nudge_by}` : ""}
                        </>
                      ) : (
                        "None sent"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1.5 text-xs"
                          disabled={
                            !r.nudge_allowed || (nudge.isPending && nudge.variables === r.match_id)
                          }
                          title={
                            r.nudge_allowed
                              ? "Send a follow-up through the client's notifications"
                              : `Next follow-up available ${fmt(r.nudge_available_at)}`
                          }
                          onClick={() => void confirmNudge(r)}
                          data-qa-action="nudge-client-decision"
                        >
                          {nudge.isPending && nudge.variables === r.match_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <BellRing className="h-3.5 w-3.5" />
                          )}
                          Nudge
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() =>
                            setOpenFor((prev) => (prev === r.match_id ? null : r.match_id))
                          }
                          aria-expanded={openFor === r.match_id}
                        >
                          Log decision
                        </Button>
                        <OpenThreadButton
                          orgId={r.organization_id}
                          scope="candidate"
                          positionId={r.position_id}
                          candidateMatchId={r.match_id}
                          subject={`${r.candidate_name} — ${r.position_title}`}
                          label="Thread"
                          className="h-7 text-xs"
                        />
                      </div>
                    </td>
                  </tr>
                  {openFor === r.match_id ? (
                    <tr className="bg-muted/30">
                      <td colSpan={showClientColumn ? 7 : 6} className="px-3 py-3">
                        <OfflineDecisionForm
                          busy={record.isPending}
                          onCancel={() => setOpenFor(null)}
                          onSubmit={(values) => record.mutate({ match_id: r.match_id, ...values })}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmDialog}
    </section>
  );
}

function OfflineDecisionForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: { decision: string; note: string; received_from: string }) => void;
}) {
  const [decision, setDecision] = useState<string>("shortlist");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      className="grid gap-3 md:grid-cols-[12rem_14rem_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ decision, note: note.trim(), received_from: receivedFrom.trim() });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="offline-decision" className="text-xs">
          Decision
        </Label>
        <Select value={decision} onValueChange={setDecision}>
          <SelectTrigger id="offline-decision" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DECISIONS.map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="offline-received-from" className="text-xs">
          Received from
        </Label>
        <Input
          id="offline-received-from"
          value={receivedFrom}
          onChange={(e) => setReceivedFrom(e.target.value)}
          placeholder="Name at the client"
          className="h-8 text-xs"
          required
          minLength={2}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="offline-note" className="text-xs">
          How it was given
        </Label>
        <Textarea
          id="offline-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Phone call on 12 Mar — client confirmed shortlist"
          className="min-h-[2rem] text-xs"
          rows={2}
          required
          minLength={3}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-8 text-xs" disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Record
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground md:col-span-4">
        Recorded as staff-entered on the client's behalf — never shown as client-authored.
      </p>
    </form>
  );
}
