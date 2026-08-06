import { createFileRoute, Link } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listAllConversations } from "@/lib/conversations.functions";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MessageSquare, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-conversations"],
      queryFn: () => listAllConversations(),
    }),
  head: () => ({
    meta: [
      { title: "Conversations · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminConversationsPage,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.messages"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

function AdminConversationsPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-conversations"],
    queryFn: () => listAllConversations(),
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.items.length} {data.items.length === 1 ? "thread" : "threads"} across all clients —
          one per account, role, and candidate. Open a thread to reply inside the client workspace.
        </p>
      </header>

      {data.items.length === 0 ? (
        <div className="rounded-lg border bg-card px-5 py-14 text-center">
          <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No conversations yet.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {data.items.map((t) => {
            const Icon =
              t.scope === "position" ? Briefcase : t.scope === "candidate" ? User : MessageSquare;
            return (
              <li key={t.id}>
                <Link
                  to="/client/conversations/$conversationId"
                  params={{ conversationId: t.id }}
                  search={{ org: t.organization_id }}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.organization_name}</span>
                      <Badge variant="secondary">{t.subject}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {t.last_body ?? "No messages yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {relTime(t.last_message_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
