/**
 * The hiring team's optional question for the introduction video.
 *
 * Stored per role at positions.intake_context.posting.video_prompt. When set,
 * the public job page invites a short video answering it and the apply form
 * shows it above the video link field; when absent or blank, both read exactly
 * as they always have. The video stays optional either way.
 *
 * The prompt reaches the open internet, so it is read defensively: whitespace
 * is collapsed, quotes the author typed around it are dropped (the page adds
 * its own), it is capped at VIDEO_PROMPT_MAX, and a prompt that asks about a
 * protected attribute is never shown (the same detector every role text
 * passes before it is published).
 */
import { hasProtectedCriteria } from "@/lib/scoring/protected-attributes";

export const VIDEO_PROMPT_MAX = 400;

/** The line that introduces the prompt wherever a candidate sees it. */
export const VIDEO_PROMPT_LEAD = "The hiring team would love to hear your answer to:";

/** The note beside the apply form's video label: a prompt makes it recommended, never required. */
export function videoFieldOptionalNote(prompt: string | null | undefined): string {
  return prompt ? "(optional, highly recommended)" : "(optional)";
}

/** One matching pair of wrapping quotes, straight or curly. */
const WRAPPING_QUOTES = /^(?:"([\s\S]*)"|“([\s\S]*)”|'([\s\S]*)'|‘([\s\S]*)’)$/;

function unwrapQuotes(text: string): string {
  const m = WRAPPING_QUOTES.exec(text);
  if (!m) return text;
  return (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
}

function capAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace > max / 2 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** The prompt as candidates may see it, or null when there is none to show. */
export function normalizeVideoPrompt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = unwrapQuotes(raw.replace(/\s+/g, " ").trim());
  if (!text) return null;
  // The whole prompt is checked, not just the part that survives the cap.
  if (hasProtectedCriteria(text)) return null;
  return capAtWord(text, VIDEO_PROMPT_MAX);
}
