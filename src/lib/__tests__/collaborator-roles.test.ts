import { describe, expect, it } from "vitest";
import {
  AREA_ROLES,
  COLLABORATOR_ROLES,
  COLLABORATOR_ROLE_IDS,
  canAccessArea,
  collaboratorRoleLabel,
} from "../collaborator-roles";

describe("collaborator roles", () => {
  it("has exactly three roles with the plain labels the UI shows", () => {
    expect(COLLABORATOR_ROLE_IDS).toEqual(["client_admin", "client_editor", "client_viewer"]);
    expect(COLLABORATOR_ROLE_IDS.map((r) => COLLABORATOR_ROLES[r].label)).toEqual([
      "Admin",
      "Hiring manager",
      "Interviewer",
    ]);
  });

  it("keeps team and billing admin-only", () => {
    expect(AREA_ROLES.team).toEqual(["client_admin"]);
    expect(AREA_ROLES.billing).toEqual(["client_admin"]);
    expect(canAccessArea("client_editor", "billing")).toBe(false);
    expect(canAccessArea("client_viewer", "team")).toBe(false);
    expect(canAccessArea("client_admin", "billing")).toBe(true);
  });

  it("limits an interviewer to assigned candidates and feedback", () => {
    expect(canAccessArea("client_viewer", "candidates")).toBe(true);
    expect(canAccessArea("client_viewer", "feedback")).toBe(true);
    expect(canAccessArea("client_viewer", "role_settings")).toBe(false);
    expect(canAccessArea("client_viewer", "decisions")).toBe(false);
  });

  it("lets a hiring manager run roles but not the team", () => {
    expect(canAccessArea("client_editor", "role_settings")).toBe(true);
    expect(canAccessArea("client_editor", "decisions")).toBe(true);
    expect(canAccessArea("client_editor", "team")).toBe(false);
  });

  it("denies unknown or missing roles", () => {
    expect(canAccessArea(null, "candidates")).toBe(false);
    expect(canAccessArea("random_role", "feedback")).toBe(false);
  });

  it("labels platform staff without exposing internal role names", () => {
    expect(collaboratorRoleLabel("platform_admin")).toBe("TaaSFlow team");
    expect(collaboratorRoleLabel("operations")).toBe("TaaSFlow team");
    expect(collaboratorRoleLabel(null)).toBe("Member");
  });

  it("states plainly that no client role sees internal recruiter data", () => {
    expect(COLLABORATOR_ROLES.client_admin.cannot.join(" ")).toMatch(/internal recruiter/i);
  });
});
