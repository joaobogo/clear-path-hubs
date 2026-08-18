import { Link } from "@tanstack/react-router";
import { Loader2, MessageSquare, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clientStageLabel } from "@/lib/client-stage-labels";
import type { MatchStage } from "@/lib/client-kpi.server";

// ─── Stage → primary + secondary actions ─────────────────────────────────────

export type ActionKey =
  | "shortlist"
  | "request_interview"
  | "request_more_information"
  | "hold"
  | "request_contact_release"
  | "submit_feedback"
  | "not_moving_forward"
  | "offer"
  | "hire";

export type ActionDef = { key: ActionKey; label: string };

export const COMMON_MORE: ActionDef[] = [
  { key: "request_more_information", label: "Request more information" },
  { key: "hold", label: "Put on hold" },
  { key: "submit_feedback", label: "Add feedback" },
  { key: "request_contact_release", label: "Request contact details" },
];

export const ACTIONS_BY_STAGE: Record<MatchStage, { primary: ActionDef | null; more: ActionDef[] }> = {
  delivered: {
    primary: { key: "shortlist", label: "Shortlist" },
    more: [
      { key: "request_interview", label: "Request interview" },
      ...COMMON_MORE,
      { key: "not_moving_forward", label: "Decline for this role" },
    ],
  },
  shortlisted: {
    primary: { key: "request_interview", label: "Request interview" },
    more: [...COMMON_MORE, { key: "not_moving_forward", label: "Decline for this role" }],
  },
  interview_process: {
    primary: { key: "offer", label: "Extend offer" },
    more: [...COMMON_MORE, { key: "not_moving_forward", label: "Decline for this role" }],
  },
  offer: {
    primary: { key: "hire", label: "Mark hired" },
    more: [
      { key: "submit_feedback", label: "Add feedback" },
      { key: "not_moving_forward", label: "Decline for this role" },
    ],
  },
  hired: { primary: null, more: [{ key: "submit_feedback", label: "Add feedback" }] },
  not_moving_forward: {
    primary: { key: "shortlist", label: "Re-open — shortlist" },
    more: [{ key: "submit_feedback", label: "Add feedback" }],
  },
};

export function ActionArea({
  actions,
  readOnly,
  pending,
  onAct,
  stage,
  matchId,
  pendingKey,
  subject,
}: {
  actions: { primary: ActionDef | null; more: ActionDef[] };
  readOnly: boolean;
  pending: boolean;
  onAct: (k: ActionKey) => void;
  stage: MatchStage;
  matchId: string;
  pendingKey?: ActionKey | null;
  /** Who/what the actions apply to, e.g. "Maria Santos for Front Desk Lead". */
  subject?: string;
}) {
  const forSubject = subject ? ` for ${subject}` : "";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm ring-1 ring-primary/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/90">Stage actions</h2>
        <Badge variant="outline" className="tabular-nums">
          {clientStageLabel(stage)}
        </Badge>
      </div>
      {stage === "hired" ? (
        <p className="text-sm text-muted-foreground">Candidate marked as hired. 🎉</p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          Recommend the next move for this candidate. Every decision is logged.
        </p>
      )}
      <div className="flex items-center gap-2">
        {actions.primary && (
          <Button
            className="flex-1 min-h-11"
            disabled={readOnly || pending}
            onClick={() => onAct(actions.primary!.key)}
          >
            {pendingKey === actions.primary.key ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              actions.primary.label
            )}
          </Button>
        )}
        {actions.more.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={`More actions${forSubject}`}
                disabled={readOnly}
                className="min-h-11 min-w-11"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {actions.more.map((a, i) => (
                <div key={a.key}>
                  {i > 0 && a.key === "not_moving_forward" && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onSelect={() => onAct(a.key)}
                    disabled={pending}
                    className={cn(
                      a.key === "not_moving_forward" && "text-destructive focus:text-destructive",
                    )}
                  >
                    {a.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {readOnly && (
        <p className="mt-3 text-xs text-muted-foreground">
          Actions unavailable in read-only preview.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
        <Link
          to="/client/candidates"
          search={{ compare: matchId } as never}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Add to comparison
        </Link>
        <Link
          to="/client/conversations"
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Message team
        </Link>
      </div>
    </div>
  );
}

// ─── Mobile action bar ───────────────────────────────────────────────────────

export function MobileActionBar({
  actions,
  pending,
  onAct,
  pendingKey,
  subject,
}: {
  actions: { primary: ActionDef | null; more: ActionDef[] };
  pending: boolean;
  onAct: (k: ActionKey) => void;
  pendingKey?: ActionKey | null;
  subject?: string;
}) {
  const forSubject = subject ? ` for ${subject}` : "";
  if (!actions.primary) return null;
  // Declining is a decision, not an overflow item: it stays on screen at 375px.
  const decline = actions.more.find((a) => a.key === "not_moving_forward") ?? null;
  const rest = actions.more.filter((a) => a.key !== "not_moving_forward");
  return (
    <div
      role="toolbar"
      aria-label={`Candidate actions${forSubject}`}
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur lg:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <Button
          className="min-h-11 flex-1"
          disabled={pending}
          onClick={() => onAct(actions.primary!.key)}
        >
          {pendingKey === actions.primary.key ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            actions.primary.label
          )}
        </Button>
        {decline && (
          <Button
            variant="outline"
            className="min-h-11 shrink-0 text-destructive hover:text-destructive"
            disabled={pending}
            onClick={() => onAct(decline.key)}
          >
            Not a fit
          </Button>
        )}
        {rest.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={`More actions${forSubject}`}
                className="min-h-11 min-w-11 shrink-0"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              {rest.map((a, i) => (
                <div key={a.key}>
                  {i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onSelect={() => onAct(a.key)} disabled={pending}>
                    {a.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
