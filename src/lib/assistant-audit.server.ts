// Shared audit + confidence helpers for the admin copilot.
// All events are stored in public.assistant_audit_events.
// Reads are RLS-gated to the actor and their organization.

import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

export type AuditSurface = "admin_copilot";

/** Fire-and-forget audit write. Never throws — assistant flow continues even
 * if the audit record fails. */
export async function auditAssistantEvent(
  supabase: SupabaseClient,
  event: {
    surface: AuditSurface;
    event_type:
      | "prompt"
      | "tool_call"
      | "action_proposed"
      | "action_executed"
      | "action_denied"
      | "gateway_error"
      | "guardrail_missing_data"
      | "guardrail_hallucination";
    user_id: string;
    conversation_id?: string;
    message_id?: string;
    action_id?: string;
    organization_id?: string | null;
    tool_name?: string;
    content_preview?: string;
    payload?: Record<string, any>;
  },
) {
  try {
    const { error } = await supabase.from("assistant_audit_events").insert({
      surface: event.surface,
      event_type: event.event_type,
      user_id: event.user_id,
      conversation_id: event.conversation_id,
      message_id: event.message_id,
      action_id: event.action_id,
      organization_id: event.organization_id,
      tool_name: event.tool_name,
      content_preview: event.content_preview?.slice(0, 1000),
      payload: event.payload,
    } as never);
    if (error) {
      console.warn("Assistant audit failure:", error.message);
    }
  } catch (err) {
    console.error("Assistant audit exception:", err);
  }
}

export const CONFIDENCE_INSTRUCTIONS = `
At the VERY end of your response, you MUST include a JSON block with your confidence assessment. 
The assessment is based ONLY on the evidence returned by tools.
Example:
[CONFIDENCE: {"level": "high", "reason": "Exact match for all requirements found in match records."}]
Levels: low, medium, high.
`;

export type ConfidenceLevel = "low" | "medium" | "high";

export interface Confidence {
  level: ConfidenceLevel;
  reason: string;
}

/** Extract the [CONFIDENCE: {...}] block from assistant text. */
export function extractConfidence(text: string): { text: string; declared: Confidence | null } {
  const match = text.match(/\[CONFIDENCE:\s*({.*?})\]/s);
  if (!match) return { text, declared: null };
  try {
    const declared = JSON.parse(match[1]);
    const cleaned = text.replace(match[0], "").trim();
    return { text: cleaned, declared };
  } catch {
    return { text, declared: null };
  }
}

/** Final heuristic resolution of confidence. */
export function resolveConfidence(params: {
  declared: Confidence | null;
  toolCount: number;
  citationCount: number;
  content: string;
}): Confidence {
  if (params.declared) return params.declared;
  if (params.toolCount === 0) return { level: "low", reason: "No tools were called." };
  if (params.citationCount === 0) return { level: "low", reason: "No records were cited." };
  return { level: "medium", reason: "Responded using tool evidence." };
}
