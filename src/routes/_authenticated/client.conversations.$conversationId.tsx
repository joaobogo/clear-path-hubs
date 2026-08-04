import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getConversation } from "@/lib/conversations.functions";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { ConversationThread } from "@/components/comms/conversation-thread";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase, User } from "lucide-react";
import { ErrorState } from "@/components/client/states";

export const Route = createFileRoute("/_authenticated/client/conversations/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation · Client workspace" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "A single threaded conversation scoped to one role or candidate.",
      },
    ],
  }),
  component: ConversationDetail,
});

function ConversationDetail() {
  const { conversationId } = Route.useParams();
  const orgSearch = useClientOrgSearch();
  const support = useSupportView();
  const loadFn = useServerFn(getConversation);
  const ctxFn = useServerFn(getClientContext);

  const convoQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => loadFn({ data: { conversationId } }),
  });
  const data = convoQuery.data;
  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });

  const isViewer = ctx?.active?.role === "client_viewer";
  const canPost = !support.readOnly && !isViewer;
  const convo = data?.conversation;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link
              to="/client/conversations"
              search={orgSearch ? { org: orgSearch } : undefined}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> All conversations
            </Link>
          </Button>
          <h1 className="truncate text-xl font-semibold">{convo?.subject ?? "Conversation"}</h1>
          {convo?.context_label && (
            <p className="mt-0.5 text-sm text-muted-foreground">{convo.context_label}</p>
          )}
        </div>
        {convo?.scope === "position" && convo.position_id && (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/client/positions/$id"
              params={{ id: convo.position_id }}
              search={orgSearch ? { org: orgSearch } : undefined}
            >
              <Briefcase className="mr-2 h-4 w-4" /> Open role
            </Link>
          </Button>
        )}
        {convo?.scope === "candidate" && convo.candidate_match_id && (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/client/candidates/$id"
              params={{ id: convo.candidate_match_id }}
              search={orgSearch ? { org: orgSearch } : undefined}
            >
              <User className="mr-2 h-4 w-4" /> Open candidate
            </Link>
          </Button>
        )}
      </div>

      {convoQuery.isError ? (
        <ErrorState
          title="We couldn't load this conversation"
          onRetry={() => void convoQuery.refetch()}
        />
      ) : (
        <ConversationThread
          conversationId={conversationId}
          canPost={canPost}
          heightClass="h-[calc(100vh-16rem)]"
        />
      )}
    </div>
  );
}
