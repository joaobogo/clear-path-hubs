import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, CheckSquare, UserX } from "lucide-react";
import {
  getClientTeamActivity,
  type TeamMemberActivity,
} from "@/lib/client-team-activity.functions";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

const ROLE_LABEL: Record<string, string> = {
  client_admin: "Admin",
  client_editor: "Editor",
  client_viewer: "Viewer",
};

function dateLabel(iso: string | null): string {
  if (!iso) return "Never signed in";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never signed in";
  return d.toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE, day: "numeric", month: "short", year: "numeric" });
}

function MemberRow({ m }: { m: TeamMemberActivity }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t px-4 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{m.name}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {ROLE_LABEL[m.role] ?? m.role}
          </span>
          {m.status === "invited" && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              Invited
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Last signed in {dateLabel(m.last_sign_in_at)}
          {m.not_seen_since_launch && (
            <span className="taas-fg-warning"> · not since a role launched</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
        <span className="flex items-center gap-1" title="Decisions recorded in the last 30 days">
          <CheckSquare className="h-3.5 w-3.5" aria-hidden />
          {m.decisions_30d}
        </span>
        <span className="flex items-center gap-1" title="Upcoming interviews they booked">
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
          {m.interviews_upcoming}
        </span>
        {m.not_seen_since_launch && <UserX className="h-3.5 w-3.5 taas-fg-warning" aria-hidden />}
      </div>
    </li>
  );
}

/**
 * Facts about the hiring team: decisions recorded, interviews booked, and who
 * has not signed in since a role launched. No people are scored or ranked.
 */
export function TeamActivityPanel({ orgId }: { orgId: string | null }) {
  const fetchActivity = useServerFn(getClientTeamActivity);
  const { data, isPending, isError } = useQuery({
    queryKey: ["client-team-activity", orgId],
    queryFn: () => fetchActivity({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  if (!orgId) return null;

  return (
    <section className="rounded-xl border bg-card">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Who is doing what</h2>
          <p className="text-xs text-muted-foreground">
            Decisions recorded, interviews booked, and last sign-in — straight from the record.
          </p>
        </div>
        {!!data && (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">
            {data.open_decisions} open decision{data.open_decisions === 1 ? "" : "s"}
          </span>
        )}
      </header>

      {isPending && (
        <ul>
          {[0, 1, 2].map((i) => (
            <li key={i} className="border-t px-4 py-3">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-3 w-56 animate-pulse rounded bg-muted/70" />
            </li>
          ))}
        </ul>
      )}

      {isError && (
        <p className="border-t px-4 py-6 text-sm text-muted-foreground">
          Team activity is only visible to admins and editors of this workspace.
        </p>
      )}

      {data && data.members.length === 0 && (
        <p className="border-t px-4 py-6 text-sm text-muted-foreground">
          No team members yet. Invite a colleague and their activity shows up here.
        </p>
      )}

      {data && data.members.length > 0 && (
        <ul>
          {data.members.map((m) => (
            <MemberRow key={m.user_id} m={m} />
          ))}
        </ul>
      )}
    </section>
  );
}
