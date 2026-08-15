import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { listAllConversations, getConversation } from "@/lib/conversations.functions";
import {
  getCandidateSupportThread,
  listCandidateSupportRequests,
  replyToCandidateSupport,
} from "@/lib/admin.functions";
import { ConversationThread } from "@/components/comms/conversation-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, ExternalLink, LifeBuoy, MessageSquare, User } from "lucide-react";


const searchSchema = z.object({
  conversationId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/messages")({
  validateSearch: searchSchema,
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: ["admin-conversations"],
        queryFn: () => listAllConversations(),
      }),
      context.queryClient.ensureQueryData({
        queryKey: ["admin-candidate-support"],
        queryFn: () => listCandidateSupportRequests(),
      }),
    ]),
  head: () => ({
    meta: [
      { title: "Conversations · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.messages.tsx",
  ),
  component: AdminConversationsPage,
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

function AdminConversationsPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { conversationId?: string };
  const { data } = useSuspenseQuery({
    queryKey: ["admin-conversations"],
    queryFn: () => listAllConversations(),
  });
  const { data: support } = useSuspenseQuery({
    queryKey: ["admin-candidate-support"],
    queryFn: () => listCandidateSupportRequests(),
  });

  const selectedId = search.conversationId;
  const selected = selectedId ? data.items.find((i) => i.id === selectedId) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.items.length} {data.items.length === 1 ? "thread" : "threads"} across all clients —
          one per account, role, and candidate.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className={selectedId ? "hidden lg:block lg:col-span-4" : "lg:col-span-12"}>
          {data.items.length === 0 ? (
            <div className="rounded-lg border bg-card px-5 py-14 text-center">
              <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No conversations yet.</p>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border bg-card overflow-hidden">
              {data.items.map((t) => {
                const Icon =
                  t.scope === "position" ? Briefcase : t.scope === "candidate" ? User : MessageSquare;
                const isActive = selectedId === t.id;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ search: { ...search, conversationId: t.id } })}
                      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors ${
                        isActive ? "bg-muted" : "hover:bg-muted/50"
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{t.organization_name}</span>
                          <Badge variant="secondary" className="max-w-[120px] truncate">{t.subject}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {t.last_body ?? "No messages yet"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {relTime(t.last_message_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedId && (
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="lg:hidden" 
                  onClick={() => navigate({ search: { ...search, conversationId: undefined } })}
                >
                  ← Back
                </Button>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate">{selected?.organization_name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{selected?.subject}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/client/conversations/$conversationId"
                  params={{ conversationId: selectedId }}
                  search={{ org: selected?.organization_id ?? "" }}
                >
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Open Workspace
                </Link>
              </Button>
            </div>
            
            <ConversationThread 
              conversationId={selectedId} 
              heightClass="h-[600px]"
              className="border shadow-sm"
            />
          </div>
        )}
      </div>

      <div className="h-px bg-border my-8" />

      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold tracking-tight">Candidate support</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Requests sent by candidates. These sit outside client workspaces — reply here and the
            candidate sees it on their own Messages page.
          </p>
        </header>

        {support.items.length === 0 ? (
          <div className="rounded-lg border bg-card px-5 py-10 text-center">
            <LifeBuoy className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No candidate support requests.</p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {support.items.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.candidate_name}</span>
                      {r.category ? <Badge variant="secondary">{r.category}</Badge> : null}
                      {r.reference ? (
                        <Badge variant="outline">ref {r.reference}</Badge>
                      ) : null}
                      {r.unread ? <Badge>New</Badge> : null}
                    </div>
                    {r.candidate_email ? (
                      <a
                        href={`mailto:${r.candidate_email}`}
                        className="mt-0.5 block truncate text-xs text-muted-foreground underline"
                      >
                        {r.candidate_email}
                      </a>
                    ) : null}
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {r.body}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {relTime(r.created_at)}
                  </span>
                </div>
                <CandidateSupportReply
                  candidateUserId={r.candidate_user_id}
                  candidateName={r.candidate_name}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Staff-side reply composer. Before this the candidate channel was one-way:
 * candidates wrote in and the only answer route was email, which never showed
 * up on the candidate's Messages page.
 */
function CandidateSupportReply({
  candidateUserId,
  candidateName,
}: {
  candidateUserId: string;
  candidateName: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const replyFn = useServerFn(replyToCandidateSupport);

  const thread = useQuery({
    queryKey: ["admin-candidate-thread", candidateUserId],
    queryFn: () => getCandidateSupportThread({ data: { candidate_user_id: candidateUserId } }),
    enabled: open,
  });

  const send = useMutation({
    mutationFn: (text: string) => replyFn({ data: { candidate_user_id: candidateUserId, body: text } }),
    onSuccess: async () => {
      setBody("");
      toast.success(`Reply sent to ${candidateName}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-candidate-thread", candidateUserId] }),
        qc.invalidateQueries({ queryKey: ["admin-candidate-support"] }),
      ]);
    },
    onError: (e: Error) => toastError(e),
  });

  if (!open) {
    return (
      <div className="mt-2 pl-7">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          data-testid="support-reply-open"
        >
          Reply in app
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 pl-7">
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3">
        {thread.isLoading ? (
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        ) : (thread.data?.messages.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground">No messages in this thread yet.</p>
        ) : (
          thread.data!.messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="mr-2 text-xs font-medium text-muted-foreground">
                {m.from_candidate ? candidateName : "TaaSFlow"}
              </span>
              <span className="whitespace-pre-line">{m.body}</span>
            </div>
          ))
        )}
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (send.isPending) return;
          if (body.trim()) send.mutate(body.trim());
        }}
      >
        <label htmlFor={`reply-${candidateUserId}`} className="sr-only">
          Reply to {candidateName}
        </label>
        <Textarea
          id={`reply-${candidateUserId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Write a reply…"
          className="flex-1"
          disabled={send.isPending}
        />
        <Button type="submit" disabled={!body.trim() || send.isPending}>
          {send.isPending ? "Sending…" : "Send reply"}
        </Button>
      </form>
    </div>
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

