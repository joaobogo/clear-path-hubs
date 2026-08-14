import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { listMyMessages, markMyMessagesRead, sendMyMessage } from "@/lib/candidate.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/me/messages")({
 head: () => ({
 meta: [
 { title: "Messages · TaaSFlow" },
 { name: "robots", content: "noindex" },
 ],
 }),
 loader: ({ context }) =>
 context.queryClient.ensureQueryData({
 queryKey: ["me-messages"],
 queryFn: () => listMyMessages(),
 }),
 pendingComponent: () => (
 <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4" aria-hidden>
 <div className="h-8 w-40 animate-pulse rounded bg-muted" />
 <div className="h-64 animate-pulse rounded-lg bg-muted" />
 </div>
 ),
 errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.messages.tsx"),
 notFoundComponent: () => <div className="p-8">Not found.</div>,
 component: MyMessages,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function MyMessages() {
 const initial = Route.useLoaderData();
 const listFn = useServerFn(listMyMessages);
 const sendFn = useServerFn(sendMyMessage);
 const markReadFn = useServerFn(markMyMessagesRead);

 const qc = useQueryClient();
 const endRef = useRef<HTMLDivElement>(null);
 const [body, setBody] = useState("");
 const [selfId, setSelfId] = useState<string | null>(null);

 useEffect(() => {
 supabase.auth.getUser().then(({ data }) => setSelfId(data.user?.id ?? null));
 }, []);

 const { data = initial } = useQuery({
 queryKey: ["me-messages"],
 queryFn: () => listFn(),
 initialData: initial,
 });

 // Opening the thread clears the unread badge on the candidate home.
 const unreadIds = (data.messages as AnyRow[])
 .filter((m) => !m.read_at && m.sender_user_id !== selfId)
 .map((m) => m.id as string)
 .join(",");
 useEffect(() => {
 if (!selfId || !unreadIds) return;
 void markReadFn()
 .then(() => {
 qc.invalidateQueries({ queryKey: ["me-messages"] });
 qc.invalidateQueries({ queryKey: ["me-dashboard"] });
 })
 .catch(() => {
 // Read receipts are best-effort; never block the thread on them.
 });
 }, [selfId, unreadIds, markReadFn, qc]);



 useEffect(() => {
 if (!selfId) return;
 const channel = supabase
 .channel(`me-msg-${selfId}`)
 .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
 qc.invalidateQueries({ queryKey: ["me-messages"] }),
 )
 .subscribe();
 return () => {
 supabase.removeChannel(channel);
 };
 }, [selfId, qc]);

 useEffect(() => {
 endRef.current?.scrollIntoView({ behavior: "smooth" });
 }, [data.messages.length]);

 const send = useMutation({
 mutationFn: (b: string) => sendFn({ data: { body: b } }),
 onSuccess: (r) => {
 if (r.ok) {
 setBody("");
 qc.invalidateQueries({ queryKey: ["me-messages"] });
 } else toast.error(r.message ?? "Failed to send");
 },
 onError: (e: Error) => toastError(e),
 });

 return (
 <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 flex flex-col h-[calc(100dvh-4rem)]">
 <header className="mb-4">
 <h1 className="text-2xl font-semibold">Messages</h1>
 <p className="text-sm text-muted-foreground">
 Direct line to the TaaSFlow team about your applications. We reply here or by email.
 </p>
 </header>

 <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4 space-y-3">
 {data.messages.length === 0 && (
 <div className="text-center text-sm text-muted-foreground py-12">
 <div className="font-medium mb-1">No messages yet</div>
 <p>
 Have a question about your applications? Send us a note and the
 TaaSFlow team will come back to you.
 </p>
 </div>
 )}
 {(data.messages as AnyRow[]).map((m) => {
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
 <div className="whitespace-pre-wrap break-words">{m.body}</div>
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
 if (send.isPending) return;
 if (body.trim()) send.mutate(body.trim());
 }}
 >
 <label htmlFor="me-message-body" className="sr-only">
 Write a message
 </label>
 <Textarea
 id="me-message-body"
 value={body}
 onChange={(e) => setBody(e.target.value)}
 rows={2}
 placeholder="Write a message…"
 className="flex-1"
 disabled={send.isPending}
 />
 <Button type="submit" className="min-h-11" disabled={!body.trim() || send.isPending}>
 {send.isPending ? "Sending…" : "Send"}
 </Button>

 </form>
 </div>
 );
}
