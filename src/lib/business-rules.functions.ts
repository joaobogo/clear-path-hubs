/**
 * Server functions for the canonical business rules.
 * ---------------------------------------------------
 * • getBusinessRules — merged defaults + platform overrides. Safe for any
 *   authenticated call site; the payload is not sensitive but changes require
 *   admin auth.
 * • listBusinessRuleOverrides — raw overrides + audit for the admin editor.
 * • setBusinessRuleOverride / clearBusinessRuleOverride — platform admin only.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BUSINESS_RULES_DEFAULTS,
  mergeBusinessRules,
  validateBusinessRules,
  type BusinessRules,
} from "@/config/business-rules";

type OverrideRow = {
  key: string;
  value: unknown;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
};

async function readOverrides(
  supabase: Awaited<ReturnType<typeof requireSupabaseAuth.server>>["context"]["supabase"],
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("business_rules_overrides")
    .select("key, value");
  if (error) {
    // A read failure must never take down the site — fall back to defaults.
    console.warn("[business-rules] override read failed:", error.message);
    return {};
  }
  const map: Record<string, unknown> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    map[row.key] = row.value;
  }
  return map;
}

export const getBusinessRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessRules> => {
    const overrides = await readOverrides(context.supabase);
    try {
      return mergeBusinessRules(overrides);
    } catch (err) {
      console.warn("[business-rules] overrides invalid, falling back:", err);
      return BUSINESS_RULES_DEFAULTS;
    }
  });

export const listBusinessRuleOverrides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", {
      _user: context.userId,
    });
    if (!isAdmin) throw new Error("Forbidden");

    const [{ data: overrides }, { data: audit }] = await Promise.all([
      context.supabase
        .from("business_rules_overrides")
        .select("*")
        .order("updated_at", { ascending: false }),
      context.supabase
        .from("business_rules_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      defaults: BUSINESS_RULES_DEFAULTS,
      overrides: (overrides ?? []) as OverrideRow[],
      audit: (audit ?? []) as Array<{
        id: string;
        key: string;
        previous_value: unknown;
        new_value: unknown;
        actor_user_id: string | null;
        action: string;
        note: string | null;
        created_at: string;
      }>,
    };
  });

export const setBusinessRuleOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1),
      value: z.unknown(),
      note: z.string().max(500).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", {
      _user: context.userId,
    });
    if (!isAdmin) throw new Error("Forbidden");

    // Validate the merged result before persisting.
    const current = await readOverrides(context.supabase);
    const next = { ...current, [data.key]: data.value };
    validateBusinessRules(mergeBusinessRules(next));

    const { data: previous } = await context.supabase
      .from("business_rules_overrides")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();

    const { error: upsertErr } = await context.supabase
      .from("business_rules_overrides")
      .upsert({
        key: data.key,
        value: data.value as never,
        notes: data.note ?? null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
    if (upsertErr) throw new Error(upsertErr.message);

    await context.supabase.from("business_rules_audit").insert({
      key: data.key,
      previous_value: (previous?.value ?? null) as never,
      new_value: data.value as never,
      actor_user_id: context.userId,
      action: previous ? "update" : "create",
      note: data.note ?? null,
    });

    return { ok: true };
  });

export const clearBusinessRuleOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ key: z.string().min(1) }).parse)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_platform_admin", {
      _user: context.userId,
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: previous } = await context.supabase
      .from("business_rules_overrides")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();

    const { error } = await context.supabase
      .from("business_rules_overrides")
      .delete()
      .eq("key", data.key);
    if (error) throw new Error(error.message);

    await context.supabase.from("business_rules_audit").insert({
      key: data.key,
      previous_value: (previous?.value ?? null) as never,
      new_value: null,
      actor_user_id: context.userId,
      action: "reset",
    });

    return { ok: true };
  });
