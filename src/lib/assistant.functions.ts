// Client AI Assistant — orchestrator (server-only handlers).
// Runs a tool-calling loop against Lovable AI Gateway (Gemini), with
// every tool query scoped to the caller's Supabase session (RLS).
//
// Grounded, permission-aware, cited. No fabrication.

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

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_STEPS = 6;
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `You are TaaSFlow's in-app pipeline assistant for hiring managers and recruiters.

Non-negotiables:
- You may ONLY use facts returned by the provided tools. Do NOT invent candidates, positions, scores, dates, or metrics.
- Every substantive claim in your reply MUST cite the underlying record inline using the token [[<kind>:<id>]] — e.g. [[match:8f0e...]] or [[position:12ab...]]. Use only IDs the tools returned to you in this turn.
- If a tool returns no results, say so plainly. Never guess.
- Answers should be concise, scannable Markdown: short intro sentence, then a bulleted list where useful.
- When a question needs data you have not yet fetched, call the right tool first, then answer.
- If the user asks something unrelated to their TaaSFlow pipeline (e.g. general knowledge, code help), politely redirect: this assistant only answers questions about their positions, candidates, matches, and hires inside TaaSFlow.
- Respect the user's role: you already only see what they can see; do not speculate about hidden data.

Actions (Action Mode):
- You may PROPOSE actions using the action tools (open_role, open_candidate, prepare_compare_set, generate_shortlist_summary, surface_pending_approvals, draft_interview_request).
- Action tools NEVER mutate on their own — they return a proposal. The UI shows the user a confirmation card; the user clicks Approve to execute.
- Never claim an action was performed. Say "I've prepared X — click Approve below to run it." Do NOT propose stage changes, silent outreach, or any mutation not in the allowed list above.

Question areas you handle well:
- What changed this week — use weekly_pipeline_changes.
- Who needs review — use matches_needing_review or surface_pending_approvals.
- Who best fits requirement X — use find_candidates_for_requirement.
- Why was candidate Y ranked here — use explain_candidate_score.
- What is blocking this role — use role_blockers.
- What should I do next — use next_actions.
- Open X / show me Y / compare A and B / draft interview request — use the matching action tool.` + CONFIDENCE_INSTRUCTIONS;


/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

// Tool schema shared with Gemini (OpenAI function-calling format).
const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "weekly_pipeline_changes",
      description:
        "Summarize what changed in the pipeline in the last 7 days: new applications, match stage/visibility updates, hire activity, position updates.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "matches_needing_review",
      description:
        "List candidate matches that need attention: pending admin approval, newly delivered to client, shortlist/interview/offer stages awaiting a decision.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "find_candidates_for_requirement",
      description:
        "Find candidates that best fit a specific requirement, skill, or keyword. Optionally scope to one position.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The requirement, skill, or keyword to search for (e.g. 'SQL', 'French', 'B2B SaaS sales').",
          },
          position_id: {
            type: "string",
            description: "Optional position UUID to limit results to a single role.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_candidate_score",
      description:
        "Return the evidence, requirement coverage, and explanation from the approved (or current) score run for a specific candidate match.",
      parameters: {
        type: "object",
        properties: {
          match_id: {
            type: "string",
            description: "The candidate_matches.id UUID.",
          },
        },
        required: ["match_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "role_blockers",
      description:
        "For one or all active positions, list what is blocking hiring progress: missing requirements, no applications, stalled CV/scoring processing, awaiting approvals.",
      parameters: {
        type: "object",
        properties: {
          position_id: {
            type: "string",
            description: "Optional position UUID. If omitted, checks every active role.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "next_actions",
      description:
        "Return the top prioritized actions the user should take right now across their pipeline.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  // ─── Action Mode tools (return proposals; NEVER mutate) ─────────────────
  {
    type: "function",
    function: {
      name: "open_role",
      description:
        "Propose opening the workspace for a specific position. Returns a navigation action the user can approve.",
      parameters: {
        type: "object",
        properties: { position_id: { type: "string", description: "positions.id UUID" } },
        required: ["position_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_candidate",
      description:
        "Propose opening a specific candidate match dossier. Returns a navigation action the user can approve.",
      parameters: {
        type: "object",
        properties: { match_id: { type: "string", description: "candidate_matches.id UUID" } },
        required: ["match_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_compare_set",
      description:
        "Propose comparing 2–6 candidate matches side-by-side. Returns a navigation action to the compare view.",
      parameters: {
        type: "object",
        properties: {
          match_ids: {
            type: "array",
            items: { type: "string" },
            description: "2 to 6 candidate_matches.id UUIDs.",
          },
          position_id: {
            type: "string",
            description: "Optional scoping position UUID.",
          },
        },
        required: ["match_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_shortlist_summary",
      description:
        "Compute a shortlist snapshot (candidates on shortlist/interview/offer stages for one position) with scores.",
      parameters: {
        type: "object",
        properties: { position_id: { type: "string" } },
        required: ["position_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "surface_pending_approvals",
      description:
        "List candidate matches currently awaiting a client-side decision (shortlist / interview / offer stages).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_interview_request",
      description:
        "Draft — but do NOT send — an interview request message to the TaaSFlow team for a specific candidate match. Returns an editable, user-approvable draft.",
      parameters: {
        type: "object",
        properties: {
          match_id: { type: "string" },
          notes: { type: "string", description: "Optional context for scheduling." },
        },
        required: ["match_id"],
      },
    },
  },
];

async function runTool(
  supabase: AnyRow,
  orgId: string,
  name: string,
  args: Record<string, unknown>,
) {
  const tools = await import("./assistant-tools.server");
  switch (name) {
    case "weekly_pipeline_changes":
      return tools.weeklyPipelineChanges(supabase, orgId);
    case "matches_needing_review":
      return tools.matchesNeedingReview(supabase, orgId);
    case "find_candidates_for_requirement":
      return tools.findCandidatesForRequirement(
        supabase,
        orgId,
        String(args.query ?? ""),
        (args.position_id as string | undefined) ?? null,
      );
    case "explain_candidate_score":
      return tools.explainCandidateScore(
        supabase,
        orgId,
        String(args.match_id ?? ""),
      );
    case "role_blockers":
      return tools.roleBlockers(
        supabase,
        orgId,
        (args.position_id as string | undefined) ?? null,
      );
    case "next_actions":
      return tools.nextActions(supabase, orgId);
    // Action Mode
    case "open_role":
    case "open_candidate":
    case "prepare_compare_set":
    case "generate_shortlist_summary":
    case "surface_pending_approvals":
    case "draft_interview_request": {
      const actions = await import("./assistant-actions.server");
      switch (name) {
        case "open_role":
          return actions.proposeOpenRole(supabase, orgId, String(args.position_id ?? ""));
        case "open_candidate":
          return actions.proposeOpenCandidate(supabase, orgId, String(args.match_id ?? ""));
        case "prepare_compare_set":
          return actions.prepareCompareSet(
            supabase,
            orgId,
            Array.isArray(args.match_ids) ? (args.match_ids as string[]) : [],
            (args.position_id as string | undefined) ?? null,
          );
        case "generate_shortlist_summary":
          return actions.generateShortlistSummary(supabase, orgId, String(args.position_id ?? ""));
        case "surface_pending_approvals":
          return actions.surfacePendingApprovals(supabase, orgId);
        case "draft_interview_request":
          return actions.proposeDraftInterviewRequest(
            supabase,
            orgId,
            String(args.match_id ?? ""),
            (args.notes as string | undefined) ?? null,
          );
      }
      return { data: {}, citations: [] };
    }
    default:
      return { data: { error: `unknown_tool:${name}` }, citations: [] };
  }
}

// ─── ensureConversation ─────────────────────────────────────────────────────
async function ensureConversation(
  supabase: AnyRow,
  orgId: string,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("assistant_conversations")
    .insert({
      organization_id: orgId,
      user_id: userId,
      title: "Pipeline assistant",
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

// ─── getAssistantState — history for UI ─────────────────────────────────────
export const getAssistantState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const conversationId = await ensureConversation(
      context.supabase,
      data.orgId,
      context.userId,
    );
    const { data: rows, error } = await context.supabase
      .from("assistant_messages")
      .select("id, role, content, tool_trace, citations, proposed_actions, confidence, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      conversation_id: conversationId,
      messages: (rows ?? []) as Array<{
        id: string;
        role: "user" | "assistant" | "system";
        content: string;
        tool_trace: Array<{ name: string; args: Record<string, string | number | boolean | null> }>;
        citations: Array<{ kind: string; id: string; label: string; href?: string }>;
        proposed_actions: Array<Record<string, string | number | boolean | null>>;
        confidence: Confidence | null;
        created_at: string;
      }>,
    };
  });

// ─── resetAssistant — archive current conversation ──────────────────────────
export const resetAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string }) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("assistant_conversations")
      .update({ archived_at: new Date().toISOString() } as never)
      .eq("organization_id", data.orgId)
      .eq("user_id", context.userId)
      .is("archived_at", null);
    const conversationId = await ensureConversation(
      context.supabase,
      data.orgId,
      context.userId,
    );
    return { conversation_id: conversationId };
  });

// ─── askAssistant — main tool-loop entry point ──────────────────────────────
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; message: string }) =>
    z
      .object({
        orgId: z.string().uuid(),
        message: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Assistant unavailable: LOVABLE_API_KEY missing");

    const conversationId = await ensureConversation(
      context.supabase,
      data.orgId,
      context.userId,
    );

    // Load recent history
    const { data: history } = await context.supabase
      .from("assistant_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);
    const priorMessages = (history ?? [])
      .reverse()
      .map((m: AnyRow) => ({
        role: m.role as "user" | "assistant",
        content: m.content as string,
      }))
      .filter((m: AnyRow) => m.role === "user" || m.role === "assistant");

    // Persist user message
    const userInsert = await context.supabase
      .from("assistant_messages")
      .insert({
        conversation_id: conversationId,
        organization_id: data.orgId,
        user_id: context.userId,
        role: "user",
        content: data.message,
      } as never)
      .select("id, created_at")
      .single();
    if (userInsert.error) throw new Error(userInsert.error.message);

    // Audit: user prompt
    await auditAssistantEvent(context.supabase, {
      surface: "client_assistant",
      event_type: "prompt",
      user_id: context.userId,
      organization_id: data.orgId,
      conversation_id: conversationId,
      message_id: userInsert.data.id as string,
      content_preview: data.message,
    });

    // Build initial message list
    const messages: AnyRow[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...priorMessages,
      { role: "user", content: data.message },
    ];

    const start = Date.now();
    const tool_trace: Array<{ name: string; args: Record<string, string | number | boolean | null>; note?: string }> = [];
    const citationsMap = new Map<string, {
      kind: string; id: string; label: string; href?: string;
    }>();
    const proposedActionsMap = new Map<string, AnyRow>();

    let finalContent = "";
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOL_DEFS,
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        await auditAssistantEvent(context.supabase, {
          surface: "client_assistant",
          event_type: "gateway_error",
          user_id: context.userId,
          organization_id: data.orgId,
          conversation_id: conversationId,
          payload: { status: res.status, body_preview: body.slice(0, 200) },
        });
        if (res.status === 429) {
          finalContent = "I'm hitting a rate limit right now — please try again in a moment.";
          break;
        }
        if (res.status === 402) {
          finalContent = "This workspace is out of AI credits. Add credits to keep using the assistant.";
          break;
        }
        finalContent = `Assistant error (${res.status}): ${body.slice(0, 160)}`;
        break;
      }
      const j = (await res.json()) as {
        choices?: Array<{ message?: {
          role: "assistant";
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        } }>;
      };
      const msg = j.choices?.[0]?.message;
      if (!msg) {
        finalContent = "The assistant returned no response — please try again.";
        break;
      }

      if (msg.tool_calls && msg.tool_calls.length) {
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: msg.tool_calls,
        });
        for (const call of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await runTool(
            context.supabase,
            data.orgId,
            call.function.name,
            args,
          );
          tool_trace.push({
            name: call.function.name,
            args: args as Record<string, string | number | boolean | null>,
            note: result.note,
          });
          for (const c of result.citations) {
            citationsMap.set(`${c.kind}:${c.id}`, c);
          }
          const proposals = (result as AnyRow).proposed_actions as AnyRow[] | undefined;
          if (Array.isArray(proposals)) {
            for (const a of proposals) {
              if (a && typeof a.action_id === "string") proposedActionsMap.set(a.action_id, a);
            }
          }
          const resultRowCount = Array.isArray((result as AnyRow).data)
            ? ((result as AnyRow).data as unknown[]).length
            : Array.isArray(((result as AnyRow).data as AnyRow)?.rows)
              ? (((result as AnyRow).data as AnyRow).rows as unknown[]).length
              : null;
          await auditAssistantEvent(context.supabase, {
            surface: "client_assistant",
            event_type: "tool_call",
            user_id: context.userId,
            organization_id: data.orgId,
            conversation_id: conversationId,
            tool_name: call.function.name,
            payload: {
              args,
              citation_count: result.citations.length,
              row_count: resultRowCount,
              proposed_count: Array.isArray(proposals) ? proposals.length : 0,
            },
          });
          if (resultRowCount === 0) {
            await auditAssistantEvent(context.supabase, {
              surface: "client_assistant",
              event_type: "guardrail_missing_data",
              user_id: context.userId,
              organization_id: data.orgId,
              conversation_id: conversationId,
              tool_name: call.function.name,
              payload: { args },
            });
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

    if (!finalContent) {
      finalContent = "I couldn't complete that. Try rephrasing or asking a more specific question about your pipeline.";
    }

    const citations = Array.from(citationsMap.values());
    const proposedActions = Array.from(proposedActionsMap.values());

    // Extract [[confidence:xxx]] from the tail, then clamp to what the
    // evidence actually supports (never upgrade over model's declaration).
    const { text: cleaned, declared } = extractConfidence(finalContent);
    const confidence: Confidence = resolveConfidence({
      declared,
      toolCount: tool_trace.length,
      citationCount: citations.length,
      content: cleaned,
    });
    finalContent = cleaned;

    const assistantInsert = await context.supabase
      .from("assistant_messages")
      .insert({
        conversation_id: conversationId,
        organization_id: data.orgId,
        user_id: context.userId,
        role: "assistant",
        content: finalContent,
        tool_trace: tool_trace as never,
        citations: citations as never,
        proposed_actions: proposedActions as never,
        confidence,
        model: MODEL,
        latency_ms: Date.now() - start,
      } as never)
      .select("id, created_at, role, content, tool_trace, citations, proposed_actions, confidence")
      .single();
    if (assistantInsert.error) throw new Error(assistantInsert.error.message);

    // Audit each proposed action so we can later reconcile approvals vs. proposals.
    for (const a of proposedActions) {
      await auditAssistantEvent(context.supabase, {
        surface: "client_assistant",
        event_type: "action_proposed",
        user_id: context.userId,
        organization_id: data.orgId,
        conversation_id: conversationId,
        message_id: assistantInsert.data.id as string,
        action_id: (a as AnyRow).action_id as string,
        payload: {
          kind: (a as AnyRow).kind,
          label: (a as AnyRow).label,
          match_id: (a as AnyRow).match_id ?? null,
          href: (a as AnyRow).href ?? null,
        },
      });
    }

    // Touch conversation
    await context.supabase
      .from("assistant_conversations")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", conversationId);

    return {
      conversation_id: conversationId,
      user_message: {
        id: userInsert.data.id as string,
        role: "user" as const,
        content: data.message,
        tool_trace: [] as Array<{ name: string; args: Record<string, string | number | boolean | null> }>,
        citations: [] as typeof citations,
        proposed_actions: [] as AnyRow[],
        confidence: null as Confidence | null,
        created_at: userInsert.data.created_at as string,
      },
      assistant_message: {
        id: assistantInsert.data.id as string,
        role: "assistant" as const,
        content: assistantInsert.data.content as string,
        tool_trace: assistantInsert.data.tool_trace as Array<{ name: string; args: Record<string, string | number | boolean | null> }>,
        citations: assistantInsert.data.citations as typeof citations,
        proposed_actions: (assistantInsert.data as AnyRow).proposed_actions as AnyRow[],
        confidence: (assistantInsert.data as AnyRow).confidence as Confidence | null,
        created_at: (assistantInsert.data as AnyRow).created_at as string,
      },
    };
  });

// ─── executeAssistantAction — the ONLY mutation path ────────────────────────
// The client sends the action payload that was previously shown as a
// confirmation card. We re-verify authority (RLS via context.supabase) and
// perform the specific mutation. Nothing else in the assistant path can write.
export const executeAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orgId: string; action: AnyRow }) =>
    z
      .object({
        orgId: z.string().uuid(),
        action: z.object({
          kind: z.enum(["navigate", "draft_interview_request"]),
          action_id: z.string(),
          match_id: z.string().uuid().optional(),
          draft_body: z.string().min(1).max(4000).optional(),
          href: z.string().optional(),
        }).passthrough(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const action = data.action;

    if (action.kind === "navigate") {
      // Navigation actions are client-side; server just acknowledges.
      return { ok: true as const, kind: "navigate" as const, href: action.href ?? "/client" };
    }

    if (action.kind === "draft_interview_request") {
      const matchId = action.match_id;
      const body = action.draft_body;
      if (!matchId || !body) throw new Error("Missing match_id or draft_body");

      // Confirm the caller can actually see this match under RLS (belt & braces).
      const { data: match } = await context.supabase
        .from("candidate_matches")
        .select("id, positions(title), candidate_profiles(full_name)")
        .eq("organization_id", data.orgId)
        .eq("id", matchId)
        .maybeSingle();
      if (!match) throw new Error("Match not accessible");

      // Post as a message on the org thread — same table the client already
      // uses for TaaSFlow team conversations.
      const { error } = await context.supabase.from("messages").insert({
        thread_id: data.orgId,
        sender_user_id: context.userId,
        body,
        recipient_context: {
          audience: "taasflow_ops",
          from: "client_assistant",
          match_id: matchId,
          intent: "interview_request",
        },
      } as never);
      if (error) throw new Error(error.message);

      return {
        ok: true as const,
        kind: "draft_interview_request" as const,
        match_id: matchId,
      };
    }

    return { ok: false as const, error: "unknown_action_kind" };
  });
