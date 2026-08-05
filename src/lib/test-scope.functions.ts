/**
 * The single global "Show test records" preference.
 *
 * Persisted per user on `profiles.show_test_records` and mirrored into a
 * cookie so the shared `loadTestScope` helper — used by every admin list and
 * rollup — resolves the same answer server-side without per-screen toggles.
 * Any read failure resolves to "hidden": fail closed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEST_SCOPE_COOKIE } from "./admin-test-scope.server";

export type TestScopeState = {
  show_test_records: boolean;
  excluded_orgs: number;
  excluded_positions: number;
};

const YEAR = 60 * 60 * 24 * 365;

async function writeCookie(value: boolean) {
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(TEST_SCOPE_COOKIE, value ? "1" : "0", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: YEAR,
  });
}

async function countExcluded(admin: unknown): Promise<{ orgs: number; positions: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = admin as any;
  const [orgs, positions] = await Promise.all([
    s.from("organizations").select("id", { count: "exact", head: true }).eq("is_test_record", true),
    s.from("positions").select("id", { count: "exact", head: true }).eq("is_test_record", true),
  ]);
  return { orgs: orgs.count ?? 0, positions: positions.count ?? 0 };
}

export const getTestScopeState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TestScopeState> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    let show = false;
    try {
      const { data } = await admin
        .from("profiles")
        .select("show_test_records")
        .eq("auth_user_id", context.userId)
        .maybeSingle();
      show = data?.show_test_records === true;
    } catch (e) {
      console.error("[test-scope] preference read failed; excluding test records", e);
      show = false;
    }
    await writeCookie(show);

    const counts = await countExcluded(admin);
    return { show_test_records: show, excluded_orgs: counts.orgs, excluded_positions: counts.positions };
  });

export const setTestScopeState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { show: boolean }) => z.object({ show: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<TestScopeState> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin as any;

    const { error } = await admin
      .from("profiles")
      .update({ show_test_records: data.show })
      .eq("auth_user_id", context.userId);
    if (error) throw new Error("Could not save the test-record preference.");

    await writeCookie(data.show);
    const counts = await countExcluded(admin);
    return {
      show_test_records: data.show,
      excluded_orgs: counts.orgs,
      excluded_positions: counts.positions,
    };
  });
