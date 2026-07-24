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
      .select("id, surface, name, filters, is_shared, is_default, organization_id, user_id")
      .eq("surface", data.surface)
      .order("name", { ascending: true });
    if (data.organization_id) {
      q = q.or(`user_id.eq.${context.userId},organization_id.eq.${data.organization_id}`);
    } else {
      q = q.eq("user_id", context.userId);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      surface: r.surface as SavedViewSurface,
      name: r.name as string,
      filters: (r.filters as Record<string, unknown>) ?? {},
      is_shared: !!r.is_shared,
      is_default: !!r.is_default,
      organization_id: (r.organization_id as string | null) ?? null,
      is_mine: r.user_id === context.userId,
    }));
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
      filters: data.filters,
      is_shared: data.is_shared ?? false,
      organization_id: data.is_shared ? data.organization_id ?? null : null,
    };
    const { data: row, error } = await context.supabase
      .from("saved_views")
      .upsert(payload, { onConflict: "user_id,surface,name" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
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
