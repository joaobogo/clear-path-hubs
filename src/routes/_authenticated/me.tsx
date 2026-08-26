import {
  makeRouteErrorComponent,
  makeRouteNotFoundComponent,
} from "@/components/workspace/route-states";
import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { ComponentErrorBoundary, ErrorState } from "@/components/ds";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { getMyContext } from "@/lib/candidate.functions";
import { supabase } from "@/integrations/supabase/client";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { FileText, User, MessageSquare, Shield, FileUp, Home } from "lucide-react";
import {
 WorkspaceShell,
 type WorkspaceNavItem,
} from "@/components/workspace/workspace-shell";

const CANDIDATE_REFRESH_KEYS = [
 ["me-context"],
 ["me", "applications"],
 ["me", "messages"],
 ["me", "profile"],
 NOTIFICATIONS_QUERY_KEY,
] as const;

export const Route = createFileRoute("/_authenticated/me")({
  errorComponent: makeRouteErrorComponent("candidate", "/_authenticated/me"),
  notFoundComponent: makeRouteNotFoundComponent("candidate"),
 head: () => ({
 meta: [
 { title: "My account · TaaSFlow" },
 { name: "robots", content: "noindex" },
 ],
 }),
 loader: async ({ context }) =>
 context.queryClient.ensureQueryData({
 queryKey: ["me-context"],
 queryFn: () => getMyContext(),
 }),
 component: MeLayout,
});

const NAV: WorkspaceNavItem[] = [
 { to: "/me", label: "Home", icon: Home },
 { to: "/me/applications", label: "Applications", icon: FileText },
 { to: "/me/profile", label: "Profile", icon: User },
 { to: "/me/cv", label: "CV", icon: FileUp },
 { to: "/me/messages", label: "Messages", icon: MessageSquare },
 { to: "/me/privacy", label: "Privacy", icon: Shield },
];

function MeLayout() {
 const ctx = Route.useLoaderData();
 const getCtx = useServerFn(getMyContext);
 const { data } = useQuery({
 queryKey: ["me-context"],
 queryFn: () => getCtx(),
 initialData: ctx,
 });

 const [userId, setUserId] = useState<string | null>(null);
 useEffect(() => {
 supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
 }, []);
 useDashboardRealtime({ userId, audience: "candidate", invalidateKeys: CANDIDATE_REFRESH_KEYS });

  if (!data?.profile && data?.seat === "candidate") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold mb-3">Welcome to TaaSFlow</h1>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t find a candidate profile linked to{" "}
          <strong>{data?.email ?? "your account"}</strong>. If you applied with a
          different email, sign in with that one — we&apos;ll link your account
          automatically. Otherwise, browse open roles to get started.
        </p>
        <div className="flex gap-3">
          <Link
            to="/jobs"
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium"
          >
            Browse jobs
          </Link>
        </div>
      </main>
    );
  }

  const seat = data?.seat ?? "candidate";
  const nav = NAV.filter((item) => {
    if (seat !== "candidate") {
      return ["/me/profile", "/me/privacy"].includes(item.to);
    }
    return true;
  });

  const displayName =
    data?.profile?.full_name ||
    data?.email?.split("@")[0] ||
    (seat === "staff" ? "Staff" : "Member");

  return (
    <WorkspaceShell
      role="candidate"
      contextKicker="Signed in as"
      contextLabel={displayName}
      contextSubLabel={data?.email ?? undefined}
      navItems={nav}
    >
      <PortalBoundary>
        <Outlet />
      </PortalBoundary>
    </WorkspaceShell>
  );
}

/**
 * Last-resort client boundary for the candidate portal. Route-level
 * errorComponents miss client-render/hydration throws inside the shell, which
 * previously left an applicant staring at a blank page. Keyed by pathname so
 * navigating away clears the fallback, and retry re-runs the loaders.
 */
function PortalBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <ComponentErrorBoundary
      key={pathname}
      boundary={`candidate.portal:${pathname}`}
      tone="candidate"
      fallback={(retry) => (
        <div className="p-6">
          <ErrorState
            title="This page didn't finish loading"
            description="Nothing about your applications has changed. Try loading it again."
            onRetry={() => {
              router.invalidate();
              retry();
            }}
          />
        </div>
      )}
    >
      {children}
    </ComponentErrorBoundary>
  );
}
