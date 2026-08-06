import { describe, expect, it, vi } from "vitest";

/**
 * Cross-workspace denial: a member of org A must never resolve access to an
 * org B record, and the read-only viewer rule must live in the helper rather
 * than in ad-hoc role-string checks at each call site.
 */

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VIEWER_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Seat = { organization_id: string; user_id: string; role: string };

const SEATS: Seat[] = [
  { organization_id: ORG_A, user_id: USER_A, role: "client_admin" },
  { organization_id: ORG_A, user_id: VIEWER_A, role: "client_viewer" },
  // Org B has its own owner; neither org A user has a seat there.
  { organization_id: ORG_B, user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", role: "client_admin" },
];

const POSITIONS = [
  { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", organization_id: ORG_B, title: "Org B role" },
];

/** Minimal Supabase-shaped stub: only what the helper actually calls. */
function makeDb() {
  return {
    rpc: async (_fn: string) => ({ data: false, error: null }),
    from(table: string) {
      const filters: Record<string, string> = {};
      const builder = {
        select: () => builder,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return builder;
        },
        maybeSingle: async () => {
          if (table === "memberships") {
            const row = SEATS.find(
              (s) =>
                s.organization_id === filters["organization_id"] &&
                s.user_id === filters["user_id"],
            );
            return { data: row ? { role: row.role, status: "active" } : null, error: null };
          }
          if (table === "positions") {
            const row = POSITIONS.find(
              (p) =>
                p.id === filters["id"] &&
                (!filters["organization_id"] || p.organization_id === filters["organization_id"]),
            );
            return { data: row ?? null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}

// The helper re-confirms a missing seat with the service client before denying.
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Record<string, string> = {};
      const builder = {
        select: () => builder,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return builder;
        },
        in: async () => ({ data: [], error: null }),
        maybeSingle: async () => {
          if (table === "memberships") {
            const row = SEATS.find(
              (s) =>
                s.organization_id === filters["organization_id"] &&
                s.user_id === filters["user_id"],
            );
            return { data: row ? { role: row.role } : null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  },
}));

const {
  WorkspaceAccessError,
  assertWorkspaceAccess,
  assertWorkspaceWrite,
  readWorkspaceAccess,
} = await import("@/lib/authz/workspace-access");

describe("assertWorkspaceAccess — tenant isolation", () => {
  it("allows an org A member into org A", async () => {
    const access = await assertWorkspaceAccess(makeDb(), USER_A, ORG_A);
    expect(access.allowed).toBe(true);
    expect(access.role).toBe("client_admin");
    expect(access.canWrite).toBe(true);
  });

  it("denies an org A member on an org B workspace", async () => {
    await expect(assertWorkspaceAccess(makeDb(), USER_A, ORG_B)).rejects.toBeInstanceOf(
      WorkspaceAccessError,
    );
  });

  it("denies an org A member asking for an org B position id", async () => {
    const db = makeDb();
    const position = POSITIONS[0]!; // belongs to org B
    // The workspace gate runs first and must refuse before any record read.
    await expect(assertWorkspaceAccess(db, USER_A, position.organization_id)).rejects.toThrow(
      /do not have access/i,
    );

    // Even if a caller passes their own org id, the record stays out of reach
    // because every read is scoped by the resolved organisation.
    const access = await assertWorkspaceAccess(db, USER_A, ORG_A);
    const { data } = await db
      .from("positions")
      .select("id")
      .eq("id", position.id)
      .eq("organization_id", ORG_A)
      .maybeSingle();
    expect(access.allowed).toBe(true);
    expect(data).toBeNull();
  });
});

describe("read-only rule lives in the helper", () => {
  it("marks client_viewer as readable but not writable", async () => {
    const access = await readWorkspaceAccess(makeDb(), VIEWER_A, ORG_A);
    expect(access.allowed).toBe(true);
    expect(access.canWrite).toBe(false);
    expect(access.canManageTeam).toBe(false);
  });

  it("refuses a client_viewer write through assertWorkspaceWrite", async () => {
    await expect(assertWorkspaceWrite(makeDb(), VIEWER_A, ORG_A)).rejects.toThrow(/read-only/i);
  });
});

/**
 * Converted client-workspace server functions must deny a cross-org id the
 * same way: through the canonical helper, not a bespoke membership query.
 */
describe("converted server functions deny cross-org access", () => {
  it("tasks.functions listTasks rejects an org the caller does not belong to", async () => {
    const { listTasks } = await import("@/lib/tasks.functions");
    const fakeContext = { supabase: makeDb(), userId: USER_A };
    // @ts-expect-error — calling the handler function directly in a unit test
    await expect(
      listTasks.options.handler({
        data: { organization_id: ORG_B, view: "my" },
        context: fakeContext,
      }),
    ).rejects.toBeInstanceOf(WorkspaceAccessError);
  });
});
