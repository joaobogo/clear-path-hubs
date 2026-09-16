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
import { cleanBlueprint, cleanRequirements } from "@/lib/jd-blueprint";


/**
 * Reads a job description and returns the role blueprint it states: the tagged
 * requirements, and the rest of the fields the intake would otherwise ask the
 * client to type.
 *
 * Three ways in, one path out. The JD can arrive as pasted TEXT, as an
 * uploaded FILE (PDF/DOCX/TXT/RTF), or as a URL. All three resolve to text on
 * the server and go through the same reader, because the intake's promise is
 * "upload the job description and we build the blueprint" and only pasting
 * ever worked (audit 15 Sep: INT-010 upload never parsed, INT-014 no URL
 * import, INT-013 requirements only).
 *
 * Public by URL and unauthenticated because the intake itself is: it takes
 * only content the caller already has, writes nothing, and returns nothing but
 * suggestions. Every field is a suggestion — the client accepts, edits or
 * discards it before anything is saved.
 *
 * Failure is never fatal. Any problem returns ok:false with a reason, and the
 * wizard falls back to manual entry with a visible note — exactly as today.
 */

/**
 * Hard ceilings, enforced before any LLM call.
 *
 * MAX_BODY_BYTES bounds a text-only request. A request carrying a file needs
 * room for base64 (about 4/3 of the file), so it gets its own larger ceiling —
 * still bounded, and still behind the same 6-per-minute rate limit. The
 * character limit then bounds what we are willing to send to a paid gateway,
 * whichever route the text arrived by.
 */
const MAX_BODY_BYTES = 80_000;
const MAX_UPLOAD_BODY_BYTES = 14_500_000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_JD_CHARS = 30_000;
const MAX_TITLE_CHARS = 160;
/** A fetched page can be enormous; we only ever read the JD out of the start. */
const MAX_FETCH_BYTES = 2_000_000;
const URL_FETCH_TIMEOUT_MS = 8_000;

const fileSchema = z.object({
  filename: z.string().trim().min(1).max(260),
  mime: z.string().trim().max(160).optional().default(""),
  base64: z.string().min(1),
});

const bodySchema = z
  .object({
    roleTitle: z.string().trim().max(MAX_TITLE_CHARS).optional().default(""),
    jobDescriptionText: z.string().trim().max(MAX_JD_CHARS).optional().default(""),
    file: fileSchema.optional(),
    url: z.string().trim().url().max(2_000).optional(),
  })
  // One of the three has to carry the description; which one is the caller's
  // choice, not ours.
  .refine((v) => v.jobDescriptionText.length > 0 || v.file || v.url, {
    message: "a job description, file or url is required",
  });

const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Strips HTML down to readable text, so a fetched job page reads like a JD. */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

type TextSource = "text" | "file" | "url";
type ResolvedText =
  | { ok: true; text: string; source: TextSource }
  | { ok: false; error: string; message: string };

/**
 * Turns whichever input arrived into job-description text.
 *
 * File extraction reuses the same reader the CV pipeline uses — one extractor
 * for every document this product reads, so a PDF that works for a CV works
 * for a JD. A scanned file with no text layer comes back as `jd_unreadable`,
 * which the wizard shows as "we couldn't read that file — paste the text
 * instead" rather than silently doing nothing (which is what happened before).
 */
async function resolveText(input: {
  jobDescriptionText: string;
  file?: { filename: string; mime: string; base64: string };
  url?: string;
}): Promise<ResolvedText> {
  if (input.file) {
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(input.file.base64);
    } catch {
      return { ok: false, error: "file_unreadable", message: "That file could not be read." };
    }
    if (bytes.length > MAX_FILE_BYTES) {
      return { ok: false, error: "file_too_large", message: "That file is larger than 10 MB." };
    }
    const { extractCvText } = await import("@/lib/cv-extractor.server");
    const res = await extractCvText(bytes, input.file.mime, input.file.filename);
    const text = res.text.trim();
    if (!text || res.needs_ocr) {
      return {
        ok: false,
        error: "jd_unreadable",
        message: "We couldn't read that file — paste the text instead.",
      };
    }
    return { ok: true, text: text.slice(0, MAX_JD_CHARS), source: "file" };
  }

  if (input.url) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.url);
    } catch {
      return { ok: false, error: "invalid_url", message: "That link could not be read." };
    }
    // Public job boards only. Refusing anything but http(s) keeps this from
    // being turned into a fetcher for internal addresses.
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return { ok: false, error: "invalid_url", message: "That link could not be read." };
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
      const res = await fetch(parsedUrl.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "TaaSFlowBot/1.0 (+https://taasflow.com)" },
      }).finally(() => clearTimeout(timer));
      if (!res.ok) {
        return {
          ok: false,
          error: "url_blocked",
          message: "That site wouldn't let us read the page — paste the text instead.",
        };
      }
      const raw = (await res.text()).slice(0, MAX_FETCH_BYTES);
      const text = htmlToText(raw);
      if (text.length < 200) {
        return {
          ok: false,
          error: "url_empty",
          message: "We couldn't find a job description at that link — paste the text instead.",
        };
      }
      return { ok: true, text: text.slice(0, MAX_JD_CHARS), source: "url" };
    } catch {
      return {
        ok: false,
        error: "url_blocked",
        message: "That site wouldn't let us read the page — paste the text instead.",
      };
    }
  }

  return { ok: true, text: input.jobDescriptionText, source: "text" };
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

        // The wire ceiling has to admit a base64 file (about 4/3 of 10 MB).
        // What protects the paid gateway is not this number but MAX_JD_CHARS
        // on the RESOLVED text plus the 6-per-minute limit above, both of
        // which apply however the description arrived.
        const read = await readJsonWithLimit(request, MAX_UPLOAD_BODY_BYTES);
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

        // Upload and URL become text here, so everything below this line is
        // the same path pasted text has always taken.
        const resolved = await resolveText({
          jobDescriptionText: parsed.data.jobDescriptionText,
          file: parsed.data.file,
          url: parsed.data.url,
        });
        if (!resolved.ok) {
          return Response.json({ ok: false, error: resolved.error, message: resolved.message });
        }
        const jd = resolved.text;
        if (jd.trim().length === 0) {
          return Response.json({ ok: false, error: "no_suggestions" });
        }

        const prompt = [
          `Job title given by the client: ${parsed.data.roleTitle || "not stated"}`,
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
                    "You read a job description and report ONLY what it actually states.",
                    "",
                    "REQUIREMENTS — list the hiring requirements the description states.",
                    "Tag each one: must_have (the role is not doable without it), nice_to_have (a real advantage, not a blocker), trainable (the employer could teach it).",
                    "Rules: at most 6 must_have items. Each requirement is one short specific phrase of 3 to 120 characters, written in plain English as an observable fact about a candidate.",
                    "Never invent requirements the description does not support. Prefer fewer, better items.",
                    "",
                    "BLUEPRINT — read the rest of the role from the same text.",
                    "Include a field ONLY if the description states or plainly implies it. OMIT any field you cannot support; never guess, and never carry a value over from the client's given job title.",
                    "Give each field a confidence: high (stated outright), medium (clearly implied), low (inferred).",
                    "Vocabularies you must use exactly:",
                    "seniority: intern|junior|mid|senior|lead|principal|director|executive",
                    "workModel: remote|hybrid|onsite",
                    "employmentType: full_time|part_time|contract|temporary|internship",
                    "currency: USD|EUR|GBP|BRL|CAD|AUD   compensationPeriod: year|month|hour",
                    "salaryMin/salaryMax: plain numbers, no symbols or separators.",
                    "targetStartDate: YYYY-MM-DD only.",
                    "requiresExistingWorkAuth: true only if the text says the employer will not sponsor, or requires existing authorisation to work.",
                    "screeningQuestions: up to 8 short questions the description implies an employer would ask.",
                    "",
                    'Reply with JSON only, in exactly this shape: {"requirements":[{"text":"...","tag":"must_have"}],"blueprint":{"title":{"value":"...","confidence":"high"},"seniority":{"value":"senior","confidence":"medium"}}}',
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
          const body = (payload as Record<string, unknown> | null) ?? {};
          const suggestions = cleanRequirements(body["requirements"]);
          const blueprint = cleanBlueprint(body["blueprint"]);
          const readAnything = suggestions.length > 0 || Object.keys(blueprint).length > 0;
          if (!readAnything) {
            return Response.json({ ok: false, error: "no_suggestions" });
          }
          // `suggestions` keeps its original name and shape so the existing
          // caller is unaffected; `blueprint` and `source` are additive.
          return Response.json({
            ok: true,
            suggestions,
            blueprint,
            source: resolved.source,
            // Returned so the wizard can show the client what was read when the
            // text came from a file or a link, and save it with the draft.
            text: resolved.source === "text" ? undefined : jd,
          });
        } catch {
          return Response.json({ ok: false, error: "suggestions_failed" });
        }
      
        })();

        return withRateLimitHeaders(response, decision, traceId);
      },
    },
  },
});
