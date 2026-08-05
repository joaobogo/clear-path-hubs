import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MESSAGE_ATTACHMENT_BUCKET,
  attachmentPath,
  checkAttachment,
} from "@/lib/message-attachments";

/**
 * Attachment upload/download for client-visible threads.
 *
 * The bucket is private and carries no storage policies: every upload target
 * and every download link is minted here, after the caller has been checked
 * against org membership on the thread.
 */

async function conversationOrg(
  supabase: { from: (t: string) => never } | never,
  conversationId: string,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data } = await client
    .from("conversations")
    .select("id, organization_id")
    .eq("id", conversationId)
    .maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

/** Mints a one-shot signed upload target for one validated file. */
export const createMessageAttachmentTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        conversationId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200),
        size: z.number().int().positive(),
        mime: z.string().trim().max(200).optional(),
      })
      .parse(raw),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<
      { ok: true; path: string; token: string; bucket: string } | { ok: false; error: string }
    > => {
      const check = checkAttachment({ name: data.fileName, size: data.size, type: data.mime });
      if (!check.ok) return { ok: false, error: check.error };

      // RLS on conversations already scopes this read to the caller's orgs.
      const orgId = await conversationOrg(context.supabase as never, data.conversationId);
      if (!orgId) return { ok: false, error: "That conversation is not available to you." };

      const { data: canPost } = await context.supabase.rpc("is_org_editor", {
        _user: context.userId,
        _org: orgId,
      });
      const { data: isStaff } = await context.supabase.rpc("is_platform_staff", {
        _user: context.userId,
      });
      if (canPost !== true && isStaff !== true) {
        return { ok: false, error: "You have view-only access to this conversation." };
      }

      const path = attachmentPath(orgId, data.conversationId, data.fileName);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed, error } = await supabaseAdmin.storage
        .from(MESSAGE_ATTACHMENT_BUCKET)
        .createSignedUploadUrl(path);
      if (error || !signed) {
        return { ok: false, error: "We could not start that upload. Try again." };
      }
      return { ok: true, path, token: signed.token, bucket: MESSAGE_ATTACHMENT_BUCKET };
    },
  );

/** Short-lived download link for an attachment on a thread the caller can read. */
export const getMessageAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ messageId: z.string().uuid(), path: z.string().trim().min(1).max(400) }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
    // RLS on messages restricts this to org members and platform staff.
    const { data: message } = await context.supabase
      .from("messages")
      .select("id, attachments")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!message) return { ok: false, error: "That attachment is no longer available." };

    const list = Array.isArray(message.attachments) ? (message.attachments as unknown[]) : [];
    const found = list.some(
      (a) => a && typeof a === "object" && (a as { path?: string }).path === data.path,
    );
    if (!found) return { ok: false, error: "That attachment is no longer available." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(MESSAGE_ATTACHMENT_BUCKET)
      .createSignedUrl(data.path, 300);
    if (error || !signed) return { ok: false, error: "We could not open that file. Try again." };
    return { ok: true, url: signed.signedUrl };
  });
