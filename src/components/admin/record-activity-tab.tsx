/**
 * The Activity tab shared by the candidate, position and client detail pages.
 *
 * Same shape everywhere: newest first, one page at a time, and every row names
 * the actor, the action, when it happened, and the reason if one was recorded.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ds";
import { getRecordAudit, type AuditEntity } from "@/lib/admin-audit.functions";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
import { humanizeCode } from "@/lib/humanize-codes";

const PAGE_SIZE = 25;

export function RecordActivityTab({
  entity,
  id,
  title = "Activity",
}: {
  entity: AuditEntity;
  id: string;
  title?: string;
}) {
  const [offset, setOffset] = useState(0);
  const load = useServerFn(getRecordAudit);
  const q = useQuery({
    queryKey: ["record-audit", entity, id, offset],
    queryFn: () => load({ data: { entity, id, limit: PAGE_SIZE, offset } }),
    placeholderData: (prev) => prev,
  });


  if (q.isError) {
    return (
      <ErrorState
        title="Couldn't load activity"
        description="The audit trail is unavailable right now. Nothing was changed."
        onRetry={() => void q.refetch()}
      />
    );
  }

  if (!q.data) {
    return (
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const { rows, total, has_more } = q.data;
  const from = total === 0 ? 0 : offset + 1;
  const to = offset + rows.length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <span>{title} — immutable audit trail, newest first.</span>
        <span className="tabular-nums">
          {total === 0 ? "No events" : `${from}–${to} of ${total.toLocaleString()}`}
        </span>
      </div>

      <ul className={`divide-y relative transition-opacity ${q.isFetching && !q.isLoading ? "opacity-50" : ""}`}>
        {q.isFetching && !q.isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-medium">{humanizeCode(r.action)}</div>
              <time
                dateTime={r.created_at}
                className="text-xs text-muted-foreground"
                title={new Date(r.created_at).toISOString()}
              >
                {new Date(r.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
              </time>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {r.actor_name}
              {r.entity_type ? ` · ${humanizeCode(r.entity_type)}` : ""}
              {r.trace_id ? (
                <>
                  {" · trace "}
                  <span className="font-mono">{r.trace_id}</span>
                </>
              ) : null}
            </div>
            {r.reason ? (
              <p className="mt-1.5 rounded-md bg-muted/50 px-2 py-1 text-xs">
                <span className="text-muted-foreground">Reason: </span>
                {r.reason}
              </p>
            ) : null}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            No activity recorded for this record yet.
          </li>
        )}
      </ul>

      {(offset > 0 || has_more) && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0 || q.isFetching}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Newer
          </Button>
          <span className="text-xs text-muted-foreground">
            {q.isFetching ? "Loading…" : null}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!has_more || q.isFetching}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Older
          </Button>
        </div>
      )}
    </div>
  );
}
