import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ClipboardList, MessageSquareDashed, Clock } from "lucide-react";
import { getClientOpenItems } from "@/lib/client/open-items.functions";
import { withQueryTimeout } from "@/lib/client/query-timeout";
import { countByKind, dueLabel, type OpenItem, type OpenItemKind } from "@/lib/client/open-items";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ICON: Record<OpenItemKind, typeof ClipboardList> = {
  info_request: ClipboardList,
  pending_decision: Clock,
  missing_feedback: MessageSquareDashed,
  offer: ClipboardList,
  interview: Clock,
};

/**
 * One strip showing everything the client still owes us: unanswered questions,
 * candidates waiting on a decision, and interviews with no feedback recorded.
 * Overdue work sits at the top, with its due date stated plainly.
 */
export function OpenItemsStrip({ orgId }: { orgId: string | null | undefined }) {
  const fn = useServerFn(getClientOpenItems);
  const [expanded, setExpanded] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["client-open-items", orgId],
    queryFn: () => withQueryTimeout(fn({ data: { orgId: orgId! } })),
    enabled: !!orgId,
  });

  const items: OpenItem[] = data?.items ?? [];
  const counts = useMemo(() => countByKind(items), [items]);
  const overdue = items.filter((i) => i.overdue).length;

  if (isError || items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, 4);

  return (
    <Card className="border-border/70">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Your open items</h2>
            {overdue > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {overdue} overdue
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {counts.info_request} question{counts.info_request === 1 ? "" : "s"} ·{" "}
            {counts.pending_decision} decision{counts.pending_decision === 1 ? "" : "s"} ·{" "}
            {counts.missing_feedback} feedback
          </div>
        </div>

        <ul className="divide-y divide-border/60">
          {visible.map((item) => {
            const Icon = ICON[item.kind];
            const due = dueLabel(item);
            return (
              <li key={`${item.kind}:${item.id}`} className="py-2">
                <Link
                  to={item.href}
                  className="flex items-start gap-3 rounded-md px-1 py-1 hover:bg-muted/50"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.label}</span>
                    {item.context && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.context}
                      </span>
                    )}
                  </span>
                  {due && (
                    <span
                      className={
                        item.overdue
                          ? "shrink-0 text-xs font-medium text-[color:var(--brand-danger)]"
                          : "shrink-0 text-xs text-muted-foreground"
                      }
                    >
                      {due}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {items.length > 4 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : `Show all ${items.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
