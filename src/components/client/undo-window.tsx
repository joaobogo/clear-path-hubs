import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { listReversibleDecisions, undoClientDecision } from "@/lib/client-decisions.functions";
import type { MatchStage } from "@/lib/client-kpi.server";
import { Button } from "@/components/ui/button";

/** Plain-language name for a decision the client can still take back. */
const DECISION_LABEL: Record<string, string> = {
  shortlist: "Shortlisted",
  request_interview: "Interview requested",
  offer: "Moved to offer",
  hire: "Marked hired",
  hold: "Placed on hold",
  not_moving_forward: "Declined",
  request_information: "More information requested",
  request_contact_release: "Contact release requested",
  feedback: "Feedback sent",
};

function countdown(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A visible, refresh-proof Undo for every decision inside its reversal window.
 *
 * The toast disappears; this does not. Both the decision and the reversal stay
 * on the record — undoing marks the decision reversed, it never erases it.
 */
export function UndoWindow({
  orgId,
  matchId,
  candidateName,
}: {
  orgId: string | null | undefined;
  matchId: string;
  candidateName: string;
}) {
  const listFn = useServerFn(listReversibleDecisions);
  const undoFn = useServerFn(undoClientDecision);
  const qc = useQueryClient();
  const [now, setNow] = React.useState(() => Date.now());
  const [pending, setPending] = React.useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["client-reversible", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  const entry = rows.find((r) => r.match_id === matchId);
  const msLeft = entry ? new Date(entry.expires_at).getTime() - now : 0;

  React.useEffect(() => {
    if (!entry) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [entry]);

  if (!entry || msLeft <= 0 || !orgId) return null;

  async function run() {
    if (!entry || !orgId) return;
    setPending(true);
    try {
      await undoFn({
        data: {
          orgId,
          matchId,
          toStage: (entry.from_stage ?? "delivered") as MatchStage,
          decisionId: entry.id,
        },
      });
      toast.success("Decision undone", {
        description: `${candidateName} is back where they were. Both the decision and the reversal are on the record.`,
      });
      await qc.invalidateQueries();
    } catch {
      toast.error("That decision can no longer be undone. Your recruiter can reverse it for you.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">
          {DECISION_LABEL[entry.decision] ?? "Decision recorded"}
        </span>{" "}
        · you can take this back for {countdown(msLeft)}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="ml-auto h-8 gap-1.5"
        disabled={pending}
        onClick={() => void run()}
      >
        <Undo2 className="h-3.5 w-3.5" />
        {pending ? "Undoing…" : "Undo"}
      </Button>
    </div>
  );
}
