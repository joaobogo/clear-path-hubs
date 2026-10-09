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

/**
 * The model. Flash is the fastest model this project already runs through the
 * gateway for structured reads (every other reader here uses it); JSON mode,
 * a low temperature and a capped reply keep it quick and parseable.
 */
const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
/** Under the client's 25 s budget, so a slow gateway fails here, cleanly, first. */
const MODEL_TIMEOUT_MS = 20_000;
const MODEL_MAX_TOKENS = 1_600;
const MAX_REDIRECTS = 3;

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binary = atob(clean.replace(/\s+/g, ""));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

type TextSource = "text" | "file" | "url";
type ResolvedText =
  | { ok: true; text: string; source: TextSource }
  | { ok: false; error: string; message: string };

const URL_FAILED = "That site wouldn't let us read the page — paste the text instead.";

/**
 * Turns whichever input arrived into job-description text.
 *
 * File extraction reuses the same reader the CV pipeline uses — one extractor
 * for every document this product reads, so a PDF that works for a CV works
 * for a JD (jd-extract.server adds type sniffing, list-preserving DOCX, real
 * RTF decoding and a specific message per failure on top of it). A scanned file
 * with no text layer comes back as `jd_unreadable`, which the wizard shows as
 * "we couldn't read that file — paste the text instead" rather than silently
 * doing nothing (which is what happened before).
 */
async function resolveText(
  input: {
    jobDescriptionText: string;
    file?: { filename: string; mime: string; base64: string };
    url?: string;
  },
  cvModule: Promise<typeof import("@/lib/cv-extractor.server")> | null,
): Promise<ResolvedText> {
  if (input.file) {
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(input.file.base64);
    } catch {
      return { ok: false, error: "file_unreadable", message: "That file could not be read — paste the text instead." };
    }
    if (bytes.length > MAX_FILE_BYTES) {
      return { ok: false, error: "file_too_large", message: "That file is larger than 10 MB — paste the text instead." };
    }
    if (bytes.length === 0) {
      return { ok: false, error: "jd_unreadable", message: "That file is empty — paste the text instead." };
    }
    const { extractJdFile } = await import("@/lib/jd-extract.server");
    const res = await extractJdFile(
      bytes,
      input.file.mime,
      input.file.filename,
      () => cvModule ?? import("@/lib/cv-extractor.server"),
    );
    if (!res.ok) return res;
    return { ok: true, text: res.text.slice(0, MAX_JD_CHARS), source: "file" };
  }

  if (input.url) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.url);
    } catch {
      return { ok: false, error: "invalid_url", message: "That link could not be read." };
    }
    // Public job boards only. Refusing anything but http(s) keeps this from
    // being turned into a fetcher for internal addresses; checkPublicUrl then
    // refuses private, loopback, link-local and metadata hosts, and every
    // redirect hop is checked again.
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return { ok: false, error: "invalid_url", message: "That link could not be read." };
    }
    const { checkPublicUrl, fetchPublicPage } = await import("@/lib/jd-url-guard");
    if (!checkPublicUrl(parsedUrl).ok) {
      return { ok: false, error: "url_blocked", message: "That link isn't a public web page — paste the text instead." };
    }
    const page = await fetchPublicPage(parsedUrl.toString(), {
      maxBytes: MAX_FETCH_BYTES,
      timeoutMs: URL_FETCH_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
    });
    if (!page.ok) {
      return {
        ok: false,
        error: page.reason === "blocked" ? "url_blocked" : "url_failed",
        message: page.reason === "timeout" ? "That page took too long to load — paste the text instead." : URL_FAILED,
      };
    }
    const { jobPageToText } = await import("@/lib/jd-html");
    const text = jobPageToText(page.html);
    if (text.length < 200) {
      return {
        ok: false,
        error: "url_empty",
        message: "We couldn't find a job description at that link — paste the text instead.",
      };
    }
    return { ok: true, text: text.slice(0, MAX_JD_CHARS), source: "url" };
  }

  return { ok: true, text: input.jobDescriptionText, source: "text" };
}

const SYSTEM_PROMPT = [
  "You read a job description and report ONLY what it actually states.",
  "",
  "REQUIREMENTS — list the hiring requirements the description states.",
  "Tag each one: must_have (the role is not doable without it), nice_to_have (a real advantage, not a blocker), trainable (the employer could teach it).",
  "Rules: at most 6 must_have items, at most 12 items in all. Each requirement is one short specific phrase of 3 to 120 characters, written in plain English as an observable fact about a candidate, keeping the description's own terms.",
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
  "salaryMin/salaryMax: plain numbers, no symbols or separators. Base pay only — never a bonus, stipend, equity or OTE figure. If several ranges are given (by location or level), omit pay.",
  "location: the place only (city, region, country); put remote/hybrid/on-site in workModel, not here.",
  "targetStartDate: YYYY-MM-DD only, and only when a full date is written.",
  "requiresExistingWorkAuth: true only if the text says the employer will not sponsor, or requires existing authorisation to work.",
  "screeningQuestions: up to 8 short questions the description implies an employer would ask.",
  "",
  'Reply with JSON only, in exactly this shape: {"requirements":[{"text":"...","tag":"must_have"}],"blueprint":{"title":{"value":"...","confidence":"high"},"seniority":{"value":"senior","confidence":"medium"}}}',
].join(" ");

function timing(ms: { extract: number; model: number; total: number }): string {
  return `extract;dur=${ms.extract}, model;dur=${ms.model}, total;dur=${ms.total}`;
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

        const t0 = Date.now();
        // A body bigger than a text paste carries a file: start loading the
        // PDF/DOCX extractor now, in parallel with reading the upload, instead
        // of after it.
        const declaredBytes = Number(request.headers.get("content-length") ?? "0");
        const cvModule =
          declaredBytes > MAX_BODY_BYTES ? import("@/lib/cv-extractor.server") : null;
        cvModule?.catch(() => {});

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

        // Upload and URL become text here, so everything below this line is
        // the same path pasted text has always taken.
        const tExtract = Date.now();
        const resolved = await resolveText(
          {
            jobDescriptionText: parsed.data.jobDescriptionText,
            file: parsed.data.file,
            url: parsed.data.url,
          },
          cvModule,
        );
        const ms = { extract: Date.now() - tExtract, model: 0, total: 0 };
        // Timings only — never any of the content — so a slow stage is visible.
        const done = (body: Record<string, unknown>, status = 200) => {
          ms.total = Date.now() - t0;
          return Response.json(
            { ...body, ms },
            { status, headers: { "Server-Timing": timing(ms) } },
          );
        };
        if (!resolved.ok) {
          return done({ ok: false, error: resolved.error, message: resolved.message });
        }
        const jd = resolved.text;
        if (jd.trim().length === 0) {
          return done({ ok: false, error: "no_suggestions" });
        }
        // Text read out of a file or a link goes back even when the model read
        // fails, so the wizard can show it, save it and read it instantly.
        const readText = resolved.source === "text" ? undefined : jd;
        if (!key) return done({ ok: false, error: "suggestions_unavailable", source: resolved.source, text: readText });

        const prompt = [
          `Job title given by the client: ${parsed.data.roleTitle || "not stated"}`,
          "",
          "Job description:",
          jd,
        ].join("\n");

        const tModel = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
        // The caller hanging up (a newer description replaced this one) stops
        // the gateway call too, instead of paying for a reply nobody reads.
        const onClientAbort = () => controller.abort();
        request.signal?.addEventListener?.("abort", onClientAbort);
        try {
          const res = await fetch(GATEWAY_URL, {
            method: "POST",
            signal: controller.signal,
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: MODEL,
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.1,
              max_tokens: MODEL_MAX_TOKENS,
            }),
          });

          if (!res.ok) {
            ms.model = Date.now() - tModel;
            // A gateway 5xx is worth one retry from the wizard; a 4xx is not.
            return done(
              {
                ok: false,
                error: res.status === 429 ? "rate_limited" : "suggestions_failed",
                source: resolved.source,
                text: readText,
              },
              res.status >= 500 ? 502 : 200,
            );
          }

          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          ms.model = Date.now() - tModel;
          const content = json.choices?.[0]?.message?.content ?? "";
          let payload: unknown;
          try {
            // Some gateways wrap JSON mode output in a ```json fence anyway.
            payload = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
          } catch {
            return done({ ok: false, error: "suggestions_unreadable", source: resolved.source, text: readText });
          }
          const body = (payload as Record<string, unknown> | null) ?? {};
          const suggestions = cleanRequirements(body["requirements"]);
          const blueprint = cleanBlueprint(body["blueprint"]);
          const readAnything = suggestions.length > 0 || Object.keys(blueprint).length > 0;
          if (!readAnything) {
            return done({ ok: false, error: "no_suggestions", source: resolved.source, text: readText });
          }
          // `suggestions` keeps its original name and shape so the existing
          // caller is unaffected; `blueprint` and `source` are additive.
          return done({
            ok: true,
            suggestions,
            blueprint,
            source: resolved.source,
            // Returned so the wizard can show the client what was read when the
            // text came from a file or a link, and save it with the draft.
            text: readText,
          });
        } catch (e) {
          ms.model = Date.now() - tModel;
          const timedOut = (e as Error)?.name === "AbortError";
          return done(
            { ok: false, error: timedOut ? "suggestions_timeout" : "suggestions_failed", source: resolved.source, text: readText },
            timedOut ? 200 : 502,
          );
        } finally {
          clearTimeout(timer);
          request.signal?.removeEventListener?.("abort", onClientAbort);
        }
      
        })();

        return withRateLimitHeaders(response, decision, traceId);
      },
    },
  },
});
