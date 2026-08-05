import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  Bot,
  Send,
  RotateCcw,
  User2,
  Wrench,
  ExternalLink,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  askAssistant,
  executeAssistantAction,
  getAssistantState,
  resetAssistant,
} from "@/lib/assistant.functions";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";

export const Route = createFileRoute("/_authenticated/client/assistant")({
  head: () => ({
    meta: [
      { title: "Pipeline assistant · TaaSFlow" },
      {
        name: "description",
        content:
          "Ask TaaSFlow's grounded assistant about weekly changes, review queues, best-fit candidates, score explainability, role blockers, and what to do next — every answer cites source records.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.assistant.tsx"),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: AssistantPage,
});

interface Citation {
  kind: string;
  id: string;
  label: string;
  href?: string;
}
interface ProposedAction {
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
interface MessageRow {
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

const SUGGESTED = [
  "What changed this week?",
  "Who needs review right now?",
  "What should I do next?",
  "What is blocking my open roles?",
  "Who best fits SQL experience?",
];

function AssistantPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const stateFn = useServerFn(getAssistantState);
  const askFn = useServerFn(askAssistant);
  const resetFn = useServerFn(resetAssistant);
  const execFn = useServerFn(executeAssistantAction);
  const qc = useQueryClient();
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const [editedDrafts, setEditedDrafts] = useState<Record<string, string>>({});

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id;

  const state = useQuery({
    queryKey: ["assistant-state", orgId],
    queryFn: () => stateFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const stateQuery = useQueryState(state);

  const ask = useMutation({
    mutationFn: (message: string) => askFn({ data: { orgId: orgId!, message } }),
    onSuccess: (res) => {
      qc.setQueryData(["assistant-state", orgId], (prev: unknown) => {
        const p = prev as { conversation_id: string; messages: MessageRow[] } | undefined;
        if (!p) return prev;
        return {
          ...p,
          messages: [...p.messages, res.user_message as unknown as MessageRow, res.assistant_message as unknown as MessageRow],
        };
      });
      setInput("");
      setTimeout(() => composerRef.current?.focus(), 30);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { orgId: orgId! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-state", orgId] });
      setInput("");
      toast.success("Started a new conversation");
      setTimeout(() => composerRef.current?.focus(), 30);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Optimistic user echo
  const messages: MessageRow[] = useMemo(() => {
    const base = (state.data?.messages ?? []) as unknown as MessageRow[];
    if (!ask.isPending) return base;
    return [
      ...base,
      {
        id: "__pending_user__",
        role: "user",
        content: ask.variables ?? "",
        tool_trace: [],
        citations: [],
        proposed_actions: [],
        created_at: new Date().toISOString(),
      },
    ];
  }, [state.data?.messages, ask.isPending, ask.variables]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, ask.isPending]);

  useEffect(() => {
    composerRef.current?.focus();
  }, [orgId]);

  const runAction = async (action: ProposedAction) => {
    if (!orgId) return;
    setRunningActionId(action.action_id);
    try {
      if (action.kind === "navigate") {
        if (action.href) window.location.assign(action.href);
        setDismissedActions((s) => new Set(s).add(action.action_id));
        return;
      }
      if (action.kind === "draft_interview_request") {
        const body = editedDrafts[action.action_id] ?? action.draft_body ?? "";
        if (!body.trim()) {
          toast.error("Draft is empty");
          return;
        }
        await execFn({
          data: {
            orgId,
            action: {
              kind: "draft_interview_request",
              action_id: action.action_id,
              match_id: action.match_id!,
              draft_body: body,
            },
          },
        });
        toast.success("Interview request sent to the TaaSFlow team");
        setDismissedActions((s) => new Set(s).add(action.action_id));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setRunningActionId(null);
    }
  };


  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || !orgId || ask.isPending) return;
    ask.mutate(trimmed);
  };

  if (ctxQuery.isError) {
    return (
      <div className="p-8">
        <QueryErrorCard
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }

  if (!orgId) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto flex h-[calc(100vh-var(--workspace-header-h,72px))] max-w-4xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 py-4 sm:py-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Bot className="h-6 w-6 text-primary" aria-hidden />
            Pipeline assistant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grounded in your TaaSFlow data. Permission-aware. Every answer cites the
            records it used.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Sees only what you can see
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> New conversation
          </Button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border bg-card/50 p-4 sm:p-6"
      >
        {stateQuery.isError ? (
          <QueryErrorCard
            error={stateQuery.error}
            onRetry={stateQuery.retry}
            retrying={stateQuery.retrying}
          />
        ) : state.isPending ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : messages.length === 0 ? (
          <EmptyState onPick={(t) => setInput(t)} />
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              runAction={runAction}
              runningActionId={runningActionId}
              dismissed={dismissedActions}
              editedDrafts={editedDrafts}
              setDraft={(id, v) => setEditedDrafts((d) => ({ ...d, [id]: v }))}
            />
          ))
        )}
        {ask.isPending && <TypingIndicator />}
      </div>

      <div className="sticky bottom-0 mt-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-1.5 pb-2">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              type="button"
              disabled={ask.isPending}
              onClick={() => {
                setInput(q);
                composerRef.current?.focus();
              }}
              className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            ref={composerRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask about weekly changes, review queues, best-fit candidates, blockers, or next steps…"
            className="min-h-[42px] flex-1 resize-none"
            disabled={ask.isPending}
          />
          <Button onClick={submit} disabled={!input.trim() || ask.isPending}>
            <Send className="mr-1 h-3.5 w-3.5" /> Send
          </Button>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" aria-hidden />
      <h2 className="mt-3 text-lg font-medium">Ask about your pipeline</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The assistant only answers using your TaaSFlow records — it will cite each
        one so you can jump straight to the source.
      </p>
      <ul className="mt-5 grid gap-2 text-left">
        {SUGGESTED.map((q) => (
          <li key={q}>
            <button
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm transition hover:bg-muted"
              onClick={() => onPick(q)}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <Avatar role="assistant" />
      <div className="rounded-2xl rounded-tl-sm border bg-background px-3 py-2 text-sm text-muted-foreground">
        <span className="inline-flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
        </span>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" | "system" }) {
  const isUser = role === "user";
  return (
    <div
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs ${
        isUser ? "bg-muted" : "bg-primary/10 text-primary"
      }`}
    >
      {isUser ? <User2 className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </div>
  );
}

interface MessageBubbleProps {
  m: MessageRow;
  runAction: (a: ProposedAction) => void | Promise<void>;
  runningActionId: string | null;
  dismissed: Set<string>;
  editedDrafts: Record<string, string>;
  setDraft: (id: string, v: string) => void;
}

function MessageBubble({ m, runAction, runningActionId, dismissed, editedDrafts, setDraft }: MessageBubbleProps) {
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

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" | "none" }) {
  const styles: Record<string, string> = {
    high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    low: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    none: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
    none: "Insufficient data",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-normal ${styles[level]}`}>
      {labels[level]}
    </Badge>
  );
}
