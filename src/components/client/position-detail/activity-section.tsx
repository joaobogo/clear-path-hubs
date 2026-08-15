import { humanizeRoleAction } from "@/lib/client/role-audit-humanizer";

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
            <li key={a.id} className="py-2 flex items-center justify-between gap-3">
              <span className="text-foreground/90">
                {humanizeRoleAction(a.action)}
              </span>
              <span className="text-xs text-muted-foreground">
                {a.created_at
                  ? new Date(a.created_at).toLocaleString()
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
