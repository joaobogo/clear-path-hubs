import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getClientContext } from "@/lib/client.functions";
import { listConversations } from "@/lib/conversations.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Briefcase, MessageSquare, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonRows, ErrorState } from "@/components/client/states";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoMessagesState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";

export const Route = createFileRoute("/_authenticated/client/conversations/")({
  head: () => ({
    meta: [
      { title: "Conversations · Client workspace" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "One thread per role and per candidate — who said what, when, mirrored to email.",
      },
    ],
  }),
  component: ConversationsPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "position", label: "Roles" },
  { key: "candidate", label: "Candidates" },
  { key: "organization", label: "Account" },
] as const;

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function ConversationsPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listConversations);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;

    const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["conversations", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });
  const signals = useEmptyStateSignals(orgId, {
    enabled: !isLoading && (data?.items?.length ?? 0) === 0,
  });

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items ?? []).filter((c) => {
      if (filter !== "all" && c.scope !== filter) return false;
      if (!needle) return true;
      return (
        c.subject.toLowerCase().includes(needle) ||
        (c.context_label ?? "").toLowerCase().includes(needle) ||
        (c.last_body ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, filter, q]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessageSquare className="h-6 w-6 text-primary" /> Conversations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One thread per role and per candidate. Everything is mirrored to email.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations"
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && !data ? (
        <SkeletonRows rows={5} />
      ) : isError && !data ? (
        <ErrorState
          title="We couldn't load your conversations"
          onRetry={() => void refetch()}
        />
      ) : items.length === 0 ? (
        <SurfaceState
          content={resolveNoMessagesState({ activeRoles: signals?.activeRoles ?? 0 })}
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((c) => {
            const Icon =
              c.scope === "position" ? Briefcase : c.scope === "candidate" ? User : MessageSquare;
            return (
              <li key={c.id}>
                <Link
                  to="/client/conversations/$conversationId"
                  params={{ conversationId: c.id }}
                  search={orgSearch ? { org: orgSearch } : undefined}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{c.subject}</span>
                      {c.unread > 0 && <Badge>{c.unread} new</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {c.last_sender_name ? `${c.last_sender_name}: ` : ""}
                      {c.last_body ?? "No messages yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {relTime(c.last_message_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
