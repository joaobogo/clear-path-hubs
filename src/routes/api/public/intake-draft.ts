import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  INTAKE_DRAFT_COOKIE,
  INTAKE_DRAFT_TTL_DAYS,
  MAX_INTAKE_DRAFT_BYTES,
  stripNeverPersisted,
} from "@/lib/intake-draft-shared";
import { readJsonWithLimit } from "@/lib/public-api/body-limit";
import {
  PUBLIC_BODY_LIMITS,
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";

/**
 * Anonymous intake drafts.
 *
 * Before the client has an account there is still typing worth protecting, so
 * we hand the browser a signed draft token in an httpOnly cookie and keep the
 * answers server-side. A closed laptop, a new tab, or a fresh device with a
 * resume link all reach the same draft.
 */

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("load") }),
  z.object({
    action: z.literal("save"),
    payload: z.record(z.string(), z.any()),
    lastStep: z.number().int().min(0).max(20).default(0),
  }),
  z.object({ action: z.literal("submitted") }),
  z.object({
    action: z.literal("email_resume"),
    email: z.string().trim().email().max(255),
    roleTitle: z.string().trim().max(200).optional(),
    stepLabel: z.string().trim().max(80).optional(),
  }),
]);

/**
 * Dedicated signing key for anonymous draft cookies. Purpose-scoped on
 * purpose: reusing LOVABLE_API_KEY or the service-role key as an HMAC key
 * mixes an unrelated credential into this surface, and a hardcoded fallback
 * would make the tokens forgeable by anyone reading the repo. Fail closed.
 */
function draftSecret(): string {
  const secret = process.env["INTAKE_DRAFT_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("INTAKE_DRAFT_SECRET is not configured");
  }
  return secret;
}

function sign(raw: string): string {
  return createHmac("sha256", draftSecret()).update(raw).digest("base64url").slice(0, 32);
}

function issueToken(): string {
  const raw = randomBytes(24).toString("base64url");
  return `${raw}.${sign(raw)}`;
}

/** A token is only worth a database round trip if its signature holds. */
export function isWellFormedToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const [raw, sig] = token.split(".");
  if (!raw || !sig) return false;
  const expected = Buffer.from(sign(raw));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readDraftCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === INTAKE_DRAFT_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function draftCookieHeader(token: string, secure: boolean): string {
  const maxAge = INTAKE_DRAFT_TTL_DAYS * 24 * 60 * 60;
  return [
    `${INTAKE_DRAFT_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });

export const Route = createFileRoute("/api/public/intake-draft")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = newTraceId("intake_draft");
        const decision = consumeRateLimit("intake_draft", clientIp(request), PUBLIC_RATE_LIMITS.intake_draft);
        if (decision.limited) return rateLimitResponse(traceId, decision);

        const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.intake_draft);
        if (!read.ok) {
          return Response.json(
            { ok: false, trace_id: traceId, error: read.error, ...read.detail },
            { status: read.status },
          );
        }
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(read.body);
        } catch {
          return json({ ok: false, error: "invalid_request" }, { status: 400 });
        }

        const secure = new URL(request.url).protocol === "https:";
        const cookieToken = readDraftCookie(request);
        const validToken = isWellFormedToken(cookieToken) ? cookieToken! : null;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (parsed.action === "load") {
          if (!validToken) return json({ ok: true, status: "empty" });
          const { data } = await supabaseAdmin
            .from("anonymous_intake_drafts")
            .select("payload, last_step, submitted_at, expires_at, updated_at")
            .eq("token_hash", hashToken(validToken))
            .maybeSingle();
          if (!data) return json({ ok: true, status: "empty" });
          if (data.submitted_at) return json({ ok: true, status: "submitted" });
          if (new Date(data.expires_at).getTime() < Date.now()) {
            await supabaseAdmin
              .from("anonymous_intake_drafts")
              .delete()
              .eq("token_hash", hashToken(validToken));
            return json({ ok: true, status: "expired" });
          }
          return json({
            ok: true,
            status: "restored",
            payload: data.payload ?? {},
            lastStep: data.last_step ?? 0,
            savedAt: data.updated_at,
            expiresAt: data.expires_at,
          });
        }

        if (parsed.action === "save") {
          const safe = stripNeverPersisted(parsed.payload);
          if (JSON.stringify(safe).length > MAX_INTAKE_DRAFT_BYTES) {
            return json({ ok: false, error: "draft_too_large" }, { status: 413 });
          }
          const token = validToken ?? issueToken();
          const tokenHash = hashToken(token);

          // A submitted brief is final: a late autosave must never revive it.
          const { data: existing } = await supabaseAdmin
            .from("anonymous_intake_drafts")
            .select("submitted_at")
            .eq("token_hash", tokenHash)
            .maybeSingle();
          if (existing?.submitted_at) {
            return json({ ok: true, status: "submitted" });
          }

          const savedAt = new Date().toISOString();
          const expiresAt = new Date(
            Date.now() + INTAKE_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString();
          const { error } = await supabaseAdmin.from("anonymous_intake_drafts").upsert(
            {
              token_hash: tokenHash,
              payload: safe as never,
              last_step: parsed.lastStep,
              expires_at: expiresAt,
              updated_at: savedAt,
            },
            { onConflict: "token_hash" },
          );
          if (error) return json({ ok: false, error: "save_failed" }, { status: 500 });

          // Staff hear about an incomplete intake as soon as it is actionable.
          const { alertPartialIntake } = await import("@/lib/leads/partial-intake-alert.server");
          await alertPartialIntake({
            draftKey: tokenHash,
            payload: safe as Record<string, unknown>,
            lastStep: parsed.lastStep,
            source: "intake_anonymous_draft",
            sourcePage: new URL(request.url).pathname,
          });

          return json(
            { ok: true, status: "saved", savedAt, expiresAt },
            validToken
              ? undefined
              : { headers: { "set-cookie": draftCookieHeader(token, secure) } },
          );
        }

        if (parsed.action === "submitted") {
          if (validToken) {
            await supabaseAdmin
              .from("anonymous_intake_drafts")
              .update({ submitted_at: new Date().toISOString() })
              .eq("token_hash", hashToken(validToken));
          }
          return json({ ok: true });
        }

        // email_resume — only ever on the client's explicit request.
        if (!validToken) return json({ ok: false, error: "no_draft" }, { status: 400 });
        const tokenHash = hashToken(validToken);
        const { data: draft } = await supabaseAdmin
          .from("anonymous_intake_drafts")
          .select("expires_at, submitted_at")
          .eq("token_hash", tokenHash)
          .maybeSingle();
        if (!draft || draft.submitted_at) {
          return json({ ok: false, error: "no_draft" }, { status: 400 });
        }

        const origin = new URL(request.url).origin;
        const resumeUrl = `${origin}/api/public/intake-resume?token=${encodeURIComponent(validToken)}`;
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const result = await sendTemplateEmail("intake-resume", parsed.email, {
            templateData: {
              resumeUrl,
              roleTitle: parsed.roleTitle || "",
              stepLabel: parsed.stepLabel || "",
              expiresOn: new Date(draft.expires_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            },
            idempotencyKey: `intake-resume:${tokenHash}:${Math.floor(Date.now() / 60000)}`,
          });
          await supabaseAdmin
            .from("anonymous_intake_drafts")
            .update({
              resume_email: parsed.email,
              resume_email_sent_at: new Date().toISOString(),
            })
            .eq("token_hash", tokenHash);
          return json({ ok: result.sent !== false, sent: result.sent !== false });
        } catch {
          return json({ ok: false, error: "email_failed" }, { status: 502 });
        }
      },
    },
  },
});
