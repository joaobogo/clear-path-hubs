import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ensureConversation } from "@/lib/conversations.functions";
import { ConversationThread } from "@/components/comms/conversation-thread";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The role's single client-visible thread, embedded on the role page.
 *
 * One thread per role: this resolves (or creates) that thread rather than
 * starting a new conversation each visit, so context stays in one place.
 */
export function RoleMessagesPanel({
  orgId,
  positionId,
  positionTitle,
  canPost = true,
}: {
  orgId: string;
  positionId: string;
  positionTitle?: string;
  canPost?: boolean;
}) {
  const ensureFn = useServerFn(ensureConversation);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    ensureFn({
      data: {
        orgId,
        scope: "position" as const,
        positionId,
        ...(positionTitle ? { subject: positionTitle.slice(0, 160) } : {}),
      },
    })
      .then((res) => {
        if (live) setConversationId(res.id);
      })
      .catch(() => {
        if (live) setError("We could not open the thread for this role.");
      });
    return () => {
      live = false;
    };
  }, [ensureFn, orgId, positionId, positionTitle, attempt]);

  return (
    <section aria-label="Messages" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Messages</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One thread for this role. Ask for more candidates, request a brief change, or flag
            urgency — your TaaSFlow team replies here.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/client/conversations">All conversations</Link>
        </Button>
      </div>

      <div className="mt-4">
        {error ? (
          <div className="rounded-lg border p-6 text-center" role="alert">
            <p className="text-sm font-medium">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </Button>
          </div>
        ) : !conversationId ? (
          <Skeleton className="h-[420px] w-full rounded-lg" />
        ) : (
          <ConversationThread
            conversationId={conversationId}
            canPost={canPost}
            heightClass="h-[480px]"
            emptyPrompt={`No messages yet on ${positionTitle ?? "this role"}. Ask for more candidates, request a change to the brief, or flag urgency.`}
          />
        )}
      </div>
    </section>
  );
}
