import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { History as HistoryIcon, Link2, Filter, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCandidateHistory } from "@/lib/candidate-history.functions";
import { PanelState } from "@/components/admin/panel-state";
import {
  HISTORY_PAGE_SIZE,
  SOURCE_LABEL,
  SOURCE_TABLE,
  actionOptions,
  actorLabel,
  actorOptions,
  matchesFilter,
  normalizeFocusEventId,
  normalizeHistoryEvents,
  permalinkFor,
  type HistoryEvent,
  type HistorySource,
} from "@/lib/candidate-history";

const SOURCE_TONE: Record<HistorySource, string> = {
  audit_event: "bg-muted text-muted-foreground",
  stage_history: "bg-info/15 text-info",
  score_decision: "bg-primary/10 text-primary",
  evidence_override: "bg-warning/15 text-warning-foreground",
  client_decision: "bg-success/15 text-success",
};

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? iso : d.toLocaleString();
}

export function CandidateHistoryTimeline({
  matchId,
  focusEventId,
}: {
  matchId: string;
  focusEventId?: string | null;
}) {
  const fetchHistory = useServerFn(getCandidateHistory);
  const query = useQuery({
    queryKey: ["candidate-history", matchId],
    queryFn: () => fetchHistory({ data: { match_id: matchId } }),
  });

  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [visible, setVisible] = useState(HISTORY_PAGE_SIZE);

  // One malformed row must never blank the record page: every entry is
  // repaired (and flagged) before anything reads its fields.
  const events = useMemo(
    () => normalizeHistoryEvents(query.data?.events),
    [query.data?.events],
  );
  const focusId = normalizeFocusEventId(focusEventId);
  const actors = useMemo(() => actorOptions(events), [events]);
  const actions = useMemo(() => actionOptions(events), [events]);
  const filtered = useMemo(
    () => events.filter((e) => matchesFilter(e, { actor, action })),
    [events, actor, action],
  );

  const focused = focusId ? (events.find((e) => e.id === focusId) ?? null) : null;
  const shown = filtered.slice(0, visible);

  const copyPermalink = async (event: HistoryEvent) => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const url = permalinkFor(matchId, event.id, origin);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Permalink copied");
    } catch {
      toast.error(`Copy failed — ${url}`);
    }
  };


  return (
    <PanelState query={query} skeletonRows={5}>
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <HistoryIcon className="h-3.5 w-3.5" />
            History — {query.data?.candidate_name}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            Read-only record
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="history-actor" className="text-[11px] text-muted-foreground">
              Actor
            </Label>
            <Select
              value={actor}
              onValueChange={(v) => {
                setActor(v);
                setVisible(HISTORY_PAGE_SIZE);
              }}
            >
              <SelectTrigger id="history-actor" className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="All actors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {actors.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="history-action" className="text-[11px] text-muted-foreground">
              Action type
            </Label>
            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v);
                setVisible(HISTORY_PAGE_SIZE);
              }}
            >
              <SelectTrigger id="history-action" className="h-8 w-[280px] text-xs">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(actor !== "all" || action !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setActor("all");
                setAction("all");
                setVisible(HISTORY_PAGE_SIZE);
              }}
            >
              <Filter className="mr-1 h-3 w-3" />
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-[11px] text-muted-foreground">
            {filtered.length} of {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>

        {focusId && (
          <div className="border-b bg-muted/40 px-4 py-2 text-xs">
            {focused ? (
              <>
                Linked event: <strong>{focused.action_label}</strong> · {when(focused.at)}
                {!filtered.some((e) => e.id === focused.id) && (
                  <span className="ml-1 text-muted-foreground">
                    (hidden by the current filters)
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">
                Linked event is not part of this candidate&apos;s recorded history.
              </span>
            )}
          </div>
        )}

        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No recorded activity for this candidate
          </p>
        ) : shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No events match these filters.
          </p>
        ) : (
          <ol className="divide-y">
            {shown.map((e) => {
              const isFocus = e.id === focusId;
              return (
                <li
                  key={e.id}
                  id={`event-${e.id}`}
                  className={
                    "px-4 py-3 " + (isFocus ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : "")
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={"text-[10px] " + (SOURCE_TONE[e.source] ?? "bg-muted text-muted-foreground")}
                      variant="secondary"
                    >
                      {SOURCE_LABEL[e.source] ?? "Recorded event"}
                    </Badge>
                    {e.malformed && (
                      <Badge variant="outline" className="text-[10px]" title="This entry was recorded with missing fields.">
                        Incomplete entry
                      </Badge>
                    )}
                    <span className="text-sm font-medium">{e.action_label}</span>
                    <span className="text-xs text-muted-foreground">{when(e.at)}</span>
                    <span className="text-xs text-muted-foreground">
                      · {actorLabel(e)}
                      {e.actor_role ? ` (${e.actor_role})` : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-7 px-2 text-[11px]"
                      onClick={() => void copyPermalink(e)}
                      aria-label={`Copy permalink to ${e.action_label}`}
                    >
                      <Link2 className="mr-1 h-3 w-3" />
                      Permalink
                    </Button>
                  </div>

                  {(e.changes ?? []).length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {(e.changes ?? []).map((c) => (
                        <li key={c.field} className="flex flex-wrap gap-1">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {c.field}
                          </span>
                          <span className="text-muted-foreground line-through">
                            {c.before ?? "—"}
                          </span>
                          <span aria-hidden>→</span>
                          <span className="font-medium">{c.after ?? "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {e.reason && (
                    <p className="mt-2 rounded-md border-l-2 border-muted bg-muted/30 px-2 py-1 text-xs">
                      {e.reason}
                    </p>
                  )}

                  {(e.context ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {(e.context ?? []).map((c) => (
                        <span key={c.field} className="font-mono">
                          {c.field}: {c.after}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {SOURCE_TABLE[e.source] ?? "audit_events"}
                    {e.trace_id ? ` · trace ${e.trace_id}` : ""}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {shown.length < filtered.length && (
          <div className="border-t px-4 py-3 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisible((v) => v + HISTORY_PAGE_SIZE)}
            >
              Show {Math.min(HISTORY_PAGE_SIZE, filtered.length - shown.length)} older
            </Button>
          </div>
        )}

        {query.data?.truncated && (
          <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
            Only the most recent events per source are shown. Older rows remain in the database.
          </p>
        )}
      </div>
    </div>
    </PanelState>
  );
}