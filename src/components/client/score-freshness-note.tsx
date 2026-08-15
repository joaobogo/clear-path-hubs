import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw, History } from "lucide-react";
import { requestScoreRefresh } from "@/lib/client/score-refresh.functions";
import type { Freshness } from "@/lib/scoring/score-freshness";
import { Button } from "@/components/ui/button";
import {
  ACTION_TIMEOUT_MESSAGE,
  isActionTimeout,
  withActionTimeout,
} from "@/lib/client/action-timeout";

/**
 * Says out loud when a fit assessment is about facts that have since moved, why
 * it moved, and offers a reassessment. The old assessment is never rewritten
 * behind the client's back.
 */
export function ScoreFreshnessNote({
  freshness,
  orgId,
  matchId,
}: {
  freshness: Freshness | null | undefined;
  orgId: string | null | undefined;
  matchId: string;
}) {
  const ask = useServerFn(requestScoreRefresh);
  const [asked, setAsked] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: () => withActionTimeout(() => ask({ data: { orgId: orgId!, matchId } })),
    onMutate: () => setFailed(null),
    onSuccess: () => {
      setAsked(true);
      toast.success("We'll reassess this candidate against the current brief.");
    },
    onError: (e: Error) => {
      const message = isActionTimeout(e)
        ? ACTION_TIMEOUT_MESSAGE
        : "We couldn't send that request.";
      setFailed(message);
      toast.error(message);
    },
  });

  if (!freshness || freshness.state === "current") return null;

  return (
    <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
      <div className="flex items-start gap-2">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">
            {freshness.state === "stale"
              ? "This fit assessment may be out of date"
              : "We cannot confirm when this was last assessed"}
          </p>
          <p className="text-xs text-muted-foreground">{freshness.summary}</p>
          {freshness.reasons.length > 1 && (
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {freshness.reasons.map((r) => (
                <li key={r.code}>{r.label}</li>
              ))}
            </ul>
          )}
          {freshness.offer_rescore && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1 gap-1"
              disabled={!orgId || request.isPending || asked}
              onClick={() => request.mutate()}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              {asked
                ? "Reassessment requested"
                : request.isPending
                  ? "Requesting…"
                  : failed
                    ? "Try again"
                    : "Ask us to reassess"}
            </Button>
          )}
          {failed && !asked && (
            <p role="alert" className="text-xs taas-fg-warning">
              {failed} Nothing was lost — try again.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
