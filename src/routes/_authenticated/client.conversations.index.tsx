import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getClientContext } from "@/lib/client-context.functions";
import { listConversations, listMessageHistory } from "@/lib/conversations.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Briefcase, MessageSquare, Search, User, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonRows } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoMessagesState } from "@/lib/empty-states/empty-state-catalogue";
import { useEmptyStateSignals } from "@/hooks/use-empty-state-signals";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { relTime } from "@/components/client/overview/utils";


const RoutePending = makeWorkspacePending({ shape: "rows", kpis: false, width: "6xl" });
export const Route = createFileRoute("/_authenticated/client/conversations/")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  validateSearch: z.object({
    org: z.string().uuid().optional(),
    box: z.string().optional(),
    view: z.string().optional(),
    filter: z.string().optional(),
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.conversations.index.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
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
  { key: "unread", label: "Unread" },
  { key: "position", label: "Roles" },
  { key: "candidate", label: "Candidates" },
  { key: "organization", label: "Account" },
] as const;

function ConversationsPage() {
  const orgSearch = useClientOrgSearch();
  const search = Route.useSearch();
  // One list. "Inbox" is now the Unread chip; the flat all-messages log was
  // removed from the client experience — every message still lives in its thread.
  const box = search.box === "unread" || search.filter === "unread" ? "unread" : "all";
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listConversations);
  const rawFilter = search.filter || (box === "unread" ? "unread" : "all");
  const filter = rawFilter === "unread" ? "all" : rawFilter;
  const [q, setQ] = useState("");

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id;

  const {
    data: threadData,
    isLoading: isLoadingThreads,
    isError: isErrorThreads,
    isFetching: isFetchingThreads,
    error: errorThreads,
    refetch: refetchThreads,
  } = useQuery({
    queryKey: ["conversations", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    placeholderData: (prev) => prev,
  });

  const isLoading = isLoadingThreads;
  const isError = isErrorThreads;
  const isFetching = isFetchingThreads;
  const error = errorThreads;
  const refetch = refetchThreads;

  const signals = useEmptyStateSignals(orgId, {
    enabled: !isLoading && (threadData?.items?.length ?? 0) === 0,
  });

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const allItems = threadData?.items ?? [];

    return allItems.filter((c) => {
      if (box === "unread" && c.unread <= 0) return false;
      if (filter !== "all" && c.scope !== filter) return false;
      if (!needle) return true;
      return (
        c.subject.toLowerCase().includes(needle) ||
        (c.context_label ?? "").toLowerCase().includes(needle) ||
        (c.last_body ?? "").toLowerCase().includes(needle)
      );
    });
  }, [threadData, box, filter, q]);

  const unreadCount = (threadData?.items ?? []).filter((c) => c.unread > 0).length;


  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <MessageSquare className="h-6 w-6 text-primary" />
          Messages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One thread per role and per candidate. Everything is mirrored to email.
          {unreadCount ? ` ${unreadCount} unread.` : ""}
        </p>
      </header>


      <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                to="/client/conversations"
                search={(prev: any) => ({ ...prev, filter: f.key, box: undefined })}
                className={cn(
                  "rounded px-3 py-1.5 text-sm transition-colors",
                  rawFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </Link>
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

      {ctxQuery.isError ? (
        <QueryErrorCard
          title="We couldn't load your workspace"
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      ) : isError ? (
        <QueryErrorCard
          title="We couldn't load your conversations"
          error={error}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : isLoading && !threadData ? (
        <SkeletonRows rows={5} />
      ) : items.length === 0 && box === "unread" && (threadData?.items?.length ?? 0) > 0 ? (
        // Threads exist, just nothing unread — say so instead of the
        // "you have no messages" state, which would read as a bug here.
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm font-medium">You're all caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing unread. Switch to All to see every conversation.
          </p>
          <Link
            to="/client/conversations"
            search={orgSearch ? { org: orgSearch } : undefined}
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Back to threads
          </Link>
        </div>
      ) : items.length === 0 ? (
        <SurfaceState
          content={resolveNoMessagesState({
            activeRoles: signals?.activeRoles ?? 0,
            rolesInSetup: signals?.rolesInSetup ?? 0,
            filter: filter,
          })}
        />

      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((c: any) => {
            const isHistory = false;
            const Icon = isHistory
              ? UserCircle
              : c.scope === "position"
                ? Briefcase
                : c.scope === "candidate"
                  ? User
                  : MessageSquare;

            const conversationId = isHistory ? c.conversation_id : c.id;
            const title = isHistory ? c.sender_name : c.subject;
            const subtitle = isHistory ? c.subject : c.context_label;
            const body = isHistory ? c.body : c.last_body;
            const timestamp = isHistory ? c.created_at : c.last_message_at;
            const senderName = isHistory ? null : c.last_sender_name;

            return (
              <li key={c.id}>
                <Link
                  to="/client/conversations/$conversationId"
                  params={{ conversationId }}
                  search={orgSearch ? { org: orgSearch } : undefined}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/50"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{title}</span>
                      {!isHistory && c.unread > 0 && <Badge>{c.unread} new</Badge>}
                    </div>
                    {subtitle && (
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                    <p
                      className={cn(
                        "mt-1 text-sm text-muted-foreground",
                        isHistory ? "" : "line-clamp-2",
                      )}
                    >
                      {!isHistory && senderName ? `${senderName}: ` : ""}
                      {body ?? "No messages yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {relTime(timestamp)}
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
