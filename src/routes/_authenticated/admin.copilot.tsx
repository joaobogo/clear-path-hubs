import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bot, Send, RotateCcw, User2, Wrench, ExternalLink, Sparkles, ShieldCheck } from "lucide-react";
import {
  askCopilot,
  executeCopilotAction,
  getCopilotState,
  resetCopilot,
} from "@/lib/admin-copilot.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/copilot")({
  head: () => ({
    meta: [
      { title: "Admin copilot · TaaSFlow" },
      {
        name: "description",
        content:
          "Internal recruiting copilot for the TaaSFlow ops team — client portfolios, candidate histories, blocked roles, stalled interviews, missing approvals, rediscovery, drafts, source performance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm text-muted-foreground">Not found.</div>,
  component: CopilotPage,
});

interface Citation { kind: string; id: string; label: string; href?: string }
interface ProposedAction {
  kind: "navigate" | "draft_client_update" | "draft_candidate_outreach";
  action_id: string;
  label: string;
  description: string;
  href?: string;
  org_id?: string;
  match_id?: string;
  draft_body?: string;
}
interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_trace: Array<{ name: string; args: Record<string, string | number | boolean | null> }>;
  citations: Citation[];
  proposed_actions?: ProposedAction[];
  confidence?: "high" | "medium" | "low" | "none" | null;
  created_at: string;
}

const SUGGESTED = [
  "Summarize my top 5 clients this week",
  "Which roles are blocked?",
  "Find stalled interviews",
  "Show me pending client approvals",
  "Suggest rediscovery candidates",
  "How is each source performing?",
];

function CopilotPage() {
  const stateFn = useServerFn(getCopilotState);
  const askFn = useServerFn(askCopilot);
  const resetFn = useServerFn(resetCopilot);
  const execFn = useServerFn(executeCopilotAction);
  const qc = useQueryClient();

  const [input, setInput] = useState("");
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const state = useQuery({
    queryKey: ["admin-copilot-state"],
    queryFn: () => stateFn(),
  });

  const ask = useMutation({
    mutationFn: (message: string) => askFn({ data: { message } }),
    onSuccess: (res) => {
      qc.setQueryData(["admin-copilot-state"], (prev: unknown) => {
        const p = prev as { conversation_id: string; messages: Msg[] } | undefined;
        if (!p) return prev;
        return { ...p, messages: [...p.messages, res.user_message as unknown as Msg, res.assistant_message as unknown as Msg] };
      });
      setInput("");
      setTimeout(() => composerRef.current?.focus(), 30);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-copilot-state"] });
      setInput("");
      toast.success("Started a new conversation");
      setTimeout(() => composerRef.current?.focus(), 30);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const messages: Msg[] = useMemo(() => {
    const base = (state.data?.messages ?? []) as unknown as Msg[];
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

  useEffect(() => { composerRef.current?.focus(); }, []);

  const runAction = async (a: ProposedAction) => {
    setRunningActionId(a.action_id);
    try {
      if (a.kind === "navigate") {
        if (a.href) window.location.assign(a.href);
        setDismissed((s) => new Set(s).add(a.action_id));
        return;
      }
      const body = drafts[a.action_id] ?? a.draft_body ?? "";
      if (!body.trim()) { toast.error("Draft is empty"); return; }
      await execFn({
        data: {
          action: {
            kind: a.kind,
            action_id: a.action_id,
            org_id: a.org_id,
            match_id: a.match_id,
            draft_body: body,
          },
        },
      });
      toast.success(a.kind === "draft_client_update" ? "Update sent to client thread" : "Outreach sent to candidate thread");
      setDismissed((s) => new Set(s).add(a.action_id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setRunningActionId(null);
    }
  };

  const submit = () => {
    const t = input.trim();
    if (!t || ask.isPending) return;
    ask.mutate(t);
  };

  return (
    <main className="mx-auto flex h-[calc(100vh-var(--workspace-header-h,72px))] max-w-4xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 py-4 sm:py-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <Bot className="h-6 w-6 text-primary" aria-hidden />
            Admin copilot
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recruiting copilot for the ops team. Grounded in TaaSFlow data. Drafts require your approval.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Staff-only
          </span>
          <Button variant="outline" size="sm" onClick={() => reset.mutate()} disabled={reset.isPending}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> New conversation
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-xl border bg-card/50 p-4 sm:p-6">
        {state.isPending ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : messages.length === 0 ? (
          <EmptyState onPick={(t) => setInput(t)} />
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.id}
              m={m}
              runAction={runAction}
              runningActionId={runningActionId}
              dismissed={dismissed}
              drafts={drafts}
              setDraft={(id, v) => setDrafts((d) => ({ ...d, [id]: v }))}
            />
          ))
        )}
        {ask.isPending && <Typing />}
      </div>

      <div className="sticky bottom-0 mt-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-1.5 pb-2">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              type="button"
              disabled={ask.isPending}
              onClick={() => { setInput(q); composerRef.current?.focus(); }}
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={1}
            placeholder="Ask about clients, candidates, blocked roles, stalled interviews, source performance…"
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
      <h2 className="mt-3 text-lg font-medium">Ask the admin copilot</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Grounded answers, cited records, and reviewable drafts — nothing is sent until you approve.
      </p>
      <ul className="mt-5 grid gap-2 text-left">
        {SUGGESTED.map((q) => (
          <li key={q}>
            <button className="w-full rounded-lg border bg-background px-3 py-2 text-sm transition hover:bg-muted" onClick={() => onPick(q)}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Typing() {
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
    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs ${isUser ? "bg-muted" : "bg-primary/10 text-primary"}`}>
      {isUser ? <User2 className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
    </div>
  );
}

interface BubbleProps {
  m: Msg;
  runAction: (a: ProposedAction) => void | Promise<void>;
  runningActionId: string | null;
  dismissed: Set<string>;
  drafts: Record<string, string>;
  setDraft: (id: string, v: string) => void;
}

function Bubble({ m, runAction, runningActionId, dismissed, drafts, setDraft }: BubbleProps) {
  const isUser = m.role === "user";
  const rendered = useMemo(() => renderWithCitations(m.content, m.citations), [m.content, m.citations]);
  const actions = (m.proposed_actions ?? []).filter((a) => !dismissed.has(a.action_id));

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar role={m.role} />
      <div className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm ${isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-background"}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
        ) : (
          <>
            {m.tool_trace.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {m.tool_trace.map((t, i) => (
                  <Badge key={`${t.name}-${i}`} variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-[10px] font-normal text-primary">
                    <Wrench className="h-2.5 w-2.5" />
                    {prettyTool(t.name)}
                  </Badge>
                ))}
              </div>
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown>{rendered.text}</ReactMarkdown>
            </div>
            {rendered.used.length > 0 && (
              <div className="mt-2 border-t border-border/60 pt-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sources</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {rendered.used.map((c) => (
                    <li key={`${c.kind}:${c.id}`}>
                      {c.href ? (
                        <a href={c.href} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] hover:bg-muted">
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
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Proposed actions — you approve</p>
                {actions.map((a) => {
                  const running = runningActionId === a.action_id;
                  const isDraft = a.kind !== "navigate";
                  return (
                    <div key={a.action_id} className="rounded-lg border bg-muted/30 p-2.5">
                      <p className="text-xs font-medium">{a.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{a.description}</p>
                      {isDraft && (
                        <Textarea
                          rows={5}
                          className="mt-2 text-[12px]"
                          value={drafts[a.action_id] ?? a.draft_body ?? ""}
                          onChange={(e) => setDraft(a.action_id, e.target.value)}
                          disabled={running}
                        />
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" onClick={() => runAction(a)} disabled={running || runningActionId !== null}>
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

function renderWithCitations(content: string, citations: Citation[]) {
  const byKey = new Map(citations.map((c) => [`${c.kind}:${c.id}`, c]));
  const used: Citation[] = [];
  const seen = new Map<string, number>();
  const text = content.replace(/\[\[([a-z_]+):([a-f0-9-]{6,})\]\]/gi, (_m, kind, id) => {
    const key = `${kind.toLowerCase()}:${id}`;
    const c = byKey.get(key);
    if (!c) return "";
    if (!seen.has(key)) { used.push(c); seen.set(key, used.length); }
    return ` [${seen.get(key)}]`;
  });
  return { text, used };
}

function prettyTool(name: string) {
  switch (name) {
    case "summarize_client_portfolio": return "Client portfolio";
    case "summarize_candidate_history": return "Candidate history";
    case "blocked_roles": return "Blocked roles";
    case "stalled_interviews": return "Stalled interviews";
    case "missing_approvals": return "Missing approvals";
    case "rediscovery_candidates": return "Rediscovery";
    case "draft_client_update": return "Client update draft";
    case "draft_candidate_outreach": return "Outreach draft";
    case "source_performance": return "Source performance";
    default: return name;
  }
}
