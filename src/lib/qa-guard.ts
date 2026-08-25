/**
 * QA / test-record contamination guard.
 *
 * Test fixtures have twice leaked into live client workspaces via roles,
 * conversations, candidates and invitations named after QA markers. This
 * helper rejects those creations at the server boundary unless the target
 * organization is explicitly marked as a demo or fixture workspace.
 */

const FORBIDDEN = ["qa", "test", "ignore", "browser-test", "disregard"];

function hasForbiddenMarker(value: string | null | undefined): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return FORBIDDEN.some((marker) => lower.includes(marker));
}

export function qaGuardValues(values: Array<string | null | undefined>): {
  ok: boolean;
  reason: string | null;
} {
  const dirty = values.filter((v): v is string => !!v && hasForbiddenMarker(v));
  if (dirty.length === 0) return { ok: true, reason: null };
  return {
    ok: false,
    reason: `This looks like a test record (${dirty.join(", ")}). It cannot be created in a live workspace.`,
  };
}

export type QaSafeOrg = {
  is_demo?: boolean | null;
  is_test_record?: boolean | null;
};

/**
 * Check whether an organization is allowed to receive QA-marked records.
 * Allowed when is_demo or is_test_record is true.
 */
export function isQaSafeOrg(org: QaSafeOrg): boolean {
  return Boolean(org.is_demo) || Boolean(org.is_test_record);
}

/**
 * Load the QA-relevant flags for an organization. The caller passes any
 * Supabase client that can read organizations (supabaseAdmin or context.supabase).
 */
type DbClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => Promise<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export async function loadOrgQaFlags(
  db: DbClient,
  orgId: string,
): Promise<{ ok: false; reason: string } | { ok: true; org: QaSafeOrg }> {
  const res = await db.from("organizations").select("id,is_demo,is_test_record").eq("id", orgId);
  if (res.error) return { ok: false, reason: res.error.message };
  const org = (res.data ?? [])[0] as QaSafeOrg | undefined;
  if (!org) return { ok: false, reason: "Organization not found" };
  return { ok: true, org };
}

/**
 * Convenience helper: load flags and run the guard in one call.
 */
export async function assertNoQaContamination(
  db: { from: (table: string) => unknown },
  orgId: string,
  fields: Array<string | null | undefined>,
): Promise<{ ok: boolean; reason: string | null }> {
  const flags = await loadOrgQaFlags(db, orgId);
  if (!flags.ok) return { ok: false, reason: flags.reason };
  if (isQaSafeOrg(flags.org)) return { ok: true, reason: null };
  return qaGuardValues(fields);
}
