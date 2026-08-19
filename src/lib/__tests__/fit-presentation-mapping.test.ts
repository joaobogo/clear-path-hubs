import { describe, it, expect } from "vitest";
import { toFitPresentation } from "../client-fit-presentation";

describe("Fit Presentation Band Mapping", () => {
  it("maps 95+ to Exceptional Match", () => {
    const result = toFitPresentation(null, 96);
    expect(result.headline).toBe("Exceptional Match");
    expect(result.band).toBe("exceptional");
  });

  it("maps 85-94 to Strong Match (previously Exceptional)", () => {
    const result = toFitPresentation(null, 88);
    expect(result.headline).toBe("Strong Match");
    expect(result.band).toBe("strong");
  });

  it("maps 70-84 to Good Potential (previously Strong)", () => {
    const result = toFitPresentation(null, 75);
    expect(result.headline).toBe("Good Potential");
    expect(result.band).toBe("good");
  });

  it("maps 50-69 to Mixed Fit", () => {
    const result = toFitPresentation(null, 55);
    expect(result.headline).toBe("Mixed Fit");
    expect(result.band).toBe("mixed");
  });
});
