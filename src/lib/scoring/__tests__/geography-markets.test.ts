/**
 * v1.7.1: market experience for any country, from the shared geography
 * dictionary. Only places count; demonyms count only before "market(s)".
 */
import { describe, expect, it } from "vitest";
import { allCountries, countryByName, placesIn, regionsOf } from "@/lib/scoring/geography";
import {
  evaluateMarketRequirement,
  evaluateStructuredRequirement,
  parseMarketRequirement,
} from "@/lib/scoring/structured-requirements";

const TODAY = new Date("2026-10-29T00:00:00Z");
const names = (text: string) => placesIn(text).map((p) => p.name).sort();
const marketsOf = (req: string) => parseMarketRequirement(req)?.markets.map((m) => m.name).sort() ?? null;

describe("geography dictionary", () => {
  it("covers at least 80 countries across every region", () => {
    const all = allCountries();
    expect(all.length).toBeGreaterThanOrEqual(80);
    expect(new Set(regionsOf(all))).toEqual(
      new Set(["Asia-Pacific", "Middle East", "Europe", "North America", "Latin America", "Africa"]),
    );
  });

  it("recognises common names and abbreviations", () => {
    for (const [text, country] of [
      ["Head of Marketing, London, UK", "United Kingdom"],
      ["Brand lead for Great Britain", "United Kingdom"],
      ["Sales director, USA", "United States"],
      ["Country manager for the U.S.", "United States"],
      ["Operations across the United States", "United States"],
      ["Retail lead, UAE", "United Arab Emirates"],
      ["Launched in KSA", "Saudi Arabia"],
      ["Regional office, HK", "Hong Kong"],
      ["Distribution in the PRC", "China"],
      ["Office in São Paulo", "Brazil"],
      ["Office in Sao Paulo", "Brazil"],
      ["Team in Bogotá", "Colombia"],
      ["Moved to Zürich", "Switzerland"],
      ["Retail in Riyadh and Jeddah", "Saudi Arabia"],
      ["Based in Lagos", "Nigeria"],
      ["Agency in Nairobi", "Kenya"],
      ["Partner, Mexico City", "Mexico"],
    ] as const) {
      expect(names(text), text).toContain(country);
    }
  });

  it("abbreviations are case-sensitive: 'us' is a pronoun", () => {
    expect(names("Contact us for references")).not.toContain("United States");
    expect(names("Paid in US$ across the region")).not.toContain("United States");
    expect(names("the uk market")).not.toContain("United Kingdom");
  });

  it("names that are also first names or words need a place context", () => {
    expect(names("Jordan Smith, Marketing Manager")).not.toContain("Jordan");
    expect(names("Amman, Jordan")).toContain("Jordan");
    expect(names("Holland Taylor")).not.toContain("Netherlands");
    expect(names("Albuquerque, New Mexico")).not.toContain("Mexico");
    expect(names("Pyongyang, North Korea")).not.toContain("South Korea");
  });

  it("never treats a nationality, demonym or language as a place", () => {
    for (const text of [
      "Korean national",
      "Japanese citizen",
      "Speaks Mandarin and Cantonese",
      "Fluent in German and French",
      "Saudi national",
      "British passport holder",
    ]) {
      expect(names(text), text).toEqual([]);
    }
  });

  it("an adjective names a market only before 'market(s)'", () => {
    expect(names("Led the Korean market")).toEqual(["South Korea"]);
    expect(names("Experience in the German, French or Benelux markets")).toEqual(
      ["Belgium", "Benelux", "France", "Germany", "Luxembourg", "Netherlands"].sort(),
    );
    expect(names("Owned the UK and Irish markets")).toEqual(["Ireland", "United Kingdom"]);
  });

  it("groups expand to their member countries", () => {
    expect(names("GCC experience")).toEqual(
      ["Bahrain", "GCC", "Kuwait", "Oman", "Qatar", "Saudi Arabia", "United Arab Emirates"].sort(),
    );
    expect(countryByName("Germany")?.region).toBe("Europe");
  });
});

describe("parseMarketRequirement for any country", () => {
  it("recognises two or more countries in any region", () => {
    expect(marketsOf("Experience in the UK, Germany or France")).toEqual(["France", "Germany", "United Kingdom"]);
    expect(marketsOf("Sales experience in Brazil and Mexico")).toEqual(["Brazil", "Mexico"]);
    expect(marketsOf("Worked in Nigeria, Kenya or Ghana")).toEqual(["Ghana", "Kenya", "Nigeria"]);
    expect(marketsOf("Marketing experience in the KSA or UAE")).toEqual(["Saudi Arabia", "United Arab Emirates"]);
  });

  it("recognises one country named as a market", () => {
    expect(marketsOf("Experience in the Korean market")).toEqual(["South Korea"]);
    expect(marketsOf("Proven experience in the UK")).toEqual(["United Kingdom"]);
    expect(marketsOf("Strong background in the Saudi Arabia market")).toEqual(["Saudi Arabia"]);
  });

  it("supports adjectival market lists", () => {
    expect(marketsOf("Experience in the German, French or Benelux markets")).toEqual(
      ["Belgium", "Benelux", "France", "Germany", "Luxembourg", "Netherlands"].sort(),
    );
  });

  it("leaves location, relocation and work-authorisation requirements alone", () => {
    expect(parseMarketRequirement("Based in Dubai")).toBeNull();
    expect(parseMarketRequirement("Experience in Dubai retail")).toBeNull();
    expect(parseMarketRequirement("Eligible to work in the UAE")).toBeNull();
    expect(parseMarketRequirement("Must have the right to work in the UK or Ireland")).toBeNull();
    expect(parseMarketRequirement("Based in the UK, with experience in the UK")).toBeNull();
    expect(parseMarketRequirement("Korean national")).toBeNull();
    expect(parseMarketRequirement("Fluent Japanese and Korean")).toBeNull();
    expect(parseMarketRequirement("Experience with Salesforce")).toBeNull();
  });
});

describe("evaluateMarketRequirement for any country", () => {
  const REQ = "Experience in the German, French or Benelux markets";

  it("a dated role in Frankfurt is met", () => {
    const v = evaluateMarketRequirement(
      REQ,
      ["Jane Doe", "Head of Trade Marketing, Example GmbH, Frankfurt", "Jan 2019 - Present"].join("\n"),
      TODAY,
    );
    expect(v?.status).toBe("met");
    expect(v?.note).toMatch(/Germany/);
  });

  it("the CV naming the group itself in a role counts", () => {
    const v = evaluateMarketRequirement(
      "Marketing experience across GCC markets",
      ["Sam Lee", "Regional Brand Manager, GCC", "Mar 2018 - Dec 2023"].join("\n"),
      TODAY,
    );
    expect(v?.status).toBe("met");
  });

  it("a Korean nationality line never satisfies a Korean-market requirement", () => {
    const v = evaluateMarketRequirement(
      "Experience in the Korean market",
      ["Min Park", "Korean national", "Marketing Manager, Dubai", "Jan 2020 - Present"].join("\n"),
      TODAY,
    );
    expect(v?.status).toBe("missing");
  });

  it("'led the Korean market' in a role is met", () => {
    const v = evaluateMarketRequirement(
      "Experience in the Korean market",
      ["Min Park", "Brand Director APAC", "Jan 2020 - Present", "Led the Korean market launch for three brands."].join("\n"),
      TODAY,
    );
    expect(v?.status).toBe("met");
  });

  it("EMEA alone is a screening question for European markets", () => {
    const v = evaluateMarketRequirement(REQ, "Name\nLed EMEA retail strategy for a US group", TODAY);
    expect(v?.status).toBe("missing");
    expect(v?.needs_validation).toBe(true);
    expect(v?.note).toMatch(/Europe/);
  });

  it("the structured dispatcher still routes 'Based in Dubai or willing to relocate' to relocation", () => {
    const v = evaluateStructuredRequirement(
      "Based in Dubai or willing to relocate",
      "Name\nDubai, UAE\nMarketing Manager",
      TODAY,
    );
    expect(v?.rule).toBe("conditional_relocation");
  });
});
