import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import type { DerivedApproval } from "@/lib/client/derived-approvals";

/**
 * A workspace action that is derived from pipeline state rather than stored as
 * a task. It cannot be reassigned or ticked off here: it clears when the
 * underlying step is done, so the only control is the link to that step.
 */
export function DerivedApprovalRow({ item }: { item: DerivedApproval }) {
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{item.title}</span>
            <Badge variant="outline">{item.type_label}</Badge>
            {item.overdue && <Badge variant="destructive">Overdue</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate">{item.role_title}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {item.due_label}
            </span>
            {item.days_waiting != null && (
              <span>
                Waiting {item.days_waiting} day{item.days_waiting === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to={item.to}>{item.action}</Link>
        </Button>
      </div>
    </li>
  );
}
