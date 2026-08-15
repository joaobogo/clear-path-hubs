import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getConversation,
  markConversationRead,
  postConversationMessage,
} from "@/lib/conversations.functions";
import {
  createMessageAttachmentTarget,
  getMessageAttachmentUrl,
} from "@/lib/message-attachments.functions";
import {
  ALLOWED_ATTACHMENT_HINT,
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_MESSAGE_CHARS,
  checkAttachment,
  checkMessageBody,
  formatBytes,
  type MessageAttachment,
} from "@/lib/message-attachments";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Paperclip, Send, X } from "lucide-react";
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

function ThreadSkeleton() {
  return (
    <div className="space-y-4" data-testid="thread-skeleton">
      <Skeleton className="mx-auto h-3 w-20" />
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn("flex", i === 1 ? "justify-end" : "justify-start")}>
          <div className="w-2/3 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AttachmentLink({ messageId, file }: { messageId: string; file: MessageAttachment }) {
  const urlFn = useServerFn(getMessageAttachmentUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await urlFn({ data: { messageId, path: file.path } });
      if (res.ok) window.open(res.url, "_blank", "noopener,noreferrer");
      else setError(res.error);
    } catch {
      setError("We could not open that file. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="block">
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        className="inline-flex max-w-full items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs text-foreground hover:bg-muted"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Paperclip className="h-3 w-3" aria-hidden />
        )}
        <span className="truncate">{file.name}</span>
        {file.size > 0 && (
          <span className="text-muted-foreground">{formatBytes(file.size)}</span>
        )}
      </button>
      {error && (
        <span className="mt-1 block text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * One client-visible thread.
 *
 * Only rows from `messages` appear here. Internal recruiter notes live in a
 * separate store (`internal_notes`) and are never read by this component or by
 * the server function behind it.
 */
export function ConversationThread({
  conversationId,
  canPost = true,
  className,
  heightClass = "h-[520px]",
  emptyPrompt = "Ask for more candidates, request a change to the brief, or flag urgency — your TaaSFlow recruiter answers here.",
}: {
  conversationId: string;
  canPost?: boolean;
  className?: string;
  heightClass?: string;
  emptyPrompt?: string;
}) {
  const qc = useQueryClient();
  const loadFn = useServerFn(getConversation);
  const postFn = useServerFn(postConversationMessage);
  const readFn = useServerFn(markConversationRead);
  const targetFn = useServerFn(createMessageAttachmentTarget);

  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
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

  // Opening the thread clears its unread count.
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

  useEffect(() => {
    composerRef.current?.focus();
  }, [conversationId]);

  const addFiles = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const next: File[] = [...files];
    const errors: string[] = [];
    for (const f of Array.from(picked)) {
      if (next.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
        errors.push(`You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files to one message.`);
        break;
      }
      const check = checkAttachment({ name: f.name, size: f.size, type: f.type });
      if (check.ok) next.push(f);
      else errors.push(check.error);
    }
    setFiles(next);
    setFileErrors(errors);
    if (fileRef.current) fileRef.current.value = "";
  };

  /**
   * Send: upload each attachment, then post. On any failure the typed message
   * and the chosen files stay exactly where they are, with a Retry.
   */
  const send = async () => {
    const bodyCheck = checkMessageBody(body, files.length > 0);
    if (!bodyCheck.ok) {
      setSendError(bodyCheck.error);
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const uploaded: MessageAttachment[] = [];
      for (const file of files) {
        const target = await targetFn({
          data: {
            conversationId,
            fileName: file.name,
            size: file.size,
            mime: file.type || "application/octet-stream",
          },
        });
        if (!target.ok) {
          setSendError(target.error);
          return;
        }
        const up = await supabase.storage
          .from(target.bucket)
          .uploadToSignedUrl(target.path, target.token, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (up.error) {
          setSendError(`${file.name} did not upload. Your message is still here — try again.`);
          return;
        }
        uploaded.push({
          path: target.path,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
        });
      }

      await postFn({
        data: {
          conversationId,
          body: bodyCheck.body,
          ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
        },
      });

      setBody("");
      setFiles([]);
      setFileErrors([]);
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      composerRef.current?.focus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setSendError(
        msg.includes("SUPPORT_VIEW_READ_ONLY")
          ? "Support view is read-only — start an interactive session to reply."
          : msg.includes("forbidden")
            ? "You do not have permission to post in this thread."
            : "That message was not sent. Your text is still here — try again.",
      );
    } finally {
      setSending(false);
    }
  };

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
          <ThreadSkeleton />
        ) : isError && !data ? (
          <div className="flex h-full flex-col items-center justify-center text-center" role="alert">
            <p className="text-sm font-medium">We could not load this conversation</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyPrompt}</p>
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
                        "flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
                        m.mine && "justify-end",
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {m.mine ? "You" : m.sender_name}
                      </span>
                      <span>{m.sender_role}</span>
                      {m.sender_side === "taasflow" && !m.mine && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-[color:var(--brand-navy)]/8 text-[color:var(--brand-navy)] border-[color:var(--brand-navy)]/15 font-semibold">
                          TaaSFlow team
                        </Badge>
                      )}
                      <span className="tabular-nums">{timeLabel(m.created_at)}</span>
                    </div>
                    <div
                      className={cn(
                        "whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                        m.mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {m.body}
                    </div>
                    {m.attachments.length > 0 && (
                      <div className={cn("space-y-1", m.mine && "flex flex-col items-end")}>
                        {m.attachments.map((f) => (
                          <AttachmentLink key={f.path} messageId={m.id} file={f} />
                        ))}
                      </div>
                    )}
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
              if (!sending) void send();
            }}
            className="space-y-2"
          >
            <div className="flex items-end gap-2">
              <Textarea
                ref={composerRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    if (!sending) void send();
                  }
                }}
                placeholder="Write a message… everyone on this thread is notified by email."
                className="min-h-[64px] resize-none"
                maxLength={MAX_MESSAGE_CHARS}
                aria-label="Message"
              />
              <div className="flex shrink-0 flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={sending || files.length >= MAX_ATTACHMENTS_PER_MESSAGE}
                  title={`Attach a document — ${ALLOWED_ATTACHMENT_HINT}`}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="sr-only">Attach a document</span>
                </Button>
                <Button type="submit" disabled={sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="sr-only">{sendError ? "Retry sending" : "Send"}</span>
                </Button>
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ATTACHMENT_ACCEPT}
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />

            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3" aria-hidden />
                    <span className="max-w-[14rem] truncate">{f.name}</span>
                    <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {fileErrors.length > 0 && (
              <ul className="space-y-1 text-xs text-destructive" role="alert">
                {fileErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}

            {sendError ? (
              <p className="text-sm text-destructive" role="alert">
                {sendError}{" "}
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => void send()}
                  disabled={sending}
                >
                  Retry
                </button>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Attach {ALLOWED_ATTACHMENT_HINT}. Up to {MAX_MESSAGE_CHARS.toLocaleString()}{" "}
                characters.
              </p>
            )}
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
