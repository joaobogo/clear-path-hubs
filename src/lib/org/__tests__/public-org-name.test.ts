import { describe, expect, it } from "vitest";
import { publicOrgName, publicOrgNameOr } from "@/lib/org/public-org-name";

describe("publicOrgName", () => {
  it("strips bracketed internal suffixes", () => {
    expect(publicOrgName("Northwind Talent (Demo)")).toBe("Northwind Talent");
    expect(publicOrgName("Acme [QA]")).toBe("Acme");
    expect(publicOrgName("Acme (sandbox)")).toBe("Acme");
  });

  it("strips dashed and piped markers", () => {
    expect(publicOrgName("Acme - Demo")).toBe("Acme");
    expect(publicOrgName("Acme | Staging")).toBe("Acme");
    expect(publicOrgName("Acme (Demo) - test")).toBe("Acme");
  });

  it("leaves legitimate names untouched", () => {
    expect(publicOrgName("Demo Group Holdings")).toBe("Demo Group Holdings");
    expect(publicOrgName("Testa Rossa (Portugal)")).toBe("Testa Rossa (Portugal)");
  });

  it("falls back when nothing usable remains", () => {
    expect(publicOrgNameOr(null, "Hiring Organization")).toBe("Hiring Organization");
    expect(publicOrgNameOr("  ", "Hiring Organization")).toBe("Hiring Organization");
  });
});
