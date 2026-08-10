import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { Bot, Send, RotateCcw, Sparkles, ShieldCheck } from "lucide-react";
import {
  askAssistant,
  executeAssistantAction,
  getAssistantState,
  resetAssistant,
} from "@/lib/assistant.functions";
import { getClientContext } from "@/lib/client-context.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import {
  MessageBubble,
  type MessageRow,
  type ProposedAction,
} from "@/components/client/assistant/message-bubble";
import {
  EmptyState,
  TypingIndicator,
  SUGGESTED,
} from "@/components/client/assistant/message-parts";

const RoutePending = makeWorkspacePending({ shape: "rows", width: "7xl" });

export const Route = createFileRoute("/_authenticated/client/assistant")({
	pendingMs: 150,
	pendingComponent: RoutePending,
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
    onError: (e: Error) => toastError(e),
  });

  const reset = useMutation({
    mutationFn: () => resetFn({ data: { orgId: orgId! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assistant-state", orgId] });
      setInput("");
      toast.success("Started a new conversation");
      setTimeout(() => composerRef.current?.focus(), 30);
    },
    onError: (e: Error) => toastError(e),
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
      toastError(e, { fallback: "Action failed" });
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

  if (!orgId) return <RoutePending />;

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

