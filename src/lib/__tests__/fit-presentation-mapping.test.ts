import { describe, it, expect } from "vitest";
import { toFitPresentation } from "../client-fit-presentation";

// One vocabulary, no re-banding between the score and the label a client reads.
describe("Fit Presentation Band Mapping", () => {
  it("maps 95+ to Exceptional", () => {
    const result = toFitPresentation(null, 96);
    expect(result.headline).toBe("Exceptional");
    expect(result.band).toBe("exceptional");
  });

  it("maps 85-94 to Top", () => {
    const result = toFitPresentation(null, 88);
    expect(result.headline).toBe("Top");
    expect(result.band).toBe("top");
  });

  it("maps 70-84 to Strong", () => {
    const result = toFitPresentation(null, 75);
    expect(result.headline).toBe("Strong");
    expect(result.band).toBe("strong");
  });

  it("maps 50-69 to Consider", () => {
    const result = toFitPresentation(null, 55);
    expect(result.headline).toBe("Consider");
    expect(result.band).toBe("consider");
  });

  it("maps below 50 to Not recommended", () => {
    const result = toFitPresentation(null, 22);
    expect(result.headline).toBe("Not recommended");
    expect(result.band).toBe("not_recommended");
  });

  it("never invents a band label from a stored internal string", () => {
    expect(toFitPresentation("not_a_fit", null).headline).toBe("Not recommended");
    expect(toFitPresentation("worth_considering", null).headline).toBe("Consider");
    expect(toFitPresentation("manual_review_required", null).headline).toBe("Consider");
  });
});
