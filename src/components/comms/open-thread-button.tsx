import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare } from "lucide-react";

/**
 * Entry point into the single thread for a role or a candidate.
 *
 * We no longer create an empty conversation here. The user is taken to a draft
 * composer; the thread is only created once the first message is actually sent.
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
  const search = useSearch({ strict: false }) as Record<string, any>;
  const preview = search?.preview;
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
          await navigate({
            to: "/client/conversations/new",
            search: {
              org: orgId,
              preview,
              scope,
              positionId,
              candidateMatchId,
              subject,
            },
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
