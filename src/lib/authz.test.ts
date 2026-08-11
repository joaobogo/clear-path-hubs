import { describe, it, expect } from "vitest";
import {
  CLIENT_PERMISSIONS,
  DEFAULT_PERMISSIONS_FOR_ROLE,
  MAX_CLIENT_SEAT_LIMIT,
  candidateVisibilityLevel,
  hasClientPermission,
  isClientRole,
  isPlatformStaffRole,
  maskEmail,
  maskPhone,
  MASKED_CONTACT,
} from "@/lib/authz";

// These cover the shared (client-safe) half of the authorization model.
// The enforcing half — RLS policies, the membership guard trigger and the
// publish gate — is covered by tests/authz/authorization.test.sql.

describe("role classification", () => {
  it("separates platform staff from client roles", () => {
    expect(isPlatformStaffRole("platform_admin")).toBe(true);
    expect(isPlatformStaffRole("operations")).toBe(true);
    expect(isPlatformStaffRole("client_admin")).toBe(false);
    expect(isPlatformStaffRole("candidate")).toBe(false);
    expect(isPlatformStaffRole(null)).toBe(false);
  });

  it("recognises only client workspace roles", () => {
    expect(isClientRole("client_admin")).toBe(true);
    expect(isClientRole("client_viewer")).toBe(true);
    expect(isClientRole("platform_admin")).toBe(false);
    expect(isClientRole("candidate")).toBe(false);
  });
});

describe("default seat permissions", () => {
  it("gives the client owner every permission", () => {
    expect(DEFAULT_PERMISSIONS_FOR_ROLE.client_admin).toEqual([...CLIENT_PERMISSIONS]);
  });

  it("never grants member invitation to a non-owner seat", () => {
    expect(DEFAULT_PERMISSIONS_FOR_ROLE.client_editor).not.toContain("invite_members");
    expect(DEFAULT_PERMISSIONS_FOR_ROLE.client_viewer).not.toContain("invite_members");
  });

  it("keeps the viewer seat read-only", () => {
    expect(DEFAULT_PERMISSIONS_FOR_ROLE.client_viewer).toEqual([
      "view_candidates",
      "view_reports",
    ]);
  });

  it("allows up to 50 recruiter seats for enterprise plans", () => {
    expect(MAX_CLIENT_SEAT_LIMIT).toBe(50);
  });
});

describe("hasClientPermission", () => {
  it("fails closed on a missing permission list", () => {
    expect(hasClientPermission(undefined, "view_candidates")).toBe(false);
    expect(hasClientPermission(null, "view_candidates")).toBe(false);
    expect(hasClientPermission([], "view_candidates")).toBe(false);
  });

  it("matches exactly, never by prefix", () => {
    expect(hasClientPermission(["view_reports"], "view_candidates")).toBe(false);
    expect(hasClientPermission(["view_candidates"], "view_candidates")).toBe(true);
  });
});

describe("candidate visibility ladder", () => {
  it("treats anything other than an explicit approval as hidden", () => {
    expect(candidateVisibilityLevel({})).toBe("hidden");
    expect(candidateVisibilityLevel({ client_visibility: "hidden" })).toBe("hidden");
    expect(candidateVisibilityLevel({ client_visibility: null })).toBe("hidden");
  });

  it("does not treat a released contact as approval", () => {
    expect(
      candidateVisibilityLevel({
        client_visibility: "hidden",
        contact_released_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe("hidden");
  });

  it("keeps approval and contact release as distinct levels", () => {
    expect(candidateVisibilityLevel({ client_visibility: "visible" })).toBe("approved");
    expect(
      candidateVisibilityLevel({
        client_visibility: "visible",
        contact_released_at: "2026-01-01T00:00:00Z",
      }),
    ).toBe("contact_released");
  });
});

describe("contact masking", () => {
  it("never returns the original address", () => {
    const masked = maskEmail("alexandra.smith@acme.com");
    expect(masked).not.toContain("alexandra.smith");
    expect(masked.startsWith("a")).toBe(true);
  });

  it("falls back to the placeholder for missing values", () => {
    expect(maskEmail(null)).toBe(MASKED_CONTACT);
    expect(maskEmail("not-an-email")).toBe(MASKED_CONTACT);
    expect(maskPhone(undefined)).toBe(MASKED_CONTACT);
  });

  it("reveals at most the last two phone digits", () => {
    const masked = maskPhone("+351912345678");
    expect(masked).toContain("78");
    expect(masked).not.toContain("912345");
  });
});
