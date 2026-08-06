import {
  makeRouteErrorComponent,
  makeRouteNotFoundComponent,
} from "@/components/workspace/route-states";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ACTIVITY_QUERY_KEY } from "@/components/activity/ActivityFeed";

import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { getStaffAccess } from "@/lib/admin-staff-gate.functions";
import { getTestScopeState } from "@/lib/test-scope.functions";
import type { AdminTestScope } from "@/lib/admin-scope";
import { FlaskConical } from "lucide-react";
import { ExceptionDigest } from "@/components/admin/exception-digest";
import { TestRecordsToggle } from "@/components/admin/test-records-toggle";
import { SectionTabs, filterSectionGroups } from "@/components/workspace/section-tabs";
import { ADMIN_SECTION_GROUPS } from "@/config/workspace-sections";
import { ADMIN_NAV } from "@/config/admin-nav";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  errorComponent: makeRouteErrorComponent("admin", "/_authenticated/admin"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
  beforeLoad: async () => {
    // Same question the admin server functions ask (is_platform_staff), so the
    // layout gate and the server checks can never disagree.
    try {
      const access = await getStaffAccess();
      if (!access.staff) throw redirect({ to: "/access-denied" });
      // Test-record scope is resolved once here and handed to every desk
      // through route context, so no screen keeps its own copy in the URL or
      // in component state. A failed read falls back to "hidden" — fail closed.
      let testScope: AdminTestScope = {
        includeTest: false,
        excludedOrgs: 0,
        excludedPositions: 0,
      };
      try {
        const state = await getTestScopeState();
        testScope = {
          includeTest: state.show_test_records === true,
          excludedOrgs: state.excluded_orgs,
          excludedPositions: state.excluded_positions,
        };
      } catch (e) {
        console.error("[admin] test scope unresolved; hiding test records", e);
      }
      return { staffAccess: access, testScope };
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (e && typeof e === "object" && (e as any).isRedirect) throw e;
      throw redirect({ to: "/access-denied" });
    }
  },

  head: () => ({
    meta: [
      { title: "Admin · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const ADMIN_REFRESH_KEYS = [
  ACTIVITY_QUERY_KEY,
  ["admin-overview"],
  ["admin", "intakes"],
  ["admin", "matches"],
  ["admin", "positions"],
  ["admin", "delivery-failures"],
  ["pipeline-health"],
  ["publish-queue"],
  ["admin-messages"],
  NOTIFICATIONS_QUERY_KEY,
] as const;

function AdminLayout() {
  const { staffAccess, testScope } = Route.useRouteContext();
  // Nav comes from the same predicate the gate and the server functions use.
  const navItems = staffAccess.platformAdmin
    ? ADMIN_NAV
    : ADMIN_NAV.filter((item) => !item.requiresPlatformAdmin);
  // Tabs come from the same capabilities, so no desk is offered whose data
  // calls would 403.
  const sectionGroups = filterSectionGroups(ADMIN_SECTION_GROUPS, {
    platformAdmin: staffAccess.platformAdmin,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
    });
  }, []);
  useDashboardRealtime({ userId, audience: "admin", invalidateKeys: ADMIN_REFRESH_KEYS });

  return (
    <WorkspaceShell
      role="admin"
      contextKicker="TaaSFlow"
      contextLabel="Admin"
      contextSubLabel={email ?? undefined}
      navItems={navItems}
      searchScope="admin"
      headerSlot={
        <div className="flex items-center gap-2">
          <TestRecordsToggle />
          <ExceptionDigest />
        </div>
      }
    >
      <SectionTabs groups={sectionGroups} />

      {/* Included test records change every number on every desk, so say so
          once, loudly, instead of per-panel footnotes. */}
      {testScope.includeTest ? (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
        >
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium">Test records are included</span>
          <span className="text-warning-foreground/80">
            Every count, list and rollup on this desk mixes real accounts with test and
            internal organisations. Turn the toggle off to see production only.
          </span>
        </div>
      ) : null}

      <Outlet />

    </WorkspaceShell>
  );
}


