import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { findConversation } from "@/lib/conversations.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { DraftConversationThread } from "@/components/comms/draft-conversation-thread";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { QueryErrorCard } from "@/components/client/query-error";

// A conversation needs a workspace and something to be about. Those two were
// REQUIRED here with no fallback, so a bare /client/conversations/new — or any
// truncated link — threw out of validateSearch and rendered the
// form-submission error boundary on a page with no form (audit 17 Sep, item 1).
// They fall back now, and the component sends an incomplete link to the
// conversations list instead of failing at it.
const searchSchema = z.object({
  org: fallback(z.string().uuid().optional(), undefined),
  scope: fallback(z.enum(["organization", "position", "candidate"]).optional(), undefined),
  positionId: fallback(z.string().uuid().optional(), undefined),
  candidateMatchId: fallback(z.string().uuid().optional(), undefined),
  subject: fallback(z.string().optional(), undefined),
  preview: fallback(z.string().optional(), undefined),
});

export const Route = createFileRoute("/_authenticated/client/conversations/new")({
  validateSearch: zodValidator(searchSchema),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.conversations.new.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  head: () => ({
    meta: [
      { title: "New conversation · Client workspace" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Start a new conversation with your TaaSFlow recruiter.",
      },
    ],
  }),
  component: NewConversation,
});

function NewConversation() {
  const search = Route.useSearch();
  const orgSearch = useClientOrgSearch();
  const findFn = useServerFn(findConversation);

  // Both are guaranteed present by `enabled`; the assertions below only tell
  // TypeScript what the guard already decided.
  const linkIsComplete = Boolean(search.org && search.scope);

  const findQuery = useQuery({
    queryKey: ["find-conversation", search],
    queryFn: () =>
      findFn({
        data: {
          orgId: search.org!,
          scope: search.scope!,
          positionId: search.positionId,
          candidateMatchId: search.candidateMatchId,
          subject: search.subject,
        },
      }),
    enabled: linkIsComplete,
    staleTime: 5 * 60 * 1000,
  });

  const resolvedOrg = orgSearch ?? search.org;

  // An incomplete link is a link, not a rejected form. Send them to the list
  // they were trying to start a conversation from.
  if (!linkIsComplete) {
    return (
      <Navigate
        to="/client/conversations"
        search={resolvedOrg ? { org: resolvedOrg } : {}}
        replace
      />
    );
  }

  if (findQuery.data?.id) {
    return (
      <Navigate
        to="/client/conversations/$conversationId"
        params={{ conversationId: findQuery.data.id }}
        search={{ org: resolvedOrg, preview: search.preview }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link
              to="/client/conversations"
              search={resolvedOrg ? { org: resolvedOrg } : undefined}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> All conversations
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">
            {search.subject ?? "New conversation"}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your first message will create this thread.
          </p>
        </div>
      </div>

      {findQuery.isError ? (
        <QueryErrorCard
          title="We couldn't check for an existing thread"
          error={findQuery.error}
          onRetry={() => findQuery.refetch()}
          retrying={findQuery.isFetching}
        />
      ) : (
        <DraftConversationThread
          orgId={search.org!}
          scope={search.scope!}
          positionId={search.positionId}
          candidateMatchId={search.candidateMatchId}
          subject={search.subject}
          preview={search.preview}
          heightClass="h-[calc(100dvh-19rem)] md:h-[calc(100dvh-16rem)]"
        />
      )}
    </div>
  );
}
