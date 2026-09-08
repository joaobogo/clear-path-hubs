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

/**
 * How many records the hidden scope actually covers.
 *
 * This counted `is_test_record` alone, while the filter that does the hiding
 * (`loadTestScope`) excludes `is_test_record OR is_demo OR is_qa`. The demo
 * workspace is flagged `is_demo` and deliberately NOT `is_test_record`, so the
 * banner reported "0 organisations excluded" while an organisation was in fact
 * being excluded — and a reader checking whether the demo was still inflating
 * staff metrics was told, wrongly, that nothing was hidden (audit #9, item 24).
 *
 * Delegating means the number and the filter can never disagree again.
 * `"never"` forces the hidden-scope computation regardless of the caller's own
 * toggle: the banner must always report the size of the excluded set, and
 * passing `false` would fall through to the cookie and return zeros whenever
 * the toggle is on.
 */
async function countExcluded(admin: unknown): Promise<{ orgs: number; positions: number }> {
  const { loadTestScope } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(admin as never, "never");
  return { orgs: scope.excludedOrgs, positions: scope.excludedPositions };
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
