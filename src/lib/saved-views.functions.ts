import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SURFACES = [
  "client_positions",
  "client_candidates",
  "client_messages",
  "admin_candidates",
  "admin_positions",
  "admin_intakes",
  "admin_processing",
  "admin_matches",
  "admin_activity",
  "admin_privacy",
  "admin_clients",
] as const;
export type SavedViewSurface = (typeof SURFACES)[number];

export type SavedView = {
  id: string;
  surface: SavedViewSurface;
  name: string;
  filters: Record<string, string>;
  is_shared: boolean;
  is_default: boolean;
  organization_id: string | null;
  is_mine: boolean;
  owner_name: string;
  last_used_at: string | null;
};

export const listSavedViews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { surface: SavedViewSurface; organization_id?: string }) =>
    z
      .object({
        surface: z.enum(SURFACES),
        organization_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<SavedView[]> => {
    let q = context.supabase
      .from("saved_views")
      .select(
        "id, surface, name, filters, is_shared, is_default, organization_id, user_id, last_used_at",
      )
      .eq("surface", data.surface)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true });
    // Never surface another user's private view, even to staff.
    if (data.organization_id) {
      q = q.or(
        `user_id.eq.${context.userId},and(is_shared.eq.true,organization_id.eq.${data.organization_id})`,
      );
    } else {
      q = q.or(`user_id.eq.${context.userId},is_shared.eq.true`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const otherOwners = Array.from(
      new Set(
        (rows ?? [])
          .map((r) => r.user_id as string)
          .filter((id) => id !== context.userId),
      ),
    );
    const names = new Map<string, string>();
    if (otherOwners.length > 0) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("auth_user_id, full_name")
        .in("auth_user_id", otherOwners);
      for (const p of profiles ?? []) {
        if (p.auth_user_id) {
          names.set(p.auth_user_id as string, (p.full_name as string | null) ?? "Teammate");
        }
      }
    }

    return (rows ?? []).map((r) => {
      const mine = r.user_id === context.userId;
      return {
        id: r.id as string,
        surface: r.surface as SavedViewSurface,
        name: r.name as string,
        filters: ((r.filters as unknown) as Record<string, string>) ?? {},
        is_shared: !!r.is_shared,
        is_default: !!r.is_default,
        organization_id: (r.organization_id as string | null) ?? null,
        is_mine: mine,
        owner_name: mine ? "You" : names.get(r.user_id as string) ?? "Teammate",
        last_used_at: (r.last_used_at as string | null) ?? null,
      };
    });
  });

export const saveSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      surface: SavedViewSurface;
      name: string;
      filters: Record<string, unknown>;
      is_shared?: boolean;
      organization_id?: string | null;
    }) =>
      z
        .object({
          surface: z.enum(SURFACES),
          name: z.string().trim().min(1).max(80),
          filters: z.record(z.string(), z.unknown()),
          is_shared: z.boolean().optional(),
          organization_id: z.string().uuid().nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const payload = {
      user_id: context.userId,
      surface: data.surface,
      name: data.name,
      // Filter state only — never a snapshot of results.
      filters: data.filters as never,
      is_shared: data.is_shared ?? false,
      organization_id: data.is_shared ? data.organization_id ?? null : null,
      last_used_at: new Date().toISOString(),
    };
    const { data: row, error } = await context.supabase
      .from("saved_views")
      .upsert(payload, { onConflict: "user_id,surface,name" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const updateSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      is_shared?: boolean;
      organization_id?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(80).optional(),
          is_shared: z.boolean().optional(),
          organization_id: z.string().uuid().nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.is_shared !== undefined) {
      patch["is_shared"] = data.is_shared;
      patch["organization_id"] = data.is_shared ? data.organization_id ?? null : null;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("saved_views")
      .update(patch as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDefaultSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; surface: SavedViewSurface; is_default: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        surface: z.enum(SURFACES),
        is_default: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    // Only one default per user per surface.
    const { error: clearErr } = await context.supabase
      .from("saved_views")
      .update({ is_default: false } as never)
      .eq("user_id", context.userId)
      .eq("surface", data.surface);
    if (clearErr) throw new Error(clearErr.message);
    if (data.is_default) {
      const { error } = await context.supabase
        .from("saved_views")
        .update({ is_default: true } as never)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const touchSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // Best effort: only the owner can stamp usage on their own view.
    await context.supabase
      .from("saved_views")
      .update({ last_used_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const deleteSavedView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("saved_views")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
