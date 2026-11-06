import { describe, expect, it } from "vitest";
import { passwordChangeErrors } from "@/lib/account/password-change";

describe("in-place password change validation", () => {
  it("accepts a valid change", () => {
    expect(
      passwordChangeErrors({ current: "old-pass-1", next: "new-pass-22", confirm: "new-pass-22" }),
    ).toEqual({});
  });

  it("needs the current password", () => {
    expect(
      passwordChangeErrors({ current: "", next: "new-pass-22", confirm: "new-pass-22" }),
    ).toHaveProperty("current");
  });

  it("needs at least 8 characters", () => {
    expect(
      passwordChangeErrors({ current: "old-pass-1", next: "short", confirm: "short" }),
    ).toHaveProperty("next");
  });

  it("rejects reusing the current password", () => {
    expect(
      passwordChangeErrors({ current: "same-pass-1", next: "same-pass-1", confirm: "same-pass-1" }),
    ).toHaveProperty("next");
  });

  it("needs the two new passwords to match", () => {
    expect(
      passwordChangeErrors({ current: "old-pass-1", next: "new-pass-22", confirm: "new-pass-23" }),
    ).toHaveProperty("confirm");
  });
});
