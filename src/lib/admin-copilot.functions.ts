// Admin AI Copilot — staff-only orchestrator.
// Same tool-loop pattern as the client assistant, but:
//   - table set: admin_copilot_conversations / admin_copilot_messages
//   - RLS enforced staff-only (see migration)
//   - broader tool catalog (portfolio, outreach drafts, source performance)
//   - draft actions are proposals; nothing is sent until the user approves
//     via executeAdminCopilotAction.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  CONFIDENCE_INSTRUCTIONS,
  auditAssistantEvent,
  extractConfidence,
  resolveConfidence,
  type Confidence,
} from "./assistant-audit.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_STEPS = 6;
const HISTORY_LIMIT = 24;

const SYSTEM_PROMPT = `You are TaaSFlow's admin recruiting copilot for the internal ops/admin team.

Non-negotiables:
- You may ONLY use facts returned by the provided tools. Do NOT invent clients, candidates, positions, scores, dates, or metrics.
- Every substantive claim must cite the underlying record inline using [[<kind>:<id>]] (e.g. [[organization:...]], [[match:...]], [[position:...]], [[candidate:...]]). Use only IDs the tools returned in this turn.
- If a tool returns no data, say so plainly.
- Answers are concise, scannable Markdown.

Action Mode (drafts only — nothing is sent until the user approves):
- draft_client_update prepares a weekly-update draft for one client.
- draft_candidate_outreach prepares an outreach draft for one candidate/match.
- Never claim a message was sent. Say "I've prepared the draft — review and click Approve to send."

Coverage:
- summarize_client_portfolio, summarize_candidate_history, blocked_roles, stalled_interviews, missing_approvals, rediscovery_candidates, source_performance.` + CONFIDENCE_INSTRUCTIONS;

const TOOL_DEFS: AnyRow[] = [
  {
    type: "function",
    function: {
      name: "summarize_client_portfolio",
      description: "Return a snapshot of client organizations (open roles, active shortlists).",
      parameters: {
        type: "object",
        properties: { org_id: { type: "string", description: "Optional: restrict to one client org." } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_candidate_history",
      description: "Return all matches / stages / dates for a single candidate.",
      parameters: {
        type: "object",
        properties: { candidate_id: { type: "string" } },
        required: ["candidate_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "blocked_roles",
      description: "Open roles older than 14 days with zero candidates in shortlist/interview/offer.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "stalled_interviews",
      description: "Interviews that have not been updated in the last 7 days.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "missing_approvals",
      description: "Matches waiting on a client decision (shortlist/interview/offer) for 3+ days.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "rediscovery_candidates",
      description: "Silver-medalist / talent-memory candidates worth resurfacing.",
      parameters: {
        type: "object",
        properties: { position_id: { type: "string" } },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_client_update",
      description: "Prepare (do NOT send) a weekly update draft for a specific client org.",
      parameters: {
        type: "object",
        properties: { org_id: { type: "string" } },
        required: ["org_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_candidate_outreach",
      description: "Prepare (do NOT send) an outreach draft for a candidate match.",
      parameters: {
        type: "object",
        properties: {
          match_id: { type: "string" },
          intent: { type: "string", description: "Short reason: 'interview scheduling', 'status update', etc." },
        },
        required: ["match_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "source_performance",
      description: "Applications, shortlist, interview, and hire rates by source over the last 90 days.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

async function runTool(supabase: AnyRow, name: string, args: Record<string, unknown>) {
  const t = await import("./admin-copilot-tools.server");
  switch (name) {
    case "summarize_client_portfolio":
      return t.summarizeClientPortfolio(supabase, (args.org_id as string | undefined) ?? null);
    case "summarize_candidate_history":
      return t.summarizeCandidateHistory(supabase, String(args.candidate_id ?? ""));
    case "blocked_roles":
      return t.blockedRoles(supabase);
    case "stalled_interviews":
      return t.stalledInterviews(supabase);
    case "missing_approvals":
      return t.missingApprovals(supabase);
    case "rediscovery_candidates":
      return t.rediscoveryCandidates(supabase, (args.position_id as string | undefined) ?? null);
    case "draft_client_update":
      return t.draftClientUpdate(supabase, String(args.org_id ?? ""));
    case "draft_candidate_outreach":
      return t.draftCandidateOutreach(
        supabase,
        String(args.match_id ?? ""),
        (args.intent as string | undefined) ?? null,
      );
    case "source_performance":
      return t.sourcePerformance(supabase);
    default:
      return { data: { error: `unknown_tool:${name}` }, citations: [] };
  }
}

async function ensureConversation(supabase: AnyRow, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("admin_copilot_conversations")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabase
    .from("admin_copilot_conversations")
    .insert({ user_id: userId, title: "Admin copilot" } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export const getCopilotState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const conversationId = await ensureConversation(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("admin_copilot_messages")
      .select("id, role, content, tool_trace, citations, proposed_actions, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { conversation_id: conversationId, messages: rows ?? [] };
  });

export const resetCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("admin_copilot_conversations")
      .update({ archived_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId)
      .is("archived_at", null);
    const conversationId = await ensureConversation(context.supabase, context.userId);
    return { conversation_id: conversationId };
  });

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { message: string }) =>
    z.object({ message: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Copilot unavailable: LOVABLE_API_KEY missing");

    const conversationId = await ensureConversation(context.supabase, context.userId);

    const { data: history } = await context.supabase
      .from("admin_copilot_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const priorMessages = (history ?? [])
      .reverse()
      .map((m: AnyRow) => ({ role: m.role as "user" | "assistant", content: m.content as string }))
      .filter((m: AnyRow) => m.role === "user" || m.role === "assistant");

    const userInsert = await context.supabase
      .from("admin_copilot_messages")
      .insert({
        conversation_id: conversationId,
        user_id: context.userId,
        role: "user",
        content: data.message,
      } as never)
      .select("id, created_at")
      .single();
    if (userInsert.error) throw new Error(userInsert.error.message);

    const messages: AnyRow[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...priorMessages,
      { role: "user", content: data.message },
    ];

    const start = Date.now();
    const tool_trace: Array<{ name: string; args: Record<string, string | number | boolean | null> }> = [];
    const citationsMap = new Map<string, AnyRow>();
    const proposedMap = new Map<string, AnyRow>();
    let finalContent = "";

    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, messages, tools: TOOL_DEFS, temperature: 0.2 }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) { finalContent = "Rate-limited — please try again shortly."; break; }
        if (res.status === 402) { finalContent = "Workspace is out of AI credits."; break; }
        finalContent = `Copilot error (${res.status}): ${body.slice(0, 160)}`;
        break;
      }
      const j = (await res.json()) as {
        choices?: Array<{ message?: { role: "assistant"; content?: string | null; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> } }>;
      };
      const msg = j.choices?.[0]?.message;
      if (!msg) { finalContent = "No response from copilot."; break; }

      if (msg.tool_calls && msg.tool_calls.length) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const call of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = {}; }
          const result = await runTool(context.supabase, call.function.name, args);
          tool_trace.push({ name: call.function.name, args: args as Record<string, string | number | boolean | null> });
          for (const c of (result.citations ?? []) as AnyRow[]) {
            citationsMap.set(`${c.kind}:${c.id}`, c);
          }
          const proposals = (result as AnyRow).proposed_actions as AnyRow[] | undefined;
          if (Array.isArray(proposals)) {
            for (const a of proposals) if (a?.action_id) proposedMap.set(a.action_id, a);
          }
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result.data).slice(0, 24000),
          });
        }
        continue;
      }
      finalContent = (msg.content ?? "").trim();
      break;
    }
    if (!finalContent) finalContent = "I couldn't complete that. Try rephrasing.";

    const citations = Array.from(citationsMap.values());
    const proposedActions = Array.from(proposedMap.values());

    const assistantInsert = await context.supabase
      .from("admin_copilot_messages")
      .insert({
        conversation_id: conversationId,
        user_id: context.userId,
        role: "assistant",
        content: finalContent,
        tool_trace: tool_trace as never,
        citations: citations as never,
        proposed_actions: proposedActions as never,
        model: MODEL,
        latency_ms: Date.now() - start,
      } as never)
      .select("id, created_at, role, content, tool_trace, citations, proposed_actions")
      .single();
    if (assistantInsert.error) throw new Error(assistantInsert.error.message);

    await context.supabase
      .from("admin_copilot_conversations")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", conversationId);

    return {
      conversation_id: conversationId,
      user_message: {
        id: userInsert.data.id as string,
        role: "user" as const,
        content: data.message,
        tool_trace: [],
        citations: [],
        proposed_actions: [],
        created_at: userInsert.data.created_at as string,
      },
      assistant_message: assistantInsert.data as AnyRow,
    };
  });

// ─── executeCopilotAction — the ONLY mutation path ────────────────────────
export const executeCopilotAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { action: AnyRow }) =>
    z
      .object({
        action: z
          .object({
            kind: z.enum(["navigate", "draft_client_update", "draft_candidate_outreach"]),
            action_id: z.string(),
            org_id: z.string().uuid().optional(),
            match_id: z.string().uuid().optional(),
            draft_body: z.string().min(1).max(4000).optional(),
            href: z.string().optional(),
          })
          .passthrough(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    // Staff-only enforcement: the RLS policies on admin_copilot_* already
    // require is_platform_staff, but this executor writes into general tables
    // (messages), so re-check role explicitly.
    const { data: staff } = await context.supabase.rpc("is_platform_staff", { _user: context.userId });
    if (!staff) throw new Error("Forbidden");

    const a = data.action;
    if (a.kind === "navigate") {
      return { ok: true as const, kind: "navigate" as const, href: a.href ?? "/admin" };
    }

    if (a.kind === "draft_client_update") {
      if (!a.org_id || !a.draft_body) throw new Error("Missing org_id or draft_body");
      const { error } = await context.supabase.from("messages").insert({
        thread_id: a.org_id,
        sender_user_id: context.userId,
        body: a.draft_body,
        recipient_context: {
          org_id: a.org_id,
          thread_kind: "client_workspace",
          from: "admin_copilot",
        },
      } as never);
      if (error) throw new Error(error.message);
      return { ok: true as const, kind: "draft_client_update" as const, org_id: a.org_id };
    }

    if (a.kind === "draft_candidate_outreach") {
      if (!a.match_id || !a.draft_body) throw new Error("Missing match_id or draft_body");
      // Look up the candidate + org to route outreach into the candidate thread.
      const { data: match } = await context.supabase
        .from("candidate_matches")
        .select("id, candidate_id, organization_id")
        .eq("id", a.match_id)
        .maybeSingle();
      if (!match) throw new Error("Match not accessible");
      const { error } = await context.supabase.from("messages").insert({
        thread_id: (match as AnyRow).candidate_id,
        sender_user_id: context.userId,
        body: a.draft_body,
        recipient_context: {
          match_id: a.match_id,
          candidate_id: (match as AnyRow).candidate_id,
          organization_id: (match as AnyRow).organization_id,
          from: "admin_copilot",
          thread_kind: "candidate_outreach",
        },
      } as never);
      if (error) throw new Error(error.message);
      return { ok: true as const, kind: "draft_candidate_outreach" as const, match_id: a.match_id };
    }

    return { ok: false as const, error: "unknown_action_kind" };
  });
