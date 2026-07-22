import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyContext } from "@/lib/candidate.functions";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell, NOTIFICATIONS_QUERY_KEY } from "@/components/notification-bell";
import { useDashboardRealtime } from "@/hooks/use-realtime-refresh";
import { FileText, User, MessageSquare, Shield } from "lucide-react";

const CANDIDATE_REFRESH_KEYS = [
  ["me-context"],
  ["me", "applications"],
  ["me", "messages"],
  ["me", "profile"],
  NOTIFICATIONS_QUERY_KEY,
] as const;

export const Route = createFileRoute("/_authenticated/me")({
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
  errorComponent: ({ error }) => (
    <main className="p-8 text-destructive">Failed to load: {error.message}</main>
  ),
  notFoundComponent: () => <main className="p-8">Not found.</main>,
  component: MeLayout,
});

const TABS = [
  { to: "/me/applications", label: "Applications", icon: FileText },
  { to: "/me/profile", label: "Profile", icon: User },
  { to: "/me/messages", label: "Messages", icon: MessageSquare },
  { to: "/me/settings", label: "Privacy & settings", icon: Shield },
] as const;

function MeLayout() {
  const ctx = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const getCtx = useServerFn(getMyContext);
  const { data } = useQuery({
    queryKey: ["me-context"],
    queryFn: () => getCtx(),
    initialData: ctx,
  });

  if (!data?.profile) {
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

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-60 shrink-0 border-r bg-card">
        <div className="px-4 py-4 border-b">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Signed in as
          </div>
          <div className="font-semibold truncate">{data.profile.full_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {data.profile.email}
          </div>
        </div>
        <nav className="p-2 space-y-1">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
