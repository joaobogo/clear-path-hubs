import { actorLabel } from "@/lib/notifications/notification-tiers";
import { humanizeRoleAction } from "@/lib/client/role-audit-humanizer";
import { formatDateTime } from "@/lib/format/datetime";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function ActivitySection({ activity }: { activity: AnyRow[] }) {
  return (
    <section aria-label="Activity" className="rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold mb-3">Activity</h2>
      {activity.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No recent activity yet.
        </div>
      ) : (
        <ul className="divide-y text-sm">
          {activity.map((a: AnyRow) => (
            <li key={a.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
              <div className="flex flex-col">
                <span className="text-foreground/90 font-medium">
                  {humanizeRoleAction(a.action)}
                </span>
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  {actorLabel(a.actor_name, "client")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {a.created_at
                  ? formatDateTime(a.created_at)
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
