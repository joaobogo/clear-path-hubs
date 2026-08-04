import * as React from "react";
import { Check, RotateCcw, ThumbsDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreviewFrame } from "@/components/marketing/product-preview/preview-frame";
import {
  PREVIEW_DECISION_QUEUE,
  PREVIEW_ROLE,
  type PreviewCandidate,
} from "@/lib/previews/representative-fixtures";

/**
 * Decision Workspace preview — the queue and the side-by-side comparison, with
 * the real product's reversible decision behaviour. Static fixtures only.
 */

type Decision = "accepted" | "declined" | null;

function BandBadge({ band }: { band: PreviewCandidate["band"] }) {
  return (
    <Badge variant={band === "Top fit" ? "default" : "outline"} className="shrink-0">
      {band}
    </Badge>
  );
}

function CandidateRow({
  candidate,
  decision,
  onDecide,
  compact,
}: {
  candidate: PreviewCandidate;
  decision: Decision;
  onDecide: (d: Decision) => void;
  compact?: boolean;
}) {
  return (
    <li className="min-w-0 rounded-xl border border-border/70 bg-background p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{candidate.ref}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {candidate.requirementsMet} · {candidate.stage}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-base font-semibold tabular-nums text-foreground">
            {candidate.score}
          </span>
          <BandBadge band={candidate.band} />
        </div>
      </div>

      <ul className="mt-2 space-y-1.5">
        {(compact ? candidate.evidence.slice(0, 1) : candidate.evidence).map((line) => (
          <li key={line} className="flex gap-2 text-xs leading-snug text-foreground/85">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">“{line}”</span>
          </li>
        ))}
        <li className="flex gap-2 text-xs leading-snug text-muted-foreground">
          <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
          <span className="min-w-0">Gap: {candidate.gap}</span>
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {decision ? (
          <>
            <span className="text-xs font-medium text-foreground">
              {decision === "accepted" ? "Moved to interview" : "Declined with reason"}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onDecide(null)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Undo
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => onDecide("accepted")}>
              <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDecide("declined")}>
              <ThumbsDown className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Decline
            </Button>
            <span className="text-[11px] text-muted-foreground">Reversible for 5 minutes</span>
          </>
        )}
      </div>
    </li>
  );
}

export function DecisionWorkspacePreview({ className }: { className?: string }) {
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});
  const pending = PREVIEW_DECISION_QUEUE.filter((c) => !decisions[c.ref]).length;

  const decide = (ref: string) => (d: Decision) =>
    setDecisions((prev) => ({ ...prev, [ref]: d }));

  return (
    <PreviewFrame
      title={`Decision Workspace · ${PREVIEW_ROLE.title}`}
      caption={`${pending} decision${pending === 1 ? "" : "s"} due · ${PREVIEW_ROLE.rubric}`}
      className={className}
    >
      <Tabs defaultValue="queue">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="queue" className="flex-1 sm:flex-none">
            Queue
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex-1 sm:flex-none">
            Compare
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-3">
          <ul className="space-y-2.5">
            {PREVIEW_DECISION_QUEUE.map((c) => (
              <CandidateRow
                key={c.ref}
                candidate={c}
                decision={decisions[c.ref] ?? null}
                onDecide={decide(c.ref)}
              />
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="compare" className="mt-3">
          <ul className="grid gap-2.5 md:grid-cols-2">
            {PREVIEW_DECISION_QUEUE.slice(0, 2).map((c) => (
              <CandidateRow
                key={c.ref}
                candidate={c}
                decision={decisions[c.ref] ?? null}
                onDecide={decide(c.ref)}
                compact
              />
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </PreviewFrame>
  );
}
