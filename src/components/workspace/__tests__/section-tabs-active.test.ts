import { describe, expect, it } from "vitest";
import { activeTab, type SectionTab } from "@/components/workspace/section-tabs";

/**
 * Shortlist and Board share `/client/candidates`. Exactly one may be
 * highlighted, decided by the current search params.
 */
const tabs: SectionTab[] = [
  { to: "/client/candidates", label: "Shortlist" },
  { to: "/client/candidates", label: "Board", search: { view: "board" } },
  { to: "/client/talent-pool", label: "Talent pool" },
];

describe("activeTab", () => {
  it("picks the search-less tab when no view param is set", () => {
    expect(activeTab("/client/candidates", tabs, {})?.label).toBe("Shortlist");
  });

  it("picks the search-less tab for other view values", () => {
    expect(activeTab("/client/candidates", tabs, { view: "list" })?.label).toBe("Shortlist");
  });

  it("picks Board when view=board", () => {
    expect(activeTab("/client/candidates", tabs, { view: "board" })?.label).toBe("Board");
  });

  it("ignores unrelated params, including org", () => {
    expect(activeTab("/client/candidates", tabs, { org: "abc", view: "board" })?.label).toBe(
      "Board",
    );
    expect(activeTab("/client/candidates", tabs, { org: "abc" })?.label).toBe("Shortlist");
  });

  it("still matches plain tabs and returns null off-group", () => {
    expect(activeTab("/client/talent-pool", tabs, {})?.label).toBe("Talent pool");
    expect(activeTab("/client/offers", tabs, {})).toBeNull();
  });
});
