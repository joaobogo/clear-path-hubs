import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getClientContext,
  getClientPositions,
  getClientTeam,
  updateClientMemberRole,
  setClientMemberStatus,
  removeClientMember,
  resendClientInvitation,
} from "@/lib/client.functions";
import { getAccountOverview } from "@/lib/account.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { formatStageDate } from "@/lib/client-role-progress";
import { EmptyState, PermissionDenied, SkeletonRows, SkeletonStats } from "@/components/client/states";
import { TeamActivityPanel } from "@/components/client/team-activity-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Info,
  Mail,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

type ClientRoleId = "client_admin" | "client_editor" | "client_viewer";

const ROLE_LABEL: Record<ClientRoleId, string> = {
  client_admin: "Workspace admin",
  client_editor: "Editor",
  client_viewer: "Viewer",
};

const ROLE_DESCRIPTION: Record<ClientRoleId, string> = {
  client_admin: "Manage team, positions, and candidate decisions.",
  client_editor: "Act on positions, candidates, and interviews.",
  client_viewer: "Read-only across the workspace.",
};

export const Route = createFileRoute("/_authenticated/client/account")({
  head: () => ({
    meta: [
      { title: "Account · TaaSFlow client workspace" },
      {
        name: "description",
        content:
          "One executive view of your account: every role and its stage, hires closed, seats in use, invoice period, renewal date, and team permissions.",
      },
      { property: "og:title", content: "Account · TaaSFlow client workspace" },
      {
        property: "og:description",
        content:
          "Roles, hires, seats, billing period, renewal date, and team permissions in a single page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "client",
    "src/routes/_authenticated/client.account.tsx",
  ),
  component: AccountPage,
});

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function NotOnFile({ hint }: { hint: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      Not on file · <span className="text-xs">{hint}</span>
    </span>
  );
}

function AccountPage() {
  const ctxFn = useServerFn(getClientContext);
  const overviewFn = useServerFn(getAccountOverview);
  const positionsFn = useServerFn(getClientPositions);
  const teamFn = useServerFn(getClientTeam);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const readOnly = support.readOnly;

  const [selfId, setSelfId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
  }, []);

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id as string | undefined;
  const isAdmin =
    ctx?.active?.role === "client_admin" ||
    ctx?.active?.role === "platform_admin" ||
    ctx?.active?.role === "operations";
  const canMutate = Boolean(isAdmin) && !readOnly;

  const overview = useQuery({
    queryKey: ["client-account", orgId],
    queryFn: () => overviewFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });
  const positions = useQuery({
    queryKey: ["client-positions", orgId, "account"],
    queryFn: () => positionsFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });
  const team = useQuery({
    queryKey: ["client-team", orgId],
    queryFn: () => teamFn({ data: { orgId: orgId! } }),
    enabled: !!orgId && !!isAdmin,
    placeholderData: (prev) => prev,
  });

  const data = overview.data;
  const roles = ((positions.data as AnyRow[]) ?? []).filter(
    (p) => !["archived"].includes(String(p.status)),
  );
  const members = ((team.data as AnyRow[]) ?? []).filter((m) => m.status !== "removed");

  const openRoles = useMemo(
    () => roles.filter((p) => ["active", "approved", "paused"].includes(String(p.status))),
    [roles],
  );

  if (!orgId) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <SkeletonStats tiles={4} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Account
        </div>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
          {data?.organization.name ?? ctx?.active?.name ?? "Your account"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every number your team might ask for, in one place — roles and their stage,
          hires closed, seats in use, your invoice period and renewal date.
        </p>
      </header>

      {readOnly && (
        <div className="flex items-center gap-2 rounded-lg border taas-bd-warning px-3 py-2 text-sm">
          <Info className="h-4 w-4 shrink-0 taas-fg-warning" />
          <span>You are viewing as an administrator — changes are disabled.</span>
        </div>
      )}

      {/* Summary tiles */}
      {overview.isLoading && !data ? (
        <SkeletonStats tiles={4} />
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            icon={<Briefcase className="h-4 w-4" />}
            label="Open roles"
            value={String(data?.roles_open ?? 0)}
            note={`${data?.roles_total ?? 0} total in the account`}
          />
          <Tile
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Hires closed"
            value={String(data?.hires.total ?? 0)}
            note={
              data?.subscription.billing_period_start
                ? `${data.hires.this_period} this invoice period`
                : `${data?.hires.last_90_days ?? 0} in the last 90 days`
            }
          />
          <Tile
            icon={<Users className="h-4 w-4" />}
            label="Seats in use"
            value={`${data?.seats.active ?? 0} / ${data?.seats.limit ?? 0}`}
            note={
              (data?.seats.invited ?? 0) > 0
                ? `${data?.seats.invited} invitation${data?.seats.invited === 1 ? "" : "s"} pending · ${data?.seats.remaining} free`
                : `${data?.seats.remaining ?? 0} seat${data?.seats.remaining === 1 ? "" : "s"} free`
            }
          />
          <Tile
            icon={<CalendarClock className="h-4 w-4" />}
            label="Renews"
            value={
              data?.subscription.renewal_date
                ? fmtDate(data.subscription.renewal_date)
                : "—"
            }
            note={
              data?.subscription.renewal_date
                ? `${Math.max(0, data.subscription.days_to_renewal ?? 0)} days away`
                : "Renewal date not on file"
            }
          />
        </section>
      )}

      {/* Subscription */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Subscription
        </h2>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Plan</dt>
            <dd className="mt-1 text-sm font-medium">
              {data?.subscription.plan_name ?? (
                <NotOnFile hint="ask us to add your plan name" />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Billing interval</dt>
            <dd className="mt-1 text-sm font-medium capitalize">
              {data?.subscription.billing_interval ?? (
                <NotOnFile hint="not recorded yet" />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Invoice period</dt>
            <dd className="mt-1 text-sm font-medium">
              {data?.subscription.billing_period_start ? (
                <>
                  {fmtDate(data.subscription.billing_period_start)}
                  {data.subscription.billing_period_end
                    ? ` – ${fmtDate(data.subscription.billing_period_end)}`
                    : " – ongoing"}
                </>
              ) : (
                <NotOnFile hint="not recorded yet" />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Renewal date</dt>
            <dd className="mt-1 text-sm font-medium">
              {data?.subscription.renewal_date ? (
                fmtDate(data.subscription.renewal_date)
              ) : (
                <NotOnFile hint="not recorded yet" />
              )}
            </dd>
          </div>
        </dl>
        {data?.subscription.pilot_status === "active" && data.subscription.pilot_ends_at && (
          <p className="mt-4 rounded-lg border taas-bd-info px-3 py-2 text-sm">
            Pilot in progress — ends {fmtDate(data.subscription.pilot_ends_at)}.
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          These figures come straight from your account record. Anything marked “not on
          file” is not held in the system — nothing here is estimated.
        </p>
      </section>

      {/* Roles */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Roles and where they are</h2>
            <p className="text-xs text-muted-foreground">
              {openRoles.length} open · {roles.length} total
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/client/positions">Open positions</Link>
          </Button>
        </div>
        {positions.isLoading && roles.length === 0 ? (
          <div className="p-5">
            <SkeletonRows rows={4} />
          </div>
        ) : roles.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No roles yet"
            description="Once you brief a role, it appears here with its live stage and hire count."
            action={{ label: "Submit a role", to: "/intake" }}
          />
        ) : (
          <ul className="divide-y">
            {roles.map((p: AnyRow) => (
              <li
                key={p.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <Link
                    to="/client/positions/$id"
                    params={{ id: String(p.id) }}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.pipeline_line ?? "—"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="whitespace-nowrap">
                    {p.progress?.currentLabel ?? "Briefed"}
                  </Badge>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {p.progress?.currentEnteredAt
                      ? `since ${formatStageDate(p.progress.currentEnteredAt)}`
                      : ""}
                  </span>
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {(p.kpis?.hired ?? 0)} hired
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upcoming starts */}
      {(data?.hires.upcoming_starts.length ?? 0) > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Upcoming start dates
          </h2>
          <ul className="mt-3 space-y-2">
            {data!.hires.upcoming_starts.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{h.position_title ?? "Hire"}</span>
                <span className="shrink-0 text-muted-foreground">
                  {fmtDate(h.start_date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Who is doing what */}
      {isAdmin && <TeamActivityPanel orgId={orgId ?? null} />}

      {/* Team */}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Team and permissions</h2>
            <p className="text-xs text-muted-foreground">
              {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
              {data?.seats.remaining ?? 0} seat
              {(data?.seats.remaining ?? 0) === 1 ? "" : "s"} free
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/client/team">Invite teammate</Link>
          </Button>
        </div>
        {!isAdmin ? (
          <PermissionDenied
            title="Team details are admin-only"
            description="Ask a workspace admin in your organisation to change permissions or invite teammates."
            whoToAsk="A workspace admin in your organisation"
          />
        ) : team.isLoading && members.length === 0 ? (
          <div className="p-5">
            <SkeletonRows rows={3} />
          </div>
        ) : (
          <ul className="divide-y">
            {members.map((m: AnyRow) => (
              <AccountMemberRow
                key={m.user_id}
                orgId={orgId}
                member={m}
                canMutate={canMutate}
                selfId={selfId}
              />
            ))}
          </ul>
        )}
        <div className="grid gap-3 border-t px-5 py-4 sm:grid-cols-3">
          {(Object.keys(ROLE_LABEL) as ClientRoleId[]).map((r) => (
            <div key={r} className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <RoleIcon role={r} />
                {ROLE_LABEL[r]}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Tile({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function RoleIcon({ role }: { role: ClientRoleId }) {
  if (role === "client_admin") return <ShieldCheck className="h-3.5 w-3.5 text-primary" />;
  if (role === "client_editor") return <UserCog className="h-3.5 w-3.5 taas-fg-info" />;
  return <Shield className="h-3.5 w-3.5 text-muted-foreground" />;
}

function AccountMemberRow({
  orgId,
  member,
  canMutate,
  selfId,
}: {
  orgId: string;
  member: AnyRow;
  canMutate: boolean;
  selfId: string | null;
}) {
  const qc = useQueryClient();
  const roleFn = useServerFn(updateClientMemberRole);
  const statusFn = useServerFn(setClientMemberStatus);
  const removeFn = useServerFn(removeClientMember);
  const resendFn = useServerFn(resendClientInvitation);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["client-team", orgId] });
    qc.invalidateQueries({ queryKey: ["client-account", orgId] });
  };
  const handleErr = (e: unknown) =>
    toast.error((e instanceof Error ? e.message : String(e)).replace(/^Error: /, ""));

  const changeRole = useMutation({
    mutationFn: (role: ClientRoleId) =>
      roleFn({ data: { orgId, userId: member.user_id, role } }),
    onSuccess: () => {
      toast.success("Permissions updated");
      invalidate();
    },
    onError: handleErr,
  });
  const changeStatus = useMutation({
    mutationFn: (status: "active" | "suspended") =>
      statusFn({ data: { orgId, userId: member.user_id, status } }),
    onSuccess: (_r, s) => {
      toast.success(s === "active" ? "Access restored" : "Access suspended");
      invalidate();
    },
    onError: handleErr,
  });
  const remove = useMutation({
    mutationFn: () => removeFn({ data: { orgId, userId: member.user_id } }),
    onSuccess: () => {
      toast.success("Member removed");
      invalidate();
    },
    onError: handleErr,
  });
  const resend = useMutation({
    mutationFn: () => resendFn({ data: { orgId, userId: member.user_id } }),
    onSuccess: () => toast.success("Invitation resent"),
    onError: handleErr,
  });

  const busy =
    changeRole.isPending || changeStatus.isPending || remove.isPending || resend.isPending;
  const name: string = member.profiles?.full_name || member.profiles?.email || "Team member";
  const email: string | null = member.profiles?.email ?? null;
  const role = member.role as ClientRoleId;
  const status = String(member.status ?? "active");
  const isSelf = Boolean(selfId && selfId === member.user_id);
  const editable = canMutate && !isSelf && status !== "invited";

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="truncate">{name}</span>
          {isSelf && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              You
            </span>
          )}
          {status === "invited" && (
            <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px]">
              Invitation sent
            </Badge>
          )}
          {status === "suspended" && (
            <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px]">
              Suspended
            </Badge>
          )}
        </div>
        {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {editable ? (
          <Select
            value={role}
            onValueChange={(v) => changeRole.mutate(v as ClientRoleId)}
            disabled={busy}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABEL) as ClientRoleId[]).map((r) => (
                <SelectItem key={r} value={r} className="text-xs">
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <RoleIcon role={role} />
            {ROLE_LABEL[role] ?? role}
          </span>
        )}
        {canMutate && !isSelf && status === "invited" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={busy}
            onClick={() => resend.mutate()}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" /> Resend
          </Button>
        )}
        {canMutate && !isSelf && status === "active" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={busy}
            onClick={() => changeStatus.mutate("suspended")}
          >
            Suspend
          </Button>
        )}
        {canMutate && !isSelf && status === "suspended" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              disabled={busy}
              onClick={() => changeStatus.mutate("active")}
            >
              Reactivate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive"
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
