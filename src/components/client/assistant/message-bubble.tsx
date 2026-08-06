import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, ConfidenceBadge } from "@/components/client/assistant/message-parts";

export interface Citation {
  kind: string;
  id: string;
  label: string;
  href?: string;
}
export interface ProposedAction {
  kind: "navigate" | "draft_interview_request";
  action_id: string;
  label: string;
  description: string;
  href?: string;
  match_id?: string;
  candidate_name?: string;
  position_title?: string;
  draft_body?: string;
}
export interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_trace: Array<{
    name: string;
    args: Record<string, string | number | boolean | null>;
  }>;
  citations: Citation[];
  proposed_actions?: ProposedAction[];
  confidence?: "high" | "medium" | "low" | "none" | null;
  created_at: string;
}

// Replace inline [[kind:id]] tokens with a compact [n] marker, and return
// the ordered list of cited records so we can render them as source pills.
function renderWithCitations(content: string, citations: Citation[]) {
  const byKey = new Map(citations.map((c) => [`${c.kind}:${c.id}`, c]));
  const used: Citation[] = [];
  const seen = new Map<string, number>();
  const text = content.replace(/\[\[([a-z_]+):([a-f0-9-]{6,})\]\]/gi, (_m, kind, id) => {
    const key = `${kind.toLowerCase()}:${id}`;
    const c = byKey.get(key);
    if (!c) return "";
    if (!seen.has(key)) {
      used.push(c);
      seen.set(key, used.length);
    }
    return ` [${seen.get(key)}]`;
  });
  return { text, used };
}

function prettyTool(name: string) {
  switch (name) {
    case "weekly_pipeline_changes":
      return "Weekly changes";
    case "matches_needing_review":
      return "Review queue";
    case "find_candidates_for_requirement":
      return "Candidate search";
    case "explain_candidate_score":
      return "Score explainability";
    case "role_blockers":
      return "Role blockers";
    case "next_actions":
      return "Next actions";
    default:
      return name;
  }
}

interface MessageBubbleProps {
  m: MessageRow;
  runAction: (a: ProposedAction) => void | Promise<void>;
  runningActionId: string | null;
  dismissed: Set<string>;
  editedDrafts: Record<string, string>;
  setDraft: (id: string, v: string) => void;
}

export function MessageBubble({ m, runAction, runningActionId, dismissed, editedDrafts, setDraft }: MessageBubbleProps) {
  const isUser = m.role === "user";
  const rendered = useMemo(() => renderWithCitations(m.content, m.citations), [m.content, m.citations]);
  const actions = (m.proposed_actions ?? []).filter((a) => !dismissed.has(a.action_id));

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar role={m.role} />
      <div
        className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm ${
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-background"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
        ) : (
          <>
            {(m.tool_trace.length > 0 || m.confidence) && (
              <div className="mb-2 flex flex-wrap items-center gap-1">
                {m.tool_trace.map((t, i) => (
                  <Badge
                    key={`${t.name}-${i}`}
                    variant="outline"
                    className="gap-1 border-primary/20 bg-primary/5 text-[10px] font-normal text-primary"
                  >
                    <Wrench className="h-2.5 w-2.5" />
                    {prettyTool(t.name)}
                  </Badge>
                ))}
                {m.confidence && <ConfidenceBadge level={m.confidence} />}
              </div>
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown>{rendered.text}</ReactMarkdown>
            </div>
            {rendered.used.length > 0 && (
              <div className="mt-2 border-t border-border/60 pt-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Sources
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {rendered.used.map((c) => (
                    <li key={`${c.kind}:${c.id}`}>
                      {c.href ? (
                        <a
                          href={c.href}
                          className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] hover:bg-muted"
                        >
                          <span className="text-muted-foreground">{c.kind}</span>
                          <span className="truncate max-w-[220px]">{c.label}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px]">
                          <span className="text-muted-foreground">{c.kind}</span>
                          <span className="truncate max-w-[220px]">{c.label}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {actions.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Proposed actions — you approve
                </p>
                {actions.map((a) => {
                  const running = runningActionId === a.action_id;
                  const isDraft = a.kind === "draft_interview_request";
                  return (
                    <div key={a.action_id} className="rounded-lg border bg-muted/30 p-2.5">
                      <p className="text-xs font-medium">{a.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.description}</p>
                      {isDraft && (
                        <Textarea
                          rows={4}
                          className="mt-2 text-[12px]"
                          value={editedDrafts[a.action_id] ?? a.draft_body ?? ""}
                          onChange={(e) => setDraft(a.action_id, e.target.value)}
                          disabled={running}
                        />
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => runAction(a)}
                          disabled={running || runningActionId !== null}
                        >
                          {running ? "Running…" : isDraft ? "Approve & send" : "Approve"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
