/**
 * The internal staff-action route runs a screen's own handler for a named
 * staff member: non-staff are refused, the handler sees the actor as its
 * caller, its own validation applies, and nothing can make a role public.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const seen: Array<{ data: unknown; context: { userId: string } }> = [];
vi.mock("@/lib/admin.functions", () => ({
  createPositionForClientValidate: (i: unknown) =>
    z.object({ organization_id: z.string().uuid(), title: z.string().min(2) }).parse(i),
  createPositionForClientHandler: async (a: { data: unknown; context: { userId: string } }) => {
    seen.push(a);
    return { ok: true, position: { id: "p1", status: "draft" } };
  },
}));
vi.mock("@/lib/position-edit.functions", () => ({
  publishPositionValidate: (i: unknown) => i,
  publishPositionHandler: async () => ({ ok: true }),
}));

const STAFF = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const admin = (staff: boolean) => ({ rpc: async () => ({ data: staff, error: null }) });

describe("runStaffAction", () => {
  it("refuses an actor who is not platform staff", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "create_position_for_client",
        input: { organization_id: ORG, title: "Role" },
      },
      { admin: admin(false) },
    );
    expect(out).toMatchObject({ ok: false, status: 403, error: "actor_not_staff" });
  });

  it("runs the screen's handler with the actor as the caller", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "create_position_for_client",
        input: { organization_id: ORG, title: "Enterprise Sales Director" },
      },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: true, result: { position: { status: "draft" } } });
    expect(seen.at(-1)!.context.userId).toBe(STAFF);
    expect(seen.at(-1)!.data).toEqual({ organization_id: ORG, title: "Enterprise Sales Director" });
  });

  it("applies the handler's own validation", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      {
        actor_user_id: STAFF,
        op: "create_position_for_client",
        input: { organization_id: "x", title: "R" },
      },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
  });

  it("never makes a role public from the posting save", async () => {
    const { runStaffAction } = await import("@/lib/admin/staff-action.server");
    const out = await runStaffAction(
      { actor_user_id: STAFF, op: "save_posting", input: { id: ORG, visibility: "public" } },
      { admin: admin(true) },
    );
    expect(out).toMatchObject({ ok: false, status: 400, error: "visibility_not_allowed" });
  });
});
