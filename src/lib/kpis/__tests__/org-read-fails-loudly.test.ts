/**
 * A failed read must not look like an empty account.
 *
 * readOrgRows is the shared reader behind every client KPI — open roles,
 * candidates in play, interviews, the portfolio rollup. It discarded the error
 * and returned [], so a transient database failure reported 0 with total
 * confidence. On the client overview a zero role count is one of the conditions
 * for rendering "Your workspace is ready · Add your first role", so the failure
 * could tell a paying client they had no roles at all.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readOrgRows } from "@/lib/kpis/org-read.server";

// readOrgRows escalates to the service-role client once it confirms the caller
// is a member, so the admin client has to answer with the same fixture or the
// success cases never reach the code under test.
const shared = vi.hoisted(() => ({ result: { data: [] as unknown, error: null as unknown } }));

vi.mock("@/integrations/supabase/client.server", () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "in", "not", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(shared.result).then(resolve);
  return { supabaseAdmin: builder };
});

beforeEach(() => {
  shared.result = { data: [], error: null };
});

/** Minimal PostgREST-shaped stub: a thenable query builder. */
function stubSupabase(result: { data: unknown; error: unknown }) {
  shared.result = result;
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "in", "not", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  // isOrgMember / isPlatformStaffCaller both read through this same stub; they
  // resolve falsy, so readOrgRows stays on the caller's client and never
  // touches supabaseAdmin.
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  builder.single = () => Promise.resolve({ data: null, error: null });
  builder.rpc = () => Promise.resolve({ data: null, error: null });
  builder.auth = { getUser: () => Promise.resolve({ data: { user: null }, error: null }) };
  return builder;
}

const ORG = "3f1c3d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

describe("readOrgRows", () => {
  it("throws when the read fails, rather than reporting an empty account", async () => {
    const supabase = stubSupabase({
      data: null,
      error: { message: "connection terminated unexpectedly" },
    });

    await expect(readOrgRows(supabase, ORG, "positions", "id")).rejects.toThrow(
      /org_read_failed/,
    );
  });

  it("names the table and organization so the failure is actionable", async () => {
    const supabase = stubSupabase({ data: null, error: { message: "timeout" } });

    await expect(readOrgRows(supabase, ORG, "positions", "id")).rejects.toThrow(
      new RegExp(`positions.*${ORG}`),
    );
  });

  it("still returns an empty array for a genuinely empty account", async () => {
    const supabase = stubSupabase({ data: [], error: null });

    await expect(readOrgRows(supabase, ORG, "positions", "id")).resolves.toEqual([]);
  });

  it("returns the rows when the read succeeds", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    const supabase = stubSupabase({ data: rows, error: null });

    await expect(readOrgRows(supabase, ORG, "positions", "id")).resolves.toEqual(rows);
  });
});
