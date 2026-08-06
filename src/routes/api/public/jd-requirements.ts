import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  conflictResponse,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/public-api/rate-limit";
import {
  auditConflict,
  auditPayloadTooLarge,
  auditRateLimited,
  emailDomain,
} from "@/lib/public-api/outcome-audit";
import { assertFieldLength, readJsonWithLimit } from "@/lib/public-api/body-limit";
import {
  MAX_REQUIREMENT_CHARS,
  MIN_REQUIREMENT_CHARS,
  REQUIREMENT_TAGS,
  normalizeRequirementKey,
  type RequirementTag,
} from "@/lib/express-intake-schema";

/**
 * Suggests tagged requirements from a job description so step 2 of the intake
 * starts from something real instead of a blank list.
 *
 * Public by URL and unauthenticated because the intake itself is: it takes only
 * text the caller already has, writes nothing, and returns nothing but
 * suggestions. Every suggestion is a suggestion — the client accepts, edits or
 * discards it before anything is saved.
 *
 * Failure is never fatal. Any problem returns ok:false with a reason, and the
 * wizard falls back to manual entry with a visible note.
 */

/**
 * Hard ceilings, enforced before any LLM call.
 *
 * MAX_BODY_BYTES bounds what we are willing to read off the wire at all;
 * the character limits bound what a single field may contain. A job
 * description longer than this is a paste accident or an abuse attempt, not a
 * role brief — either way the caller gets a clear 413 instead of us paying to
 * tokenize it.
 */
const MAX_BODY_BYTES = 80_000;
const MAX_JD_CHARS = 30_000;
const MAX_TITLE_CHARS = 160;

const bodySchema = z.object({
  roleTitle: z.string().trim().max(MAX_TITLE_CHARS).optional().default(""),
  jobDescriptionText: z.string().trim().min(1).max(MAX_JD_CHARS),
});

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_SUGGESTIONS = 12;

function isTag(value: unknown): value is RequirementTag {
  return typeof value === "string" && (REQUIREMENT_TAGS as readonly string[]).includes(value);
}

/** Keeps only well-formed, de-duplicated, length-legal suggestions. */
function cleanSuggestions(raw: unknown): Array<{ text: string; tag: RequirementTag }> {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Array<{ text: string; tag: RequirementTag }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const text = String((entry as Record<string, unknown>)["text"] ?? "")
      .replace(/^[-•*\s]+/, "")
      .trim();
    const tag = (entry as Record<string, unknown>)["tag"];
    if (text.length < MIN_REQUIREMENT_CHARS || text.length > MAX_REQUIREMENT_CHARS) continue;
    if (!isTag(tag)) continue;
    const key = normalizeRequirementKey(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, tag });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}

export const Route = createFileRoute("/api/public/jd-requirements")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = clientIp(request);
        const traceId = newTraceId("jd_requirements");
        const decision = consumeRateLimit("jd_requirements", ip, PUBLIC_RATE_LIMITS.jd_requirements);
        if (decision.limited) {
          await auditRateLimited({
            scope: "jd_requirements",
            traceId,
            ip,
            path: "/api/public/jd-requirements",
            limit: decision.limit,
            retryAfterSeconds: decision.retryAfterSeconds,
          });
          return rateLimitResponse(traceId, decision);
        }

        const response = await (async (): Promise<Response> => {
        // This endpoint spends money on every call: an unauthenticated caller can
        // push 60k characters into a paid LLM gateway. Throttle before parsing.

        const read = await readJsonWithLimit(request, MAX_BODY_BYTES);
        if (!read.ok) {
          if (read.status === 413) {
            await auditPayloadTooLarge({
              scope: "jd_requirements",
              traceId,
              ip,
              path: "/api/public/jd-requirements",
              reason: read.error,
              detail: read.detail,
            });
          }
          return Response.json(
            {
              ok: false,
              error: read.error,
              message:
                read.status === 413
                  ? `Job description is too large. Limit is ${MAX_BODY_BYTES} bytes.`
                  : "Request body could not be read as JSON.",
              limits: { maxBodyBytes: MAX_BODY_BYTES, maxCharacters: MAX_JD_CHARS },
              traceId,
            },
            { status: read.status },
          );
        }

        // Character ceilings are checked separately from Zod so an oversized
        // paste reads as "too long" (413), not as a malformed request (400).
        const fields = (read.body ?? {}) as Record<string, unknown>;
        const tooLong =
          assertFieldLength("jobDescriptionText", fields["jobDescriptionText"], MAX_JD_CHARS) ??
          assertFieldLength("roleTitle", fields["roleTitle"], MAX_TITLE_CHARS);
        if (tooLong) {
          await auditPayloadTooLarge({
            scope: "jd_requirements",
            traceId,
            ip,
            path: "/api/public/jd-requirements",
            reason: tooLong.error,
            detail: tooLong.detail,
          });
          return Response.json(
            {
              ok: false,
              error: tooLong.error,
              message: `${String(tooLong.detail["field"])} exceeds the ${MAX_JD_CHARS} character limit. Trim it and try again.`,
              limits: { maxBodyBytes: MAX_BODY_BYTES, maxCharacters: MAX_JD_CHARS },
              traceId,
            },
            { status: 413 },
          );
        }

        const parsed = bodySchema.safeParse(read.body);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "invalid_request", traceId }, { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ ok: false, error: "suggestions_unavailable" });

        const jd = parsed.data.jobDescriptionText;
        const prompt = [
          `Job title: ${parsed.data.roleTitle || "not stated"}`,
          "",
          "Job description:",
          jd,
        ].join("\n");

        try {
          const res = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                {
                  role: "system",
                  content: [
                    "You read a job description and list the hiring requirements it actually states.",
                    "Tag each one: must_have (the role is not doable without it), nice_to_have (a real advantage, not a blocker), trainable (the employer could teach it).",
                    "Rules: at most 6 must_have items. Each requirement is one short specific phrase of 3 to 120 characters, written in plain English as an observable fact about a candidate.",
                    "Never invent requirements the description does not support. Prefer fewer, better items.",
                    'Reply with JSON only: {"requirements":[{"text":"...","tag":"must_have"}]}',
                  ].join(" "),
                },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.2,
            }),
          });

          if (!res.ok) {
            return Response.json({
              ok: false,
              error: res.status === 429 ? "rate_limited" : "suggestions_failed",
            });
          }

          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const content = json.choices?.[0]?.message?.content ?? "";
          let payload: unknown;
          try {
            payload = JSON.parse(content);
          } catch {
            return Response.json({ ok: false, error: "suggestions_unreadable" });
          }
          const suggestions = cleanSuggestions(
            (payload as Record<string, unknown> | null)?.["requirements"],
          );
          if (suggestions.length === 0) {
            return Response.json({ ok: false, error: "no_suggestions" });
          }
          return Response.json({ ok: true, suggestions });
        } catch {
          return Response.json({ ok: false, error: "suggestions_failed" });
        }
      
        })();

        return withRateLimitHeaders(response, decision, traceId);
      },
    },
  },
});
