/**
 * The single account area for a client workspace.
 *
 * Everything that used to live on four separate pages (/client/account,
 * /client/team, /client/plan, /client/settings) is now one page with five
 * tabs. There is exactly one place to change any given value — the duplicate
 * team CRUD and the read-only subscription card were deleted rather than
 * kept alongside the real forms.
 */
import { formatCalendarDate } from "@/lib/calendar-date";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getClientContext } from "@/lib/client-context.functions";
import { getClientPositions } from "@/lib/client-positions.functions";
import { getAccountOverview } from "@/lib/account.functions";
import { countClientRoles, selectClientRoles, selectOpenClientRoles } from "@/lib/client/role-counts";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { formatStageDate } from "@/lib/client-role-progress";
import { EmptyState, SkeletonRows, SkeletonStats } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { EmailChangeCard } from "@/components/account/email-change-card";
import { WorkspaceTab } from "@/components/client/account/workspace-tab";
import { TeamTab } from "@/components/client/account/team-tab";
import { PlanTab } from "@/components/client/account/plan-tab";
import { NotificationsTab } from "@/components/client/account/notifications-tab";
import { BrandingTab } from "@/components/client/account/branding-tab";
import { parseSeatUpgradeSearch, type SeatUpgradeSearch } from "@/lib/seat-upgrade";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Briefcase, CalendarClock, CheckCircle2, ChevronDown, Info, Users } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export const ACCOUNT_TABS = [
  { key: "workspace", label: "Workspace" },
  { key: "team", label: "Team" },
  { key: "plan", label: "Plan & billing" },
  { key: "notifications", label: "Notifications" },
] as const;


export type AccountTab = (typeof ACCOUNT_TABS)[number]["key"];

export function parseTab(value: unknown): AccountTab {
  return ACCOUNT_TABS.some((t) => t.key === value) ? (value as AccountTab) : "workspace";
}

export const Route = createFileRoute("/_authenticated/client/account")({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      tab: parseTab(search.tab),
      ...(typeof search.org === "string" ? { org: search.org } : {}),
      ...(typeof search.focus === "string" ? { focus: search.focus } : {}),
      // Seat position carried in from a blocked invite/reactivation so the plan
      // tab can say exactly what an upgrade resolves.
      ...parseSeatUpgradeSearch(search),
    }) as { tab: AccountTab; org?: string; focus?: string } & SeatUpgradeSearch,
  head: () => ({
    meta: [
      { title: "Account · Client workspace" },
      {
        name: "description",
        content:
          "One account area: workspace details, team and roles, plan and billing, notifications, and branding.",
      },
      { property: "og:title", content: "Account · TaaSFlow client workspace" },
      {
        property: "og:description",
        content:
          "Workspace details, team and roles, plan and billing, notifications, and branding in one place.",
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
  notFoundComponent: makeRouteNotFoundComponent("client"),
  component: AccountPage,
});

function fmtDate(iso: string | null | undefined): string {
  return formatCalendarDate(iso, "");
}

function AccountPage() {
  const { tab, focus } = Route.useSearch();
  const [workspaceOpen, setWorkspaceOpen] = useState(focus === "email");
  const ctxFn = useServerFn(getClientContext);
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const readOnly = support.readOnly;

  // Open the workspace details collapsible when the user is sent here from the
  // "Update your email" action in the notification panel.
  useEffect(() => {
    if (focus === "email") setWorkspaceOpen(true);
  }, [focus]);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id as string | undefined;

  if (ctxQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <QueryErrorCard
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <SkeletonStats tiles={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Account
        </div>
        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
          {ctx?.active?.name ?? "Your account"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Workspace details, workspace access, plan and billing, and notifications —
          all in one place.
        </p>


      </header>

      {readOnly && (
        <div className="flex items-center gap-2 rounded-lg border taas-bd-warning px-3 py-2 text-sm">
          <Info className="h-4 w-4 shrink-0 taas-fg-warning" />
          <span>You are viewing as an administrator — changes are disabled.</span>
        </div>
      )}

      {tab === "workspace" && (
        <div className="space-y-8">
          {/* First viewport answers: "What is the health of my workspace?" */}
          <WorkspaceKpiTiles orgId={orgId} />

          {/* Everything else is reachable within one click, keeping the first
              viewport focused on the KPIs and under the density cap. */}
          <Collapsible
            className="space-y-8"
            open={workspaceOpen}
            onOpenChange={setWorkspaceOpen}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="text-sm font-medium text-foreground">Workspace details</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  Roles, email, company profile, timezone, security, account
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-8 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <WorkspaceRolesAndStarts orgId={orgId} />
              <EmailChangeCard focus={focus === "email"} />
              <WorkspaceTab />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
      {tab === "team" && <TeamTab />}
      {tab === "plan" && <PlanTab />}
      {tab === "notifications" && <NotificationsTab />}

    </div>
  );
}

/**
 * The numbers a client asks for first: open roles, hires, seats, renewal —
 * surfaced above the fold so the workspace tab answers its primary question
 * in the first viewport.
 */
export function WorkspaceKpiTiles({ orgId }: { orgId: string }) {
  const overviewFn = useServerFn(getAccountOverview);
  const positionsFn = useServerFn(getClientPositions);

  const overview = useQuery({
    queryKey: ["client-account", orgId],
    queryFn: () => overviewFn({ data: { orgId } }),
    placeholderData: (prev) => prev,
  });
  // The role figures come from the same roles query the Roles page and the
  // "Roles and where they are" panel use, so the two counts on this page can
  // never disagree.
  const positions = useQuery({
    queryKey: ["client-positions", orgId, "account"],
    queryFn: () => positionsFn({ data: { orgId } }),
    placeholderData: (prev) => prev,
  });

  const overviewState = useQueryState(overview);
  const data = overview.data;
  const roleCounts = useMemo(
    () => countClientRoles((positions.data as AnyRow[]) ?? []),
    [positions.data],
  );

  if (overviewState.isError) {
    return (
      <QueryErrorCard
        error={overviewState.error}
        onRetry={overviewState.retry}
        retrying={overviewState.retrying}
      />
    );
  }

  if (overview.isLoading && !data) {
    return <SkeletonStats tiles={4} />;
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        icon={<Briefcase className="h-4 w-4" />}
        label="Open roles"
        value={positions.isLoading && !positions.data ? "—" : String(roleCounts.open)}
        note={
          positions.isLoading && !positions.data
            ? "Counting roles…"
            : `${roleCounts.total} total in the account`
        }
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
  );
}

/**
 * Roles, upcoming starts, and related workspace context. Progressive-disclosed
 * below the KPIs so the first viewport stays focused on the workspace status.
 */
export function WorkspaceRolesAndStarts({ orgId }: { orgId: string }) {
  const positionsFn = useServerFn(getClientPositions);
  const overviewFn = useServerFn(getAccountOverview);

  const positions = useQuery({
    queryKey: ["client-positions", orgId, "account"],
    queryFn: () => positionsFn({ data: { orgId } }),
    placeholderData: (prev) => prev,
  });
  const overview = useQuery({
    queryKey: ["client-account", orgId],
    queryFn: () => overviewFn({ data: { orgId } }),
    placeholderData: (prev) => prev,
  });

  const positionsState = useQueryState(positions);
  const overviewState = useQueryState(overview);

  const data = overview.data;
  // Same shared rule as the Account tile and the Roles page: drafts, archived
  // roles and test records are not part of the client's account.
  const roles = useMemo(
    () => selectClientRoles(((positions.data as AnyRow[]) ?? [])),
    [positions.data],
  );
  const openRoles = useMemo(() => selectOpenClientRoles(roles), [roles]);

  return (
    <div className="space-y-8">
      {overviewState.isError && (
        <QueryErrorCard
          error={overviewState.error}
          onRetry={overviewState.retry}
          retrying={overviewState.retrying}
        />
      )}

      {/* Roles */}
      <section className="rounded-xl border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Roles and where they are</h2>
            <p className="text-xs text-muted-foreground">
              {positionsState.isError
                ? "Couldn't load counts"
                : `${openRoles.length} open · ${roles.length} total`}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/client/positions">Open roles</Link>
          </Button>
        </div>
        {positionsState.isError ? (
          <QueryErrorCard
            className="m-5"
            error={positionsState.error}
            onRetry={positionsState.retry}
            retrying={positionsState.retrying}
          />
        ) : positions.isLoading && roles.length === 0 ? (
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
                className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
              >
                <div className="min-w-0">
                  <Link
                    to="/client/positions/$id"
                    params={{ id: String(p.id) }}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {p.pipeline_line ?? "—"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <Badge variant="outline" className="whitespace-nowrap">
                    {p.progress?.currentLabel ?? "Briefed"}
                  </Badge>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {p.progress?.currentEnteredAt
                      ? `since ${formatStageDate(p.progress.currentEnteredAt)}`
                      : ""}
                  </span>
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {/* Same source as /client/positions: ClientKpis.hires
                        (the old `hired` key never existed → always 0). */}
                    {p.kpis?.hires ?? 0} hired
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
                <span className="min-w-0 truncate">{h.position_title ?? "Hire"}</span>
                <span className="shrink-0 text-muted-foreground">{fmtDate(h.start_date)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
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
