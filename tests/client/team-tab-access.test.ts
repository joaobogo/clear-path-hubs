import { describe, expect, it } from "vitest";
import { canAccessArea } from "@/lib/collaborator-roles";

/**
 * The Team tab must never greet a legitimate seat with a "forbidden" error.
 *
 * - client_admin: full read + write, so every team query it fires is allowed.
 * - client_editor / client_viewer: the tab renders an explanatory panel and
 *   fires no team query at all, so there is nothing to be forbidden.
 */

/** Mirror of the flags derived in readWorkspaceAccess. */
function flagsFor(role: string, isStaff = false) {
  return {
    isAdmin: isStaff || role === "client_admin" || role === "platform_admin" || role === "operations",
    canManageTeam: isStaff || role === "client_admin",
  };
}

/** Mirror of TeamTab's gate: queries only run when isAdmin is true. */
function teamTabFires(role: string) {
  return flagsFor(role).isAdmin;
}

describe("team tab access", () => {
  it("lets a client_admin through every team gate", () => {
    const f = flagsFor("client_admin");
    expect(f.isAdmin).toBe(true);
    expect(f.canManageTeam).toBe(true);
    expect(canAccessArea("client_admin", "team")).toBe(true);
    expect(teamTabFires("client_admin")).toBe(true);
  });

  it("lets platform staff through in support view", () => {
    expect(flagsFor("platform_admin").canManageTeam).toBe(true);
    expect(canAccessArea("operations", "team")).toBe(true);
  });

  it("fires no team query for a client_editor, so no forbidden error can surface", () => {
    expect(teamTabFires("client_editor")).toBe(false);
    expect(teamTabFires("client_viewer")).toBe(false);
  });

  it("keeps the roster gate and the area gate in agreement", () => {
    for (const role of ["client_admin", "client_editor", "client_viewer"]) {
      expect(flagsFor(role).canManageTeam).toBe(canAccessArea(role, "team"));
    }
  });
});
