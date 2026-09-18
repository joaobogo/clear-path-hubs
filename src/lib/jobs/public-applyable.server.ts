/**
 * May the public apply to this role?
 *
 * The job board and the role page ask the database function
 * `public_publishable_position_ids` before showing anything. The apply
 * endpoint asked nobody at all, so a demo tenant's listing kept accepting real
 * applications from real candidates who would never hear back
 * (audit 17 Sep, item 5).
 *
 * WHY THIS IS A SEPARATE, SERVER-ONLY MODULE, and not an export from
 * `jobs.functions.ts`: that file is imported by the `/jobs/$id` route, so it is
 * in the client graph. Its server-only pieces survive only because they sit
 * inside `createServerFn().handler()` bodies, which the build strips out of the
 * client bundle. Exporting a plain function that reached them pulled
 * `@tanstack/react-start/server` into the browser build and the import-
 * protection plugin rejected it — correctly. The `.server` suffix keeps this
 * one out of that graph entirely.
 *
 * The RULE itself is not duplicated. It lives in the SQL function, which both
 * callers ask, so the board and the apply endpoint cannot come to different
 * conclusions about the same role. Only the thin cookie bypass below is
 * restated, and it must stay in step with the one in `jobs.functions.ts`:
 * `public-applyable-matches-board.test.ts` fails if it drifts.
 */
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { QA_E2E_COOKIE, qaEndpointsEnabled } from "@/lib/public-api/qa-endpoint-gate";

/**
 * The end-to-end suites submit applications against an `is_test_record`
 * fixture, opting in with a `qa_e2e` cookie that only the local dev server ever
 * honours. Without this the apply specs would every one of them fail closed.
 */
function testRecordsVisible(): boolean {
  if (!qaEndpointsEnabled()) return false;
  let cookie = "";
  try {
    cookie = getRequestHeader("cookie") ?? "";
  } catch {
    return false;
  }
  const match = new RegExp(`(?:^|;\\s*)${QA_E2E_COOKIE}=([^;]+)`).exec(cookie);
  if (!match) return false;
  const value = decodeURIComponent(match[1]!);
  const expected = (process.env.QA_SEED_TOKEN ?? "").trim();
  return expected.length > 0 ? value === expected : value.length > 0;
}

/**
 * True only when the public board would list this role.
 *
 * Fails CLOSED. If the lookup errors we do not know the role is public, and a
 * refused application is recoverable where one filed into a demo workspace is
 * not — nobody is watching that inbox.
 */
export async function isPubliclyApplyable(positionId: string): Promise<boolean> {
  if (!positionId) return false;
  if (testRecordsVisible()) return true;
  try {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("public_publishable_position_ids", { _ids: [positionId] });
    if (error) return false;
    const rows = Array.isArray(data) ? data : [];
    return rows.some((r) =>
      typeof r === "string" ? r === positionId : (r as { id?: string })?.id === positionId,
    );
  } catch {
    return false;
  }
}
