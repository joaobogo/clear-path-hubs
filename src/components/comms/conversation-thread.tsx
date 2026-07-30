import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getConversation,
  markConversationRead,
  postConversationMessage,
} from "@/lib/conversations.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

function dayLabel(iso: string) {
  const day = new Date(iso).toDateString();
  if (day === new Date().toDateString()) return "Today";
  if (day === new Date(Date.now() - 86_400_000).toDateString()) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ConversationThread({
  conversationId,
  canPost = true,
  className,
  heightClass = "h-[520px]",
}: {
  conversationId: string;
  canPost?: boolean;
  className?: string;
  heightClass?: string;
}) {
  const qc = useQueryClient();
  const loadFn = useServerFn(getConversation);
  const postFn = useServerFn(postConversationMessage);
  const readFn = useServerFn(markConversationRead);
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => loadFn({ data: { conversationId } }),
    placeholderData: (prev) => prev,
  });

  // Realtime: new messages land in this thread without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
          qc.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  // Mark read whenever the visible tail changes.
  const lastAt = data?.messages.at(-1)?.created_at ?? null;
  useEffect(() => {
    if (!lastAt) return;
    readFn({ data: { conversationId } })
      .then(() => qc.invalidateQueries({ queryKey: ["conversations"] }))
      .catch(() => {});
  }, [conversationId, lastAt, readFn, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lastAt, isLoading]);

  const send = useMutation({
    mutationFn: (text: string) => postFn({ data: { conversationId, body: text } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Could not send";
      toast.error(
        msg.includes("SUPPORT_VIEW_READ_ONLY")
          ? "Support view is read-only — start an interactive session to reply."
          : msg.includes("forbidden")
            ? "You don't have permission to post in this thread."
            : "Message not sent. Try again.",
      );
    },
  });

  const groups = useMemo(() => {
    const out: Array<{ label: string; items: NonNullable<typeof data>["messages"] }> = [];
    for (const m of data?.messages ?? []) {
      const label = dayLabel(m.created_at);
      const bucket = out.at(-1);
      if (bucket && bucket.label === label) bucket.items.push(m);
      else out.push({ label, items: [m] });
    }
    return out;
  }, [data]);

  return (
    <div className={cn("flex flex-col rounded-lg border bg-card", heightClass, className)}>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {isLoading && !data ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversation…
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything said about this thread stays here — and mirrors to email.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{g.label}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {g.items.map((m) => (
                <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] space-y-1", m.mine && "text-right")}>
                    <div
                      className={cn(
                        "flex items-center gap-2 text-xs text-muted-foreground",
                        m.mine && "justify-end",
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {m.mine ? "You" : m.sender_name}
                      </span>
                      {m.sender_side === "taasflow" && !m.mine && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                          TaaSFlow
                        </Badge>
                      )}
                      <span className="tabular-nums">{timeLabel(m.created_at)}</span>
                    </div>
                    <div
                      className={cn(
                        "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                        m.mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3">
        {canPost ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = body.trim();
              if (!text || send.isPending) return;
              send.mutate(text);
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  const text = body.trim();
                  if (text && !send.isPending) send.mutate(text);
                }
              }}
              placeholder="Write a message… everyone on this thread is notified by email."
              className="min-h-[64px] resize-none"
              maxLength={4000}
            />
            <Button type="submit" disabled={!body.trim() || send.isPending} className="shrink-0">
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            You have view-only access to this conversation.
          </p>
        )}
      </div>
    </div>
  );
}
