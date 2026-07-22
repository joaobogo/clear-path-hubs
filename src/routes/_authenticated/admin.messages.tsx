import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listAdminMessages } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-messages"],
      queryFn: () => listAdminMessages(),
    }),
  head: () => ({
    meta: [
      { title: "Messages · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Messages unavailable: {error.message}</div>
  ),
  component: MessagesPage,
});

function MessagesPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-messages"],
    queryFn: () => listAdminMessages(),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.threads.length} client {data.threads.length === 1 ? "thread" : "threads"}. Open
          any row to reply inside the client workspace.
        </p>
      </header>

      {data.threads.length === 0 ? (
        <div className="rounded-lg border bg-card px-5 py-14 text-center">
          <MessageSquare className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No client messages yet.</p>
        </div>
      ) : (
        <ul className="rounded-lg border bg-card divide-y">
          {data.threads.map((t) => (
            <li key={t.thread_id}>
              <Link
                to="/admin/clients/$id"
                params={{ id: t.organization?.id ?? t.thread_id }}
                className="flex items-start gap-3 px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {t.organization?.name ?? "Unknown client"}
                    </span>
                    {t.unread && <Badge>new</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {t.last_body}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {relTime(t.last_at)}
                </span>
              </Link>
            </li>
          ))}
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
  const d = Math.round(h / 24);
  return `${d}d`;
}
