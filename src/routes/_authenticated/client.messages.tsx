import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
 getClientContext,
 getClientMessages,
 sendClientMessage,
} from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
 AlertCircle,
 CheckCheck,
 Info,
 MessageSquare,
 RotateCcw,
 Search,
 Send,
 X,
} from "lucide-react";

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

type PendingMessage = {
 clientId: string;
 body: string;
 createdAt: string;
 status: "sending" | "failed";
 error?: string;
};

function lastReadKey(orgId: string) {
 return `taasflow:msg:lastread:${orgId}`;
}

function relTime(iso: string): string {
 const d = new Date(iso).getTime();
 const diff = Date.now() - d;
 if (diff < 60_000) return "just now";
 if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
 if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
 return new Date(iso).toLocaleString(undefined, {
 month: "short",
 day: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 });
}

function groupByDay(rows: AnyRow[]): Array<{ label: string; items: AnyRow[] }> {
 const groups: Record<string, AnyRow[]> = {};
 const order: string[] = [];
 const today = new Date().toDateString();
 const yesterday = new Date(Date.now() - 86_400_000).toDateString();
 for (const r of rows) {
 const day = new Date(r.created_at).toDateString();
 if (!groups[day]) {
 groups[day] = [];
 order.push(day);
 }
 groups[day].push(r);
 }
 return order.map((day) => ({
 label:
 day === today
 ? "Today"
 : day === yesterday
 ? "Yesterday"
 : new Date(day).toLocaleDateString(undefined, {
 weekday: "long",
 month: "short",
 day: "numeric",
 }),
 items: groups[day],
 }));
}

function MessagesPage() {
 const [body, setBody] = useState("");
 const [search, setSearch] = useState("");
 const [pending, setPending] = useState<PendingMessage[]>([]);
 const qc = useQueryClient();
 const ctxFn = useServerFn(getClientContext);
 const listFn = useServerFn(getClientMessages);
 const sendFn = useServerFn(sendClientMessage);
 const endRef = useRef<HTMLDivElement>(null);
 const scrollRef = useRef<HTMLDivElement>(null);
 const [selfId, setSelfId] = useState<string | null>(null);

 useEffect(() => {
 supabase.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
 }, []);

 const orgSearch = useClientOrgSearch();
 const support = useSupportView();
 const readOnly = support.readOnly;

 const { data: ctx } = useQuery({
 queryKey: ["client-context", orgSearch ?? null],
 queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
 });
 const orgId = ctx?.active?.organization_id;
 const orgName = ctx?.active?.name;
 const isViewer = ctx?.active?.role === "client_viewer";
 const canSend = !readOnly && !isViewer;

 const { data: rows = [], refetch, isLoading } = useQuery({
 queryKey: ["client-messages", orgId],
 queryFn: () => listFn({ data: { orgId: orgId! } }),
 enabled: !!orgId,
 placeholderData: (prev) => prev,
 });

 // Realtime — deduplicate against optimistic pending list on server ack.
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

 // Unread indicator (persisted per-org).
 const lastReadIso = useMemo(() => {
 if (!orgId || typeof window === "undefined") return null;
 return window.localStorage.getItem(lastReadKey(orgId));
 }, [orgId, (rows as AnyRow[]).length]);

 const unreadCount = useMemo(() => {
 if (!lastReadIso || !selfId) return 0;
 const cutoff = new Date(lastReadIso).getTime();
 return (rows as AnyRow[]).filter(
 (m) => m.sender_user_id !== selfId && new Date(m.created_at).getTime() > cutoff,
 ).length;
 }, [rows, lastReadIso, selfId]);

 // Mark as read when the window is focused and messages are visible.
 useEffect(() => {
 if (!orgId || (rows as AnyRow[]).length === 0) return;
 const last = (rows as AnyRow[])[(rows as AnyRow[]).length - 1];
 if (typeof window !== "undefined") {
 window.localStorage.setItem(lastReadKey(orgId), last.created_at);
 }
 }, [orgId, rows]);

 // Auto-scroll to bottom on new content (respects search filter).
 useEffect(() => {
 endRef.current?.scrollIntoView({ behavior: "smooth" });
 }, [(rows as AnyRow[]).length, pending.length]);

 const send = useMutation({
 mutationFn: async (input: PendingMessage) => {
 const row = await sendFn({ data: { orgId: orgId!, body: input.body } });
 return { input, row };
 },
 onSuccess: ({ input }) => {
 setPending((p) => p.filter((x) => x.clientId !== input.clientId));
 setBody("");
 qc.invalidateQueries({ queryKey: ["client-messages", orgId] });
 },
 onError: (e: Error, input) => {
 const msg = e.message.replace(/^Error: /, "");
 setPending((p) =>
 p.map((x) =>
 x.clientId === input.clientId ? { ...x, status: "failed", error: msg } : x,
 ),
 );
 toast.error(msg || "Failed to send message");
 },
 });

 const submit = (text: string) => {
 if (!canSend || !orgId) return;
 const trimmed = text.trim();
 if (!trimmed) return;
 const item: PendingMessage = {
 clientId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
 body: trimmed,
 createdAt: new Date().toISOString(),
 status: "sending",
 };
 setPending((p) => [...p, item]);
 send.mutate(item);
 };

 const retry = (item: PendingMessage) => {
 setPending((p) =>
 p.map((x) => (x.clientId === item.clientId ? { ...x, status: "sending", error: undefined } : x)),
 );
 send.mutate({ ...item, status: "sending" });
 };

 const dismissFailed = (clientId: string) =>
 setPending((p) => p.filter((x) => x.clientId !== clientId));

 // Merge server rows + pending (client-only) for the transcript.
 const filtered = useMemo(() => {
 if (!search.trim()) return rows as AnyRow[];
 const q = search.toLowerCase();
 return (rows as AnyRow[]).filter((m) =>
 String(m.body ?? "").toLowerCase().includes(q),
 );
 }, [rows, search]);

 const grouped = useMemo(() => groupByDay(filtered), [filtered]);

 return (
 <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col px-4 pb-4 pt-6 sm:px-6">
 {/* Header */}
 <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
 <div className="min-w-0">
 <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
 Messages
 </div>
 <h1 className="mt-1 flex items-center gap-2 truncate text-2xl font-semibold tracking-tight">
 TaaSFlow team
 {unreadCount > 0 && (
 <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
 {unreadCount} new
 </span>
 )}
 </h1>
 <p className="mt-1 truncate text-sm text-muted-foreground">
 Direct line about {orgName ?? "your workspace"} — hiring updates, questions, and coordination.
 </p>
 </div>
 <div className="shrink-0">
 <div className="relative">
 <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search"
 aria-label="Search messages"
 className="h-10 w-40 pl-8 sm:w-56"
 />
 {search && (
 <button
 onClick={() => setSearch("")}
 aria-label="Clear search"
 className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded hover:bg-muted"
 >
 <X className="h-3.5 w-3.5" />
 </button>
 )}
 </div>
 </div>
 </header>

 {readOnly && (
 <div className="mb-3 flex items-center gap-2 rounded-lg border taas-bd-warning taas-bg-warning-solid/[0.05] px-3 py-2 text-sm">
 <Info className="h-4 w-4 shrink-0 taas-fg-warning" />
 <span>You are viewing as an administrator — sending is disabled.</span>
 </div>
 )}

 {/* Transcript */}
 <div
 ref={scrollRef}
 className="flex-1 overflow-y-auto rounded-xl border bg-card"
 aria-live="polite"
 aria-label="Message transcript"
 >
 <div className="space-y-4 p-4 sm:p-5">
 {isLoading && (rows as AnyRow[]).length === 0 && (
 <div className="space-y-3">
 {[0, 1, 2].map((i) => (
 <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
 ))}
 </div>
 )}

 {!isLoading && (rows as AnyRow[]).length === 0 && (
 <div className="py-16 text-center">
 <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
 <MessageSquare className="h-5 w-5" />
 </div>
 <div className="mt-3 text-base font-semibold">No messages yet</div>
 <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
 {canSend
 ? "Send a note below and the TaaSFlow team will reply here. You'll get notified when they respond."
 : "The TaaSFlow team will reach out here as your searches progress."}
 </p>
 </div>
 )}

 {!isLoading && filtered.length === 0 && (rows as AnyRow[]).length > 0 && search && (
 <div className="py-12 text-center text-sm text-muted-foreground">
 No messages match &ldquo;{search}&rdquo;.
 </div>
 )}

 {grouped.map((group) => (
 <div key={group.label} className="space-y-2">
 <div className="sticky top-0 z-10 -mx-1 flex justify-center py-1">
 <span className="rounded-full bg-background/95 px-3 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border">
 {group.label}
 </span>
 </div>
 {group.items.map((m: AnyRow) => (
 <MessageBubble
 key={m.id}
 mine={m.sender_user_id === selfId}
 body={m.body}
 createdAt={m.created_at}
 />
 ))}
 </div>
 ))}

 {/* Pending / failed (client-only, always visible during send flow) */}
 {pending.map((p) => (
 <PendingBubble
 key={p.clientId}
 item={p}
 onRetry={() => retry(p)}
 onDismiss={() => dismissFailed(p.clientId)}
 />
 ))}

 <div ref={endRef} />
 </div>
 </div>

 {/* Composer */}
 <form
 className="mt-3"
 onSubmit={(e) => {
 e.preventDefault();
 submit(body);
 }}
 >
 <div className="flex items-end gap-2 rounded-xl border bg-card p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
 <Textarea
 value={body}
 onChange={(e) => setBody(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
 e.preventDefault();
 submit(body);
 }
 }}
 rows={2}
 placeholder={
 !canSend
 ? isViewer
 ? "Read-only access — ask a workspace admin to reply."
 : "Sending is disabled while viewing as an administrator."
 : "Write a message… (⌘/Ctrl+Enter to send)"
 }
 className="flex-1 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
 disabled={!canSend}
 aria-label="Message body"
 />
 <Button
 type="submit"
 size="icon"
 disabled={!canSend || !body.trim() || send.isPending}
 aria-label="Send message"
 className="min-h-11 min-w-11"
 >
 <Send className="h-4 w-4" />
 </Button>
 </div>
 <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
 <span>Messages are stored securely in your workspace.</span>
 {body.length > 0 && <span>{body.length}/4000</span>}
 </div>
 </form>
 </main>
 );
}

function MessageBubble({
 mine,
 body,
 createdAt,
}: {
 mine: boolean;
 body: string;
 createdAt: string;
}) {
 return (
 <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
 <div className="max-w-[85%] sm:max-w-[75%]">
 {!mine && (
 <div className="mb-0.5 pl-1 text-[11px] font-medium text-muted-foreground">
 TaaSFlow team
 </div>
 )}
 <div
 className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
 mine
 ? "rounded-br-sm bg-primary text-primary-foreground"
 : "rounded-bl-sm border bg-background text-foreground"
 }`}
 >
 <div className="whitespace-pre-wrap break-words">{body}</div>
 </div>
 <div
 className={`mt-1 flex items-center gap-1 px-1 text-[10.5px] ${
 mine ? "justify-end text-muted-foreground" : "text-muted-foreground"
 }`}
 >
 <span>{relTime(createdAt)}</span>
 {mine && <CheckCheck className="h-3 w-3" aria-label="Delivered" />}
 </div>
 </div>
 </div>
 );
}

function PendingBubble({
 item,
 onRetry,
 onDismiss,
}: {
 item: PendingMessage;
 onRetry: () => void;
 onDismiss: () => void;
}) {
 const failed = item.status === "failed";
 return (
 <div className="flex justify-end">
 <div className="max-w-[85%] sm:max-w-[75%]">
 <div
 className={`rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
 failed
 ? "border border-destructive/40 bg-destructive/[0.06] text-foreground"
 : "bg-primary/80 text-primary-foreground"
 }`}
 >
 <div className="whitespace-pre-wrap break-words">{item.body}</div>
 </div>
 <div className="mt-1 flex items-center justify-end gap-2 px-1 text-[10.5px]">
 {failed ? (
 <>
 <AlertCircle className="h-3 w-3 text-destructive" />
 <span className="text-destructive">{item.error ?? "Failed to send"}</span>
 <button
 type="button"
 onClick={onRetry}
 className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
 >
 <RotateCcw className="h-3 w-3" /> Retry
 </button>
 <button
 type="button"
 onClick={onDismiss}
 className="text-muted-foreground hover:underline"
 >
 Dismiss
 </button>
 </>
 ) : (
 <span className="text-muted-foreground">Sending…</span>
 )}
 </div>
 </div>
 </div>
 );
}
