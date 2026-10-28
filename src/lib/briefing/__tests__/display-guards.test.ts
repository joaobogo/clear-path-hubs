import { describe, expect, it } from "vitest";
import {
  detailWithoutTitle,
  narrativeToShow,
  uniqueByTitle,
  uniqueHighlights,
} from "@/lib/briefing/display-guards";

const PARA =
  "Radwa brings over 20 years of destination, hospitality and entertainment marketing, 16 of them in Dubai.";

describe("briefing display guards", () => {
  it("hides a narrative that repeats the pitch", () => {
    expect(narrativeToShow(PARA, PARA)).toBeNull();
    expect(narrativeToShow(PARA, `  ${PARA.toUpperCase()}  `)).toBeNull();
    expect(narrativeToShow(`${PARA} More text.`, PARA)).toBeNull();
  });

  it("keeps a narrative that adds something", () => {
    expect(narrativeToShow(PARA, "Two things to cover at interview.")).toBe(
      "Two things to cover at interview.",
    );
    expect(narrativeToShow(null, PARA)).toBe(PARA);
    expect(narrativeToShow(PARA, "")).toBeNull();
  });

  it("drops repeated highlights, keeping order and the first copy", () => {
    expect(uniqueHighlights(["A launch.", "B", "a launch", "C"])).toEqual(["A launch.", "B", "C"]);
    expect(uniqueHighlights("not a list")).toEqual([]);
  });

  it("strips a title repeated at the start of its own detail", () => {
    expect(
      detailWithoutTitle(
        "Retail tenant marketing",
        "Retail tenant marketing: her portfolio centres on destinations, hospitality, entertainment and real estate.",
      ),
    ).toBe("Her portfolio centres on destinations, hospitality, entertainment and real estate.");
    expect(
      detailWithoutTitle(
        "Recent tenure pattern",
        "Recent tenure pattern - four roles between 2016 and 2020.",
      ),
    ).toBe("Four roles between 2016 and 2020.");
  });

  it("leaves a detail alone when it does not repeat the title", () => {
    expect(detailWithoutTitle("Sector", "Her experience is in footwear.")).toBe(
      "Her experience is in footwear.",
    );
    expect(detailWithoutTitle("Sector", "Sector:")).toBe("Sector:");
    expect(detailWithoutTitle("Sector", null)).toBeNull();
  });

  it("collapses items with the same title", () => {
    const out = uniqueByTitle<{ title: string; detail: string }>([
      { title: "Retail tenant marketing", detail: "a" },
      { title: "Retail tenant marketing.", detail: "b" },
      { title: "Recent roles", detail: "c" },
    ]);
    expect(out.map((o) => o.detail)).toEqual(["a", "c"]);
  });
});
