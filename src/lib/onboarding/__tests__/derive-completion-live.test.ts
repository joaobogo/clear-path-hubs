import { describe, expect, it } from "vitest";
import { deriveOnboardingCompletion } from "../derive-completion";
import { ONBOARDING_STEP_IDS } from "../onboarding-steps";

describe("deriveOnboardingCompletion", () => {
  it("reads a live, producing role as fully set up", () => {
    const complete = deriveOnboardingCompletion({
      organizationName: "Northwind",
      confirmed: {},
      position: {
        title: "Senior Full-Stack Engineer",
        status: "active",
        searchLiveAt: "2026-08-12T00:00:00Z",
        deliveredCandidates: 13,
      },
    });
    expect(complete).toEqual([...ONBOARDING_STEP_IDS]);
  });

  it("counts delivered candidates alone as proof of setup", () => {
    const complete = deriveOnboardingCompletion({
      organizationName: "Northwind",
      position: { title: "Role", status: "draft", deliveredCandidates: 4 },
    });
    expect(complete).toEqual([...ONBOARDING_STEP_IDS]);
  });

  it("still walks a genuinely new role through the steps", () => {
    const complete = deriveOnboardingCompletion({
      organizationName: "Northwind",
      confirmed: { workspace: true },
      position: { title: "New role", status: "draft", mustHaveCount: 1 },
    });
    expect(complete).toEqual(["workspace", "role"]);
  });
});
