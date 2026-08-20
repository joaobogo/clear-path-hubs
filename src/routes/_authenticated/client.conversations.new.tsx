import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { findConversation } from "@/lib/conversations.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { DraftConversationThread } from "@/components/comms/draft-conversation-thread";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { QueryErrorCard } from "@/components/client/query-error";

const searchSchema = z.object({
  org: z.string().uuid(),
  scope: z.enum(["organization", "position", "candidate"]),
  positionId: z.string().uuid().optional(),
  candidateMatchId: z.string().uuid().optional(),
  subject: z.string().optional(),
  preview: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/client/conversations/new")({
  validateSearch: (search) => searchSchema.parse(search),
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

  const findQuery = useQuery({
    queryKey: ["find-conversation", search],
    queryFn: () =>
      findFn({
        data: {
          orgId: search.org,
          scope: search.scope,
          positionId: search.positionId,
          candidateMatchId: search.candidateMatchId,
          subject: search.subject,
        },
      }),
    staleTime: 5 * 60 * 1000,
  });

  const resolvedOrg = orgSearch ?? search.org;

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
          orgId={search.org}
          scope={search.scope}
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
