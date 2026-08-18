import { Link } from "@tanstack/react-router";
import { MessageSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Link-out to the role's conversation.
 *
 * The thread itself lives in /client/conversations — one home for every
 * message, instead of a second inbox embedded in the role page.
 */
export function RoleMessagesPanel({
  positionTitle,
}: {
  orgId?: string;
  positionId?: string;
  positionTitle?: string;
  canPost?: boolean;
}) {
  return (
    <section
      aria-label="Messages"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Questions about {positionTitle ? `“${positionTitle}”` : "this role"}? Your TaaSFlow
          team replies in the conversation for this role.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/client/conversations">
          View conversation
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
