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
import { FlaskConical } from "lucide-react";
import { ExceptionDigest } from "@/components/admin/exception-digest";
import { TestRecordsToggle } from "@/components/admin/test-records-toggle";
import { SectionTabs, filterSectionGroups } from "@/components/workspace/section-tabs";
import { ADMIN_SECTION_GROUPS } from "@/config/workspace-sections";
import { ADMIN_NAV } from "@/config/admin-nav";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { SupportSessionBanner } from "@/components/admin/support-session-banner";
import { AdminTestScopeProvider } from "@/components/admin/admin-test-scope";
import { DeferredBlock } from "@/components/ds/deferred-block";
import { SkeletonTimeout } from "@/components/ds/skeleton-timeout";
import { useIncludeTestRecords } from "@/lib/admin-scope";


const STAFF_GATE_TIMEOUT_MS = 3_000;

async function getStaffAccessWithTimeout() {
  return Promise.race([
    getStaffAccess(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Staff access check timed out. Please retry.")),
        STAFF_GATE_TIMEOUT_MS,
      ),
    ),
  ]);
}

export const Route = createFileRoute("/_authenticated/admin")({
  pendingComponent: () => (
    <SkeletonTimeout
      timeoutMs={10_000}
      label="Entering admin workspace…"
    />
  ),
  errorComponent: makeRouteErrorComponent("admin", "/_authenticated/admin"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
  beforeLoad: async () => {
    // Only the security gate blocks the protected subtree. Test-record scope
    // is fetched asynchronously inside the layout so it never holds the whole
    // page skeleton.
    try {
      const access = await getStaffAccessWithTimeout();
      if (!access.staff) throw redirect({ to: "/access-denied", search: { reason: "permission" } });
      return { staffAccess: access };
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (e && typeof e === "object" && (e as any).isRedirect) throw e;
      throw redirect({ to: "/access-denied", search: { reason: "permission" } });
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
  // The decision desks read under their own keys. Without these listed here a
  // staff notification refreshed the counters while the queue a reviewer is
  // actually looking at stayed on stale rows until a manual reload.
  ["candidate-index"],
  ["admin-work-queues"],
  ["admin-review-queue-ids"],
  ["admin-candidate"],
  NOTIFICATIONS_QUERY_KEY,
] as const;


function AdminLayout() {
  const { staffAccess } = Route.useRouteContext();
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
    <AdminTestScopeProvider>
      <WorkspaceShell
        role="admin"
        contextKicker="TaaSFlow"
        contextLabel="Admin"
        contextSubLabel={email ?? undefined}
        navItems={navItems}
        searchScope="admin"
        headerSlot={
          <div className="flex items-center gap-2">
            <DeferredBlock timeoutMs={10_000} errorTitle="Test records toggle unavailable">
              <TestRecordsToggle />
            </DeferredBlock>
            <DeferredBlock timeoutMs={10_000} errorTitle="Exception digest unavailable">
              <ExceptionDigest />
            </DeferredBlock>
          </div>
        }
      >
        {/* Support access to a customer workspace stays visible everywhere in
            Admin, with a one-click way to give it back. */}
        <DeferredBlock timeoutMs={10_000} errorTitle="Support banner unavailable">
          <div className="-mx-4 mb-4 sm:-mx-6">
            <SupportSessionBanner />
          </div>
        </DeferredBlock>

        <DeferredBlock timeoutMs={10_000} errorTitle="Section tabs unavailable">
          <div className="mb-6">
            <SectionTabs groups={sectionGroups} />
          </div>
        </DeferredBlock>

        <div className="flex-1">
          <Outlet />
        </div>

      </WorkspaceShell>
    </AdminTestScopeProvider>
  );
}

function TestScopeBanner() {
  const includeTest = useIncludeTestRecords();
  if (!includeTest) return null;
  return (
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
  );
}

