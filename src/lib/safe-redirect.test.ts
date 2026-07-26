import { describe, it, expect } from "vitest";
import { sanitizeRedirect } from "@/lib/safe-redirect";

describe("sanitizeRedirect", () => {
  it("keeps ordinary same-origin destinations", () => {
    expect(sanitizeRedirect("/client")).toBe("/client");
    expect(sanitizeRedirect("/admin/candidates/123")).toBe("/admin/candidates/123");
    expect(sanitizeRedirect("/client?org=abc#pipeline")).toBe("/client?org=abc#pipeline");
  });

  it("blocks off-origin redirects", () => {
    expect(sanitizeRedirect("//evil.com")).toBeNull();
    expect(sanitizeRedirect("/\\evil.com")).toBeNull();
    expect(sanitizeRedirect("https://evil.com")).toBeNull();
    expect(sanitizeRedirect("http://evil.com/client")).toBeNull();
  });

  it("blocks scheme injection and control characters", () => {
    expect(sanitizeRedirect("javascript:alert(1)")).toBeNull();
    expect(sanitizeRedirect("/javascript:alert(1)")).toBeNull();
    expect(sanitizeRedirect("/client\nSet-Cookie: x=1")).toBeNull();
  });

  it("refuses destinations that would loop back into auth", () => {
    expect(sanitizeRedirect("/login")).toBeNull();
    expect(sanitizeRedirect("/login?redirect=/client")).toBeNull();
    expect(sanitizeRedirect("/auth")).toBeNull();
    expect(sanitizeRedirect("/access-denied")).toBeNull();
    expect(sanitizeRedirect("/reset-password")).toBeNull();
  });

  it("rejects non-strings and empty input", () => {
    expect(sanitizeRedirect(undefined)).toBeNull();
    expect(sanitizeRedirect(null)).toBeNull();
    expect(sanitizeRedirect("")).toBeNull();
    expect(sanitizeRedirect(42)).toBeNull();
  });
});
