import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getClientContext,
  getClientMessages,
  sendClientMessage,
} from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { ActionGuard } from "@/components/action-guard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";


export const Route = createFileRoute("/_authenticated/client/messages")({
  head: () => ({
    meta: [
      { title: "Messages · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function MessagesPage() {
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(getClientMessages);
  const sendFn = useServerFn(sendClientMessage);
  const endRef = useRef<HTMLDivElement>(null);
  const [selfId, setSelfId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
  }, []);

  const { data: ctx } = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => ctxFn({ data: {} }),
  });
  const orgId = ctx?.active?.organization_id;

  const { data: rows = [], refetch } = useQuery({
    queryKey: ["client-messages", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`msg-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${orgId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, refetch]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows.length]);

  const send = useMutation({
    mutationFn: (b: string) => sendFn({ data: { orgId: orgId!, body: b } }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["client-messages", orgId] });
    },
    onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 flex flex-col h-[calc(100vh-4rem)]">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Direct line to the TaaSFlow team about any of your roles.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4 space-y-3">
        {rows.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            <div className="font-medium mb-1">No messages yet</div>
            <p>
              Send a note below and the TaaSFlow team will reply here. You&apos;ll get
              notified when they respond.
            </p>
          </div>
        )}
        {(rows as AnyRow[]).map((m) => {
          const mine = m.sender_user_id === selfId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.body}</div>
                <div
                  className={`text-[10px] mt-1 ${
                    mine ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate(body.trim());
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Write a message…"
          className="flex-1"
        />
        <Button type="submit" disabled={!body.trim() || send.isPending}>
          Send
        </Button>
      </form>
    </main>
  );
}
