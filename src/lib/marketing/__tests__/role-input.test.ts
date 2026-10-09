import { describe, expect, it } from "vitest";
import { cleanRole, roleFromSearch, ROLE_INPUT_MAX } from "@/lib/marketing/role-input";

describe("role input", () => {
  it("keeps a plain role and drops a leading article", () => {
    expect(cleanRole("  a Registered nurse ")).toBe("Registered nurse");
    expect(cleanRole("an Account executive")).toBe("Account executive");
    expect(cleanRole("Front desk agent")).toBe("Front desk agent");
  });
  it("strips markup, control characters and long pastes", () => {
    expect(cleanRole("<b>Line</b>\ncook")).toBe("Line cook");
    expect(cleanRole("x".repeat(200)).length).toBe(ROLE_INPUT_MAX);
  });
  it("reads ?role= only when it is a non-empty string", () => {
    expect(roleFromSearch("Line cook")).toBe("Line cook");
    expect(roleFromSearch("   ")).toBeUndefined();
    expect(roleFromSearch(["Line cook"])).toBeUndefined();
    expect(roleFromSearch(undefined)).toBeUndefined();
  });
});
