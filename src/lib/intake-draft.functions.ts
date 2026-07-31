import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Server-side intake drafts. Once the client's account exists, their typing
 * belongs to them — not to one browser tab. Passwords are never persisted.
 */

const draftSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
});

export const saveIntakeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => draftSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("intake_drafts").upsert(
      {
        user_id: context.userId,
        payload: data.payload as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { savedAt: new Date().toISOString() };
  });

export const loadIntakeDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("intake_drafts")
      .select("payload, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      payload: (data?.payload ?? null) as Record<string, unknown> | null,
      updatedAt: data?.updated_at ?? null,
    };
  });

export const clearIntakeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("intake_drafts").delete().eq("user_id", context.userId);
    return { ok: true };
  });
