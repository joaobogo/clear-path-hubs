import { Link } from "@tanstack/react-router";
import { MessageSquare, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const ACTIONS_BY_STAGE: Record<
  MatchStage,
  { primary: ActionDef | null; more: ActionDef[] }
> = {
  delivered: {
    primary: null,
    more: [...COMMON_MORE],
  },
  shortlisted: {
    primary: null,
    more: [...COMMON_MORE],
  },
  interview_process: {
    primary: null,
    more: [...COMMON_MORE],
  },
  offer: {
    primary: null,
    more: [{ key: "submit_feedback", label: "Add feedback" }],
  },
  hired: { primary: null, more: [{ key: "submit_feedback", label: "Add feedback" }] },
  not_moving_forward: {
    primary: null,
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
  activeInterviewId?: string | null;
  /** True when the fit band is "Not recommended": evidence leads, not advancing. */
  notRecommended?: boolean;
}) {
  const forSubject = subject ? ` for ${subject}` : "";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm ring-1 ring-primary/5">
      <div className="mb-3 flex items-center justify-between gap-2">
        {/* The stage is named once, as the chip beside the candidate's name. */}
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground/90">
          Candidate tools
        </h2>
      </div>
      {stage === "hired" ? (
        <p className="text-sm text-muted-foreground">Candidate marked as hired. 🎉</p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          Recruitment stages are updated from the Candidates Kanban board.
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/client/candidates" search={{ view: "board" }}>
            View candidate Kanban
          </Link>
        </Button>
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
              {actions.more.map((a) => (
                <div key={a.key}>
                  <DropdownMenuItem onSelect={() => onAct(a.key)} disabled={pending}>
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
