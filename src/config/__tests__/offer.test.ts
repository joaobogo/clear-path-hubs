import { describe, expect, it } from "vitest";
import { offer, START_PILOT_LABEL } from "@/config/offer";
import { CTA_PRIMARY } from "@/config/cta";

/** The values the redesign document was drawn with. A change here is a
 *  pricing decision, not a refactor: update the document's offer file too. */
describe("offer", () => {
  it("matches the published pilot and packages", () => {
    expect(offer.pilot).toMatchObject({ price: 699, roles: 1, candidates: 10, businessDays: 5, seats: 2 });
    expect(offer.packages.map((p) => [p.roles, p.price])).toEqual([
      [10, 8000],
      [20, 15200],
      [30, 21600],
      [40, 27200],
      [100, 64000],
    ]);
    expect(offer.channels).toBe(23);
    expect(offer.agencyFee).toBe(0.2);
    expect(offer.accessMonths).toBe(3);
  });

  it("publishes no proof figure without a recorded source", () => {
    for (const m of offer.proof) expect(m.provenance.trim()).not.toBe("");
  });

  it("is the label the header and closing band use", () => {
    expect(CTA_PRIMARY.label).toBe(START_PILOT_LABEL);
  });
});
