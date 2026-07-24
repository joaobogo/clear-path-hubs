/**
 * Server functions for the canonical business rules.
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

type Json = null | string | number | boolean | { [k: string]: Json } | Json[];

export type BusinessRuleOverride = {
  key: string;
  value: Json;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type BusinessRuleAudit = {
  id: string;
  key: string;
  previous_value: Json;
  new_value: Json;
  actor_user_id: string | null;
  action: string;
  note: string | null;
  created_at: string;
};

export const getBusinessRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessRules> => {
    const { data, error } = await context.supabase
      .from("business_rules_overrides")
      .select("key, value");
    if (error) {
      console.warn("[business-rules] override read failed:", error.message);
      return BUSINESS_RULES_DEFAULTS;
    }
    const map: Record<string, unknown> = {};
    for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
      map[row.key] = row.value;
    }
    try {
      return mergeBusinessRules(map);
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

    const [overridesResp, auditResp] = await Promise.all([
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

    const overrides = (overridesResp.data ?? []) as BusinessRuleOverride[];
    const audit = (auditResp.data ?? []) as BusinessRuleAudit[];

    return {
      defaults: BUSINESS_RULES_DEFAULTS as unknown as Json,
      overrides,
      audit,
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

    const { data: currentRows } = await context.supabase
      .from("business_rules_overrides")
      .select("key, value");
    const current: Record<string, unknown> = {};
    for (const row of (currentRows ?? []) as Array<{ key: string; value: unknown }>) {
      current[row.key] = row.value;
    }
    validateBusinessRules(mergeBusinessRules({ ...current, [data.key]: data.value }));

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
