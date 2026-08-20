import { useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ensureConversation,
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
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(APP_LOCALE, {
    timeZone: WORKSPACE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
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
        {file.size > 0 && <span className="text-muted-foreground">{formatBytes(file.size)}</span>}
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
 * Draft composer for a brand-new conversation. The thread is only created on the
 * server after the user sends the first message.
 */
export function DraftConversationThread({
  orgId,
  scope,
  positionId,
  candidateMatchId,
  subject,
  preview,
  heightClass = "h-[520px]",
  className,
}: {
  orgId: string;
  scope: "organization" | "position" | "candidate";
  positionId?: string;
  candidateMatchId?: string;
  subject?: string;
  preview?: string;
  heightClass?: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const orgSearch = useClientOrgSearch();
  const resolvedOrg = orgSearch ?? orgId;
  const appSearch = useSearch({ strict: false }) as Record<string, any>;

  const ensureFn = useServerFn(ensureConversation);
  const postFn = useServerFn(postConversationMessage);
  const targetFn = useServerFn(createMessageAttachmentTarget);

  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [postedMessages, setPostedMessages] = useState<
    Array<{
      id: string;
      body: string;
      created_at: string;
      sender_name: string;
      sender_role?: string;
      attachments: MessageAttachment[];
    }>
  >([]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const send = async () => {
    if (sending) return;
    const bodyCheck = checkMessageBody(body, files.length > 0);
    if (!bodyCheck.ok) {
      setSendError(bodyCheck.error);
      return;
    }
    const pendingBody = bodyCheck.body;
    const pendingFiles = files;
    setSending(true);
    setSendError(null);
    setBody("");
    setFiles([]);
    setFileErrors([]);
    composerRef.current?.focus();

    const restore = (message: string) => {
      setBody(pendingBody);
      setFiles(pendingFiles);
      setSendError(message);
      toast.error(message);
      composerRef.current?.focus();
    };

    try {
      const { id: conversationId } = await ensureFn({
        data: { orgId, scope, positionId, candidateMatchId, subject },
      });

      const uploaded: MessageAttachment[] = [];
      for (const file of pendingFiles) {
        const target = await targetFn({
          data: {
            conversationId,
            fileName: file.name,
            size: file.size,
            mime: file.type || "application/octet-stream",
          },
        });
        if (!target.ok) {
          restore(target.error);
          return;
        }
        const up = await supabase.storage
          .from(target.bucket)
          .uploadToSignedUrl(target.path, target.token, file, {
            contentType: file.type || "application/octet-stream",
          });
        if (up.error) {
          restore(`${file.name} did not upload. Your message is still here — try again.`);
          return;
        }
        uploaded.push({
          path: target.path,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
        });
      }

      const row = await postFn({
        data: {
          conversationId,
          body: pendingBody,
          ...(uploaded.length > 0 ? { attachments: uploaded } : {}),
        },
      });

      setPostedMessages((prev) => [
        ...prev,
        {
          id: (row as { id: string }).id,
          body: pendingBody,
          created_at: (row as { created_at: string }).created_at,
          sender_name: "You",
          sender_role: undefined,
          attachments: uploaded,
        },
      ]);

      qc.invalidateQueries({ queryKey: ["conversations"] });

      await navigate({
        to: "/client/conversations/$conversationId",
        params: { conversationId },
        search: { org: resolvedOrg, preview: preview ?? appSearch?.preview },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      restore(
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

  return (
    <div className={cn("flex flex-col rounded-lg border bg-card", heightClass, className)}>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {postedMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium">No messages yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Ask for more candidates, request a change to the brief, or flag urgency — your
              TaaSFlow recruiter answers here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {postedMessages.map((m) => (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] space-y-1 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.sender_name}</span>
                    <span className="tabular-nums">
                      {new Date(m.created_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {m.body}
                  </div>
                  {m.attachments.length > 0 && (
                    <div className="flex flex-col items-end space-y-1">
                      {m.attachments.map((f) => (
                        <AttachmentLink key={f.path} messageId={m.id} file={f} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t p-3">
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
      </div>
    </div>
  );
}
