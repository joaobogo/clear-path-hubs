import { describe, it, expect } from "vitest";
import { resolveWorkAuthorisation, resolveWorkArrangement } from "../jobs/public-facts";

describe("Jobs Integrity - Facts Consistency", () => {
  it("resolves work authorization with proper country casing", () => {
    const wa = {
      sponsorship_available: false,
      countries: ["unites states", "portugal"]
    };
    const result = resolveWorkAuthorisation(wa, null);
    expect(result).toContain("United States");
    expect(result).toContain("Portugal");
    expect(result).toContain("No sponsorship");
  });

  it("resolves hybrid work arrangement with days specified", () => {
    const result = resolveWorkArrangement("hybrid", 3);
    expect(result).toBe("Hybrid — 3 days a week on-site");
  });

  it("resolves hybrid work arrangement without days specified", () => {
    const result = resolveWorkArrangement("hybrid", null);
    expect(result).toBe("Hybrid — on-site days not specified");
  });

  it("resolves onsite work arrangement", () => {
    const result = resolveWorkArrangement("onsite", null);
    expect(result).toBe("On-site, full time");
  });
});
