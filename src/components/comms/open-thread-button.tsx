import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ensureConversation } from "@/lib/conversations.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";

/**
 * Entry point into the single thread for a role or a candidate.
 * Creating is idempotent — there is only ever one thread per scope.
 */
export function OpenThreadButton({
  orgId,
  scope,
  positionId,
  candidateMatchId,
  subject,
  label = "Open conversation",
  variant = "outline",
  size = "sm",
  className,
}: {
  orgId: string;
  scope: "organization" | "position" | "candidate";
  positionId?: string;
  candidateMatchId?: string;
  subject?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
  className?: string;
}) {
  const navigate = useNavigate();
  const orgSearch = useClientOrgSearch() || orgId;
  const ensureFn = useServerFn(ensureConversation);
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={busy || !orgId}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await ensureFn({
            data: { orgId, scope, positionId, candidateMatchId, subject },
          });
          await navigate({
            to: "/client/conversations/$conversationId",
            params: { conversationId: res.id },
            search: { org: orgSearch },
          });
        } catch {
          // If conversation creation fails (e.g. invalid IDs), fall back to
          // the organization's general messages list rather than a dead end.
          await navigate({
            to: "/client/conversations",
            search: { org: orgSearch },
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
