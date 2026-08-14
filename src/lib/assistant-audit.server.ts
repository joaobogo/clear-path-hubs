// Shared audit + confidence helpers for the client assistant and admin copilot.
// Every prompt, tool call, proposed action, and executed action lands in
// public.assistant_audit_events. Reads are RLS-gated to the actor, their org
// admins, and platform staff.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

export type AuditSurface = "client_assistant" | "admin_copilot";
export type AuditEventType =
  | "prompt"
  | "tool_call"
  | "action_proposed"
  | "action_executed"
  | "action_denied"
  | "action_failed"
  | "gateway_error"
  | "guardrail_missing_data";

export type Confidence = "high" | "medium" | "low" | "none";

const CONFIDENCE_RE = /\[\[confidence:(high|medium|low|none)\]\]/i;

/** Strip the trailing `[[confidence:xxx]]` token from the model's reply and
 * return both the cleaned text and the declared confidence (if any). */
export function extractConfidence(content: string): {
  text: string;
  declared: Confidence | null;
} {
  const m = content.match(CONFIDENCE_RE);
  if (!m) return { text: content.trim(), declared: null };
  const declared = m[1].toLowerCase() as Confidence;
  const text = content.replace(CONFIDENCE_RE, "").trim();
  return { text, declared };
}

/** Compute an evidence-based confidence ceiling. The model's declared value is
 * clamped down (never up) to what the tool trace actually supports. */
export function resolveConfidence(opts: {
  declared: Confidence | null;
  toolCount: number;
  citationCount: number;
  content: string;
}): Confidence {
  const { declared, toolCount, citationCount, content } = opts;
  const lower = content.toLowerCase();
  const idk =
    lower.includes("i don't know") ||
    lower.includes("i do not know") ||
    lower.includes("i can't answer") ||
    lower.includes("i cannot answer");
  let evidenceCeiling: Confidence;
  if (idk) evidenceCeiling = "none";
  else if (toolCount === 0 && citationCount === 0) evidenceCeiling = "low";
  else if (citationCount === 0) evidenceCeiling = "medium";
  else evidenceCeiling = "high";

  const rank: Record<Confidence, number> = { none: 0, low: 1, medium: 2, high: 3 };
  const declaredRank = declared ? rank[declared] : rank.high;
  const ceilingRank = rank[evidenceCeiling];
  const finalRank = Math.min(declaredRank, ceilingRank);
  return (Object.keys(rank) as Confidence[]).find((k) => rank[k] === finalRank) ?? "low";
}

interface AuditInput {
  surface: AuditSurface;
  event_type: AuditEventType;
  user_id: string;
  organization_id?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  action_id?: string | null;
  tool_name?: string | null;
  content_preview?: string | null;
  payload?: Record<string, unknown>;
}

/** Fire-and-forget audit write. Never throws — assistant flow continues even
 * if audit insert fails (surface the error server-side only). */
export async function auditAssistantEvent(
  supabase: AnyRow,
  input: AuditInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("assistant_audit_events").insert({
      surface: input.surface,
      event_type: input.event_type,
      user_id: input.user_id,
      organization_id: input.organization_id ?? null,
      conversation_id: input.conversation_id ?? null,
      message_id: input.message_id ?? null,
      action_id: input.action_id ?? null,
      tool_name: input.tool_name ?? null,
      content_preview: input.content_preview
        ? input.content_preview.slice(0, 400)
        : null,
      payload: input.payload ?? {},
    } as never);
    if (error) console.warn("assistant_audit insert failed:", error.message);
  } catch (e) {
    console.warn("assistant_audit exception:", (e as Error).message);
  }
}

/** Instruction block appended to every assistant/copilot system prompt so both
 * orchestrators emit the same guardrail, "I don't know" behavior, missing-data
 * language, and trailing `[[confidence:...]]` label. */
export const CONFIDENCE_INSTRUCTIONS = `

Confidence, guardrails, and "I don't know" behavior:
- End EVERY reply with a single line: [[confidence:high|medium|low|none]]
  • high    — tools returned records that directly answer the question, cited inline.
  • medium  — tools returned partial or indirect evidence; caveats stated.
  • low     — no tools were called, or tool results did not fully cover the question.
  • none    — you cannot answer from the available data.
- If your tools cannot answer the question, reply plainly: "I don't know based on your TaaSFlow data." Then list what specific record or filter would be needed to answer, and stop. Do not speculate, guess, or fill in with generic advice.
- If a tool returns zero rows, say so explicitly (e.g. "Nothing matches that filter this week."). Do not silently swap to a different answer.
- If the user asks for someone or something you cannot find in the tool results, say you couldn't find it — never invent a match.
- Every substantive factual claim must be immediately followed by [[kind:id]] citations for the specific records that support it. Claims with no citation are not allowed.`;
