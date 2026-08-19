import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  checkAttachment,
  type MessageAttachment,
} from "@/lib/message-attachments";

/**
 * Unified conversations.
 *
 * One thread per client account ("General"), one per role, one per candidate.
 * Every message in the product lives in exactly one of those threads, so there
 * is no separate inbox / messages / deliveries surface to reconcile.
 *
 * Reads run through the authenticated client (RLS scopes to org membership).
 * The service client is only used to resolve display names for sender ids that
 * already appear in rows the caller is allowed to read.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export type ConversationScope = "organization" | "position" | "candidate";

export type ConversationSummary = {
  id: string;
  organization_id: string;
  scope: ConversationScope;
  position_id: string | null;
  candidate_match_id: string | null;
  subject: string;
  context_label: string | null;
  last_message_at: string;
  last_body: string | null;
  last_sender_name: string | null;
  unread: number;
};

export type ConversationMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_user_id: string | null;
  sender_name: string;
  /** Plain-English role of the sender, e.g. "TaaSFlow recruiter". */
  sender_role: string;
  sender_side: "client" | "taasflow" | "system";
  mine: boolean;
  attachments: MessageAttachment[];
};

export type HistoricalMessage = {
  id: string;
  conversation_id: string;
  body: string;
  created_at: string;
  sender_name: string;
  sender_role: string;
  sender_side: "client" | "taasflow" | "system";
  mine: boolean;
  subject: string;
  context_label: string | null;
};

/** Attachment rows are jsonb; only well-formed entries reach the client. */
function readAttachments(raw: unknown): MessageAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: MessageAttachment[] = [];
  for (const item of raw.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    if (typeof a.path !== "string" || typeof a.name !== "string") continue;
    out.push({
      path: a.path,
      name: a.name,
      mime: typeof a.mime === "string" ? a.mime : "application/octet-stream",
      size: typeof a.size === "number" ? a.size : 0,
    });
  }
  return out;
}

async function assertOrgAccess(
  supabase: Row,
  userId: string,
  orgId: string,
): Promise<{ staff: boolean }> {
  const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (staff === true) return { staff: true };

  // Membership is the same signal the client context uses to pick the active
  // account. is_org_member() additionally requires the organization not to be
  // archived, which made conversations 403 for accounts that can still open
  // every other client surface.
  const { data: member } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!member) throw new Error("forbidden");
  return { staff: false };
}

/**
 * Posting requires client editor rights, or platform staff inside an active
 * interactive support session (read-only support view cannot post).
 */
async function assertCanPost(supabase: Row, userId: string, orgId: string): Promise<void> {
  const { data: isEditor } = await supabase.rpc("is_org_editor", { _user: userId, _org: orgId });
  if (isEditor === true) return;
  const { data: isStaff } = await supabase.rpc("is_platform_staff", { _user: userId });
  if (isStaff !== true) throw new Error("forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: interactive } = await supabaseAdmin
    .from("support_sessions")
    .select("id")
    .eq("actor_user_id", userId)
    .eq("organization_id", orgId)
    .eq("mode", "interactive")
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (!interactive) {
    const { data: isStaff } = await supabase.rpc("is_platform_staff", { _user: userId });
    if (!isStaff) throw new Error("SUPPORT_VIEW_READ_ONLY");
    // Staff can always post, even without an interactive session, as long as
    // they are in the admin Comms view (which uses this same function).
  }
}

/** Membership role -> the words a client should read next to a name. */
function roleLabel(role: string | null, staff: boolean): string {
  if (staff) return role === "operations" ? "TaaSFlow recruiter" : "TaaSFlow team";
  switch (role) {
    case "client_admin":
      return "Hiring lead";
    case "client_editor":
      return "Hiring team";
    case "client_viewer":
      return "Observer";
    default:
      return "Your team";
  }
}

async function nameMap(
  userIds: string[],
): Promise<Record<string, { name: string; staff: boolean; role: string }>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: profiles }, { data: mems }] = await Promise.all([
    supabaseAdmin.from("profiles").select("auth_user_id, full_name, email").in("auth_user_id", ids),
    supabaseAdmin.from("memberships").select("user_id, role").in("user_id", ids),
  ]);
  const staffIds = new Set(
    ((mems as Row[]) ?? [])
      .filter((m) => m.role === "platform_admin" || m.role === "operations")
      .map((m) => m.user_id as string),
  );
  const rawRole: Record<string, string | null> = {};
  for (const m of ((mems as Row[]) ?? [])) rawRole[m.user_id as string] = (m.role as string | null) ?? null;

  const { resolveStaffPersona } = await import("./staff-persona.server");
  const out: Record<string, { name: string; staff: boolean; role: string }> = {};
  for (const p of (profiles as Row[]) ?? []) {
    const id = p.auth_user_id as string;
    const staff = staffIds.has(id);
    const persona = resolveStaffPersona({
      name: p.full_name as string | null,
      email: p.email as string | null,
      isStaff: staff,
      roleLabel: roleLabel(rawRole[id] ?? null, staff),
      maskStatus: staff, // Thread UI adds the badge, so we don't need the (Staff) suffix here.
    });
    out[id] = {
      name: persona.name,
      staff: persona.isStaff,
      role: persona.role,
    };
  }
  for (const id of ids) {
    if (!out[id]) {
      const staff = staffIds.has(id);
      const persona = resolveStaffPersona({
        name: null,
        isStaff: staff,
        roleLabel: roleLabel(rawRole[id] ?? null, staff),
      });
      out[id] = {
        name: persona.name,
        staff: persona.isStaff,
        role: persona.role,
      };
    }
  }
  return out;
}

/** Threads for one client account, newest activity first. */
export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ orgId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }): Promise<{ items: ConversationSummary[] }> => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.orgId);

    const { data: convos, error } = await supabase
      .from("conversations")
      .select(
        "id, organization_id, scope, position_id, candidate_match_id, subject, last_message_at",
      )
      .eq("organization_id", data.orgId)
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = (convos as Row[]) ?? [];
    if (rows.length === 0) return { items: [] };
    const ids = rows.map((c) => c.id as string);

    const [{ data: msgs }, { data: reads }] = await Promise.all([
      supabase
        .from("messages")
        .select("id, conversation_id, body, created_at, sender_user_id")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("conversation_reads")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId)
        .in("conversation_id", ids),
    ]);

    const readAt: Record<string, string> = {};
    for (const r of (reads as Row[]) ?? []) readAt[r.conversation_id as string] = r.last_read_at as string;

    const last: Record<string, Row> = {};
    const ownLatest: Record<string, string> = {};
    const rowsByConvo: Record<string, Row[]> = {};
    for (const m of (msgs as Row[]) ?? []) {
      const cid = m.conversation_id as string;
      if (!last[cid]) last[cid] = m;
      (rowsByConvo[cid] ??= []).push(m);
      // Posting is reading: your own message marks everything before it as seen.
      if (m.sender_user_id === userId && !ownLatest[cid]) ownLatest[cid] = m.created_at as string;
    }

    const unread: Record<string, number> = {};
    for (const [cid, list] of Object.entries(rowsByConvo)) {
      const stamps = [readAt[cid], ownLatest[cid]].filter(Boolean) as string[];
      const cutoff = stamps.length
        ? new Date(Math.max(...stamps.map((s) => new Date(s).getTime())))
        : null;
      for (const m of list) {
        if (m.sender_user_id === userId) continue;
        if (cutoff && new Date(m.created_at as string) <= cutoff) continue;
        unread[cid] = (unread[cid] ?? 0) + 1;
      }
    }

    const names = await nameMap(Object.values(last).map((m) => m.sender_user_id as string));

    // Context labels (role title / candidate reference) for scoped threads.
    const positionIds = rows.map((r) => r.position_id).filter(Boolean) as string[];
    const matchIds = rows.map((r) => r.candidate_match_id).filter(Boolean) as string[];
    const [{ data: positions }, { data: matches }] = await Promise.all([
      positionIds.length
        ? supabase.from("positions").select("id, title").in("id", positionIds)
        : Promise.resolve({ data: [] as Row[] }),
      matchIds.length
        ? supabase
            .from("candidate_matches")
            .select("id, position_id, candidate_profiles(full_name), positions(title)")
            .in("id", matchIds)
        : Promise.resolve({ data: [] as Row[] }),
    ]);
    const positionTitle: Record<string, string> = {};
    for (const p of (positions as Row[]) ?? []) positionTitle[p.id as string] = p.title as string;
    const matchLabel: Record<string, string> = {};
    for (const m of (matches as Row[]) ?? []) {
      const cand = (m.candidate_profiles as Row | null)?.full_name as string | undefined;
      const role = (m.positions as Row | null)?.title as string | undefined;
      matchLabel[m.id as string] = [cand ?? "Candidate", role].filter(Boolean).join(" · ");
    }

    const items: ConversationSummary[] = rows.map((c) => {
      const lastMsg = last[c.id as string];
      const scope = c.scope as ConversationScope;
      const contextLabel =
        scope === "position"
          ? (positionTitle[c.position_id as string] ?? "Role")
          : scope === "candidate"
            ? (matchLabel[c.candidate_match_id as string] ?? "Candidate")
            : null;
      return {
        id: c.id as string,
        organization_id: c.organization_id as string,
        scope,
        position_id: (c.position_id as string | null) ?? null,
        candidate_match_id: (c.candidate_match_id as string | null) ?? null,
        subject: (c.subject as string | null) ?? contextLabel ?? "General",
        context_label: contextLabel,
        last_message_at: c.last_message_at as string,
        last_body: (lastMsg?.body as string | undefined) ?? null,
        last_sender_name: lastMsg?.sender_user_id
          ? (names[lastMsg.sender_user_id as string]?.name ?? null)
          : null,
        unread: unread[c.id as string] ?? 0,
      };
    });

    return { items };
  });

const ensureInput = z
  .object({
    orgId: z.string().uuid(),
    scope: z.enum(["organization", "position", "candidate"]),
    positionId: z.string().uuid().optional(),
    candidateMatchId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(160).optional(),
  })
  .refine((v) => v.scope !== "position" || !!v.positionId, {
    message: "positionId is required for a role thread",
  })
  .refine((v) => v.scope !== "candidate" || !!v.candidateMatchId, {
    message: "candidateMatchId is required for a candidate thread",
  });

/** Idempotent: one thread per account / role / candidate. */
export const ensureConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => ensureInput.parse(raw))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.orgId);

    let existingQ = supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", data.orgId)
      .eq("scope", data.scope);
    if (data.scope === "position") existingQ = existingQ.eq("position_id", data.positionId!);
    if (data.scope === "candidate")
      existingQ = existingQ.eq("candidate_match_id", data.candidateMatchId!);
    const { data: existing } = await existingQ.maybeSingle();
    if (existing) return { id: (existing as Row).id as string };

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        organization_id: data.orgId,
        scope: data.scope,
        position_id: data.scope === "position" ? data.positionId! : null,
        candidate_match_id: data.scope === "candidate" ? data.candidateMatchId! : null,
        subject: data.subject ?? (data.scope === "organization" ? "General" : null),
        created_by: userId,
        last_message_at: null, // Explicitly null until first message
      })
      .select("id")
      .single();

    if (error) {
      // Unique index race — read the winner instead of failing the UI.
      const { data: retry } = await existingQ.maybeSingle();
      if (retry) return { id: (retry as Row).id as string };
      throw new Error(error.message);
    }
    return { id: (created as Row).id as string };
  });

/** Full thread: header + chronological messages with attributed authors. */
export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ conversationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    return _getConversationHandler({ data, context });
  });

export async function _getConversationHandler({ data, context }: any) {
  const { supabase, userId } = context;
  const { data: convo, error } = await supabase
    .from("conversations")
    .select(
      "id, organization_id, scope, position_id, candidate_match_id, subject, last_message_at",
    )
    .eq("id", data.conversationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!convo) throw new Error("not_found");
  await assertOrgAccess(supabase, userId, (convo as Row).organization_id as string);

  const { data: msgs, error: mErr } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_user_id, attachments")
    .eq("conversation_id", data.conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (mErr) throw new Error(mErr.message);

  const rows = (msgs as Row[]) ?? [];
  const names = await nameMap(rows.map((m) => m.sender_user_id as string));
  const { resolveStaffPersona } = await import("./staff-persona.server");

  const messages: ConversationMessage[] = rows.map((m) => {
    const sid = (m.sender_user_id as string | null) ?? null;
    const meta = sid ? names[sid] : undefined;
    const persona = resolveStaffPersona({
      name: sid ? (meta?.name ?? null) : null,
      isStaff: sid ? (meta?.staff ?? false) : true,
      roleLabel: sid ? (meta?.role ?? null) : "TaaSFlow team",
      maskStatus: true, // Conversation thread renderer adds the "TaaSFlow team" badge separately.
    });

    return {
      id: m.id as string,
      body: m.body as string,
      created_at: m.created_at as string,
      sender_user_id: sid,
      sender_name: persona.name,
      sender_role: persona.role,
      sender_side: !sid ? "system" : meta?.staff ? "taasflow" : "client",
      mine: sid === userId,
      attachments: readAttachments(m.attachments),
    };
  });

  let contextLabel: string | null = null;
  if ((convo as Row).scope === "position" && (convo as Row).position_id) {
    const { data: p } = await supabase
      .from("positions")
      .select("title")
      .eq("id", (convo as Row).position_id)
      .maybeSingle();
    contextLabel = ((p as Row | null)?.title as string | null) ?? "Role";
  } else if ((convo as Row).scope === "candidate" && (convo as Row).candidate_match_id) {
    const { data: m } = await supabase
      .from("candidate_matches")
      .select("candidate_profiles(full_name), positions(title)")
      .eq("id", (convo as Row).candidate_match_id)
      .maybeSingle();
    const cand = ((m as Row | null)?.candidate_profiles as Row | null)?.full_name as
      | string
      | undefined;
    const role = ((m as Row | null)?.positions as Row | null)?.title as string | undefined;
    contextLabel = [cand ?? "Candidate", role].filter(Boolean).join(" · ");
  }

  return {
    conversation: {
      id: (convo as Row).id as string,
      organization_id: (convo as Row).organization_id as string,
      scope: (convo as Row).scope as ConversationScope,
      position_id: ((convo as Row).position_id as string | null) ?? null,
      candidate_match_id: ((convo as Row).candidate_match_id as string | null) ?? null,
      subject: ((convo as Row).subject as string | null) ?? contextLabel ?? "General",
      context_label: contextLabel,
      last_message_at: (convo as Row).last_message_at as string,
    },
    messages,
  };
}

/** Post into a thread. Mirrors to email through the notification pipeline. */
export const postConversationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        attachments: z
          .array(
            z.object({
              path: z.string().trim().min(1).max(400),
              name: z.string().trim().min(1).max(200),
              mime: z.string().trim().max(200).default("application/octet-stream"),
              size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
            }),
          )
          .max(MAX_ATTACHMENTS_PER_MESSAGE)
          .optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: convo, error: cErr } = await supabase
      .from("conversations")
      .select("id, organization_id, scope, position_id, candidate_match_id, subject")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!convo) throw new Error("not_found");
    const orgId = (convo as Row).organization_id as string;

    await assertCanPost(supabase, userId, orgId);

    // Same rules as the composer, enforced again here: the browser check is a
    // courtesy, this one is the guarantee.
    const attachments: MessageAttachment[] = [];
    for (const a of data.attachments ?? []) {
      const check = checkAttachment({ name: a.name, size: a.size, type: a.mime });
      if (!check.ok) throw new Error(check.error);
      if (!a.path.startsWith(`${orgId}/${data.conversationId}/`)) {
        throw new Error("That attachment does not belong to this conversation.");
      }
      attachments.push({ path: a.path, name: a.name, mime: a.mime, size: a.size });
    }

    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: data.conversationId,
        thread_id: orgId,
        sender_user_id: userId,
        body: data.body,
        attachments,
        recipient_context: {
          org_id: orgId,
          conversation_id: data.conversationId,
          scope: (convo as Row).scope,
        },
      })
      .select("id, body, created_at, sender_user_id, attachments")
      .single();
    if (error) throw new Error(error.message);

    // Posting is reading: keep the poster's unread badge at zero for this thread.
    await supabase.from("conversation_reads").upsert(
      {
        conversation_id: data.conversationId,
        user_id: userId,
        last_read_at: ((row as Row).created_at as string) ?? new Date().toISOString(),
      },
      { onConflict: "conversation_id,user_id" },
    );

    try {
      const { emitEventFromServer } = await import("./notifications.functions");
      await emitEventFromServer({
        event: "message_sent",
        scope: `message:${(row as Row).id}`,
        organization_id: orgId,
        position_id: ((convo as Row).position_id as string | null) ?? null,
        candidate_match_id: ((convo as Row).candidate_match_id as string | null) ?? null,
        actor_user_id: userId,
        link_path: `/client/conversations/${data.conversationId}`,
      });
    } catch (e) {
      console.error("[postConversationMessage] notify failed", e);
    }

    return row as Row;
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ conversationId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("conversation_reads").upsert(
      {
        conversation_id: data.conversationId,
        user_id: context.userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin view: recent threads across every client account. */
export const listAllConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (staff !== true) throw new Error("forbidden");

    const { data: convos, error } = await context.supabase
      .from("conversations")
      .select(
        "id, organization_id, scope, subject, last_message_at, organizations(id, name), positions(title)",
      )
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    const rows = (convos as Row[]) ?? [];
    const ids = rows.map((c) => c.id as string);
    const { data: msgs } = ids.length
      ? await context.supabase
          .from("messages")
          .select("conversation_id, body, created_at")
          .in("conversation_id", ids)
          .order("created_at", { ascending: false })
          .limit(400)
      : { data: [] as Row[] };
    const last: Record<string, Row> = {};
    for (const m of (msgs as Row[]) ?? []) {
      const cid = m.conversation_id as string;
      if (!last[cid]) last[cid] = m;
    }

    return {
      items: rows.map((c) => ({
        id: c.id as string,
        organization_id: c.organization_id as string,
        organization_name: ((c.organizations as Row | null)?.name as string | null) ?? "Client",
        scope: c.scope as ConversationScope,
        subject:
          (c.subject as string | null) ??
          ((c.positions as Row | null)?.title as string | null) ??
          "General",
        last_message_at: c.last_message_at as string,
        last_body: (last[c.id as string]?.body as string | undefined) ?? null,
      })),
    };
  });

/** Flat, chronological log of messages for one client account. */
export const listMessageHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        orgId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ items: HistoricalMessage[]; total: number }> => {
    return _listMessageHistoryHandler({ data, context });
  });

export async function _listMessageHistoryHandler({ data, context }: any): Promise<{ items: HistoricalMessage[]; total: number }> {
    const { supabase, userId } = context;
    await assertOrgAccess(supabase, userId, data.orgId);

    // Join with conversations to filter by org and get context.
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    const {
      data: msgs,
      error,
      count,
    } = await supabase
      .from("messages")
      .select(
        "id, conversation_id, body, created_at, sender_user_id, conversations!inner(organization_id, subject, scope, position_id, candidate_match_id)",
        { count: "exact" },
      )
      .eq("conversations.organization_id", data.orgId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    const rows = (msgs as Row[]) ?? [];
    if (rows.length === 0) return { items: [], total: count ?? 0 };

    const names = await nameMap(rows.map((m) => m.sender_user_id as string));
    const { resolveStaffPersona } = await import("./staff-persona.server");

    // Collect context data for scoped threads
    const positionIds = rows.map((r) => r.conversations.position_id).filter(Boolean) as string[];
    const matchIds = rows.map((r) => r.conversations.candidate_match_id).filter(Boolean) as string[];

    const [{ data: positions }, { data: matches }] = await Promise.all([
      positionIds.length
        ? supabase.from("positions").select("id, title").in("id", positionIds)
        : Promise.resolve({ data: [] as Row[] }),
      matchIds.length
        ? supabase
            .from("candidate_matches")
            .select("id, position_id, candidate_profiles(full_name), positions(title)")
            .in("id", matchIds)
        : Promise.resolve({ data: [] as Row[] }),
    ]);

    const positionTitle: Record<string, string> = {};
    for (const p of (positions as Row[]) ?? []) positionTitle[p.id as string] = p.title as string;

    const matchLabel: Record<string, string> = {};
    for (const m of (matches as Row[]) ?? []) {
      const cand = (m.candidate_profiles as Row | null)?.full_name as string | undefined;
      const role = (m.positions as Row | null)?.title as string | undefined;
      matchLabel[m.id as string] = [cand ?? "Candidate", role].filter(Boolean).join(" · ");
    }

    const items: HistoricalMessage[] = rows.map((m) => {
      const sid = (m.sender_user_id as string | null) ?? null;
      const meta = sid ? names[sid] : undefined;
      const persona = resolveStaffPersona({
        name: sid ? (meta?.name ?? null) : null,
        isStaff: sid ? (meta?.staff ?? false) : true,
        roleLabel: sid ? (meta?.role ?? null) : "TaaSFlow team",
      });

      const convo = m.conversations;
      const scope = convo.scope as ConversationScope;
      const contextLabel =
        scope === "position"
          ? (positionTitle[convo.position_id as string] ?? "Role")
          : scope === "candidate"
            ? (matchLabel[convo.candidate_match_id as string] ?? "Candidate")
            : null;

      return {
        id: m.id as string,
        conversation_id: m.conversation_id as string,
        body: m.body as string,
        created_at: m.created_at as string,
        sender_name: persona.name,
        sender_role: persona.role,
        sender_side: !sid ? "system" : meta?.staff ? "taasflow" : "client",
        mine: sid === userId,
        subject: (convo.subject as string | null) ?? contextLabel ?? "General",
        context_label: contextLabel,
      };
    });

    return { items, total: count ?? 0 };
}
