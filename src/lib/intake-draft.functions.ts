import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  INTAKE_DRAFT_TTL_DAYS,
  MAX_INTAKE_DRAFT_BYTES,
  stripNeverPersisted,
} from "@/lib/intake-draft-shared";

/**
 * Server-side intake drafts. Once the client's account exists, their typing
 * belongs to them — not to one browser tab. Passwords are never persisted, a
 * submitted brief is never overwritten by a late autosave, and a draft older
 * than the TTL expires with a message rather than vanishing.
 */

const draftSchema = z.object({
  payload: z.record(z.string(), z.any()),
  lastStep: z.number().int().min(0).max(20).default(0),
});

export type IntakeDraftStatus = "empty" | "restored" | "expired" | "submitted";

export const saveIntakeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => draftSchema.parse(input))
  .handler(async ({ data, context }) => {
    const safe = stripNeverPersisted(data.payload);
    if (JSON.stringify(safe).length > MAX_INTAKE_DRAFT_BYTES) {
      throw new Error("draft_too_large");
    }

    const { data: existing } = await context.supabase
      .from("intake_drafts")
      .select("submitted_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.submitted_at) {
      return { savedAt: null, status: "submitted" as IntakeDraftStatus };
    }

    const savedAt = new Date().toISOString();
    const { error } = await context.supabase.from("intake_drafts").upsert(
      {
        user_id: context.userId,
        payload: safe as never,
        last_step: data.lastStep,
        expires_at: new Date(
          Date.now() + INTAKE_DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: savedAt,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    // Staff hear about an incomplete intake as soon as it is actionable.
    const { alertPartialIntake } = await import("@/lib/leads/partial-intake-alert.server");
    await alertPartialIntake({
      draftKey: context.userId,
      payload: safe as Record<string, unknown>,
      lastStep: data.lastStep,
      source: "intake_account_draft",
      sourcePage: "/intake",
    });

    return { savedAt, status: "restored" as IntakeDraftStatus };
  });

export const loadIntakeDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("intake_drafts")
      .select("payload, last_step, submitted_at, expires_at, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const empty = {
      status: "empty" as IntakeDraftStatus,
      payload: null as Record<string, any> | null,
      lastStep: 0,
      updatedAt: null as string | null,
      expiresAt: null as string | null,
    };
    if (!data) return empty;
    if (data.submitted_at) return { ...empty, status: "submitted" as IntakeDraftStatus };
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      await context.supabase.from("intake_drafts").delete().eq("user_id", context.userId);
      return { ...empty, status: "expired" as IntakeDraftStatus };
    }

    return {
      status: "restored" as IntakeDraftStatus,
      payload: (data.payload ?? null) as Record<string, any> | null,
      lastStep: data.last_step ?? 0,
      updatedAt: data.updated_at ?? null,
      expiresAt: data.expires_at ?? null,
    };
  });

/** Marks the draft submitted so nothing can overwrite the confirmed brief. */
export const markIntakeDraftSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("intake_drafts")
      .update({ submitted_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const clearIntakeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("intake_drafts").delete().eq("user_id", context.userId);
    return { ok: true };
  });
