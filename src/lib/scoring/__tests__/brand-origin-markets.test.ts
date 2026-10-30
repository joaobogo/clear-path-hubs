import { describe, expect, it } from "vitest";
import { evaluateMarketRequirement } from "../structured-requirements";
import { brandOriginsIn } from "../brand-origins";

const REQ =
  "Hands-on marketing experience in at least one of: South Korea, Japan, Singapore, Hong Kong, China or Vietnam — working in-market or marketing brands from or into those markets";
const today = new Date("2026-10-30T00:00:00Z");
const status = (cv: string) => evaluateMarketRequirement(REQ, cv, today)?.status;

describe("brand origin counts as market experience", () => {
  it("credits marketing a Japanese or Hong Kong brand from Dubai (CV spelling kept)", () => {
    const cv = [
      "Group Marketing Director, Damas Jewellery, Dubai 2020 – 2025",
      "Lead the regional marketing strategy of Damas international brands portfolio operating under JV and exclusive distribution: Graff Dubai, Mikomoto UAE, Roberto Coin UAE, Queelin UAE",
    ].join("\n");
    const v = evaluateMarketRequirement(REQ, cv, today)!;
    expect(v.status).toBe("met");
    expect(v.note).toMatch(/Mikomoto \(Japan\)/);
  });

  it("credits a Chinese brand marketed in another country", () => {
    expect(status("Marketing Manager, Haier Pakistan, Lahore 2012 – 2019\nLed brand and trade marketing for Haier appliances.")).toBe("met");
  });

  it("credits a GCC go-to-market for a Japanese automaker", () => {
    expect(status("Marketing Manager, Arabian Automobiles 2002 – 2005\nNissan GCC go-to-market and dealer launches.")).toBe("met");
  });

  it("credits 'Korean brands' written as an origin, never a nationality", () => {
    expect(status("Brand Manager, Beauty Distributor, Dubai 2018 – 2022\nLaunched three Korean brands in the UAE.")).toBe("met");
    expect(status("Personal: Korean national\nMarketing Manager, Emaar 2015 – 2020")).toBe("missing");
  });

  it("keeps sourcing from a brand's home as partial", () => {
    expect(status("Category Manager 2015 – 2018\nSourcing and supplier negotiations with Haier and Hisense factories.")).toBe("partial");
  });

  it("counts campaigns aimed at a market's consumers as marketing into it", () => {
    expect(status("Marketing Director, Destination 2012 – 2016\nLed roadshows and campaigns in China and Japan for inbound visitors.")).toBe("met");
  });

  it("makes an unnamed APAC or Southeast Asia remit partial, not missing", () => {
    expect(status("Regional Marketing Manager 2016 – 2020\nBrand frameworks for GCC, SEA & India; South East Asia distributors.")).toBe("partial");
  });

  it("stays missing with no link at all", () => {
    expect(status("Marketing Director, Emaar Malls, Dubai 2012 – 2020\nLed campaigns across the UAE and KSA.")).toBe("missing");
  });
});

describe("brandOriginsIn", () => {
  it("matches initials only as written", () => {
    expect(brandOriginsIn("LG Electronics regional launch").map((b) => b.country)).toEqual(["South Korea"]);
    expect(brandOriginsIn("lg and kia were mentioned in lower case")).toEqual([]);
  });

  it("ignores adjectives that are not countries", () => {
    expect(brandOriginsIn("Dubai Holding group and Premium brands")).toEqual([]);
  });
});
