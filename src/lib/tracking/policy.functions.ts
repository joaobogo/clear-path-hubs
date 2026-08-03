/**
 * Tracking policy — the admin-configured list of strictly necessary trackers
 * plus the region rule for prior opt-in.
 *
 * Read publicly (the consent banner and pixel loader need it before a visitor
 * signs in), written only by platform staff.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type TrackingPolicyRecord = {
  essentialTrackers: string[];
  requirePriorOptInEverywhere: boolean;
  updatedAt: string | null;
};

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const fetchTrackingPolicy = createServerFn({ method: "GET" }).handler(
  async (): Promise<TrackingPolicyRecord> => {
    const fallback: TrackingPolicyRecord = {
      essentialTrackers: [],
      requirePriorOptInEverywhere: true,
      updatedAt: null,
    };
    try {
      const { data } = await publicClient()
        .from("tracking_policy")
        .select("essential_trackers, require_prior_opt_in_everywhere, updated_at")
        .eq("id", true)
        .maybeSingle();
      if (!data) return fallback;
      return {
        essentialTrackers: (data.essential_trackers ?? []).filter(
          (v): v is string => typeof v === "string",
        ),
        requirePriorOptInEverywhere: data.require_prior_opt_in_everywhere !== false,
        updatedAt: data.updated_at ?? null,
      };
    } catch {
      // Fail closed: nothing non-essential runs when the policy can't be read.
      return fallback;
    }
  },
);

const policyInput = z.object({
  essentialTrackers: z.array(z.string().min(1).max(40)).max(20),
  requirePriorOptInEverywhere: z.boolean(),
});

export const saveTrackingPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => policyInput.parse(input))
  .handler(async ({ data, context }): Promise<TrackingPolicyRecord> => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
    if (!staff) throw new Error("Forbidden");

    const { data: row, error } = await supabase
      .from("tracking_policy")
      .update({
        essential_trackers: data.essentialTrackers,
        require_prior_opt_in_everywhere: data.requirePriorOptInEverywhere,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", true)
      .select("essential_trackers, require_prior_opt_in_everywhere, updated_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      essentialTrackers: (row.essential_trackers ?? []).filter(
        (v): v is string => typeof v === "string",
      ),
      requirePriorOptInEverywhere: row.require_prior_opt_in_everywhere !== false,
      updatedAt: row.updated_at ?? null,
    };
  });
