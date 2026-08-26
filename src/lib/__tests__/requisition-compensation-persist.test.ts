import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A client editing the salary range must see it again on the next load, and
 * admin must see the same figure. The save path used to write the budget only
 * for platform staff, so a client's range was accepted by the form and then
 * silently dropped.
 */
describe("requisition compensation persists for client editors", () => {
  const src = readFileSync("src/lib/requisition.functions.ts", "utf8");

  it("writes the budget outside the staff-only branch", () => {
    const staffBranch = src.slice(
      src.indexOf("if (isStaff) {"),
      src.indexOf("const { error: upErr }"),
    );
    const staffOnly = staffBranch.slice(0, staffBranch.indexOf("}"));
    expect(staffOnly).not.toContain("budget_min");
    expect(src).toContain("patch.compensation = collected");
  });

  it("keeps the collection and visibility decision staff-only", () => {
    expect(src).toMatch(/if \(isStaff\) \{[\s\S]*compensation_collected/);
    expect(src).toMatch(/if \(isStaff\) \{[\s\S]*compensation_visibility/);
  });
});
