/**
 * The shared protected-attribute detector for hiring criteria: what it flags,
 * what it must leave alone, and the rewrite it offers.
 */
import { describe, expect, it } from "vitest";
import {
  assertNoProtectedCriteria,
  findProtectedCriteria,
  findProtectedCriteriaInFields,
  isProtectedAttributeText,
  listFields,
  PROTECTED_CRITERIA_ERROR_PREFIX,
  suggestedRewrite,
} from "@/lib/scoring/protected-attributes";

const cats = (t: string) => findProtectedCriteria(t).map((f) => f.category);

describe("findProtectedCriteria flags", () => {
  it("nationality, with a market rewrite", () => {
    const [f] = findProtectedCriteria("Korean nationality", { roleTitle: "Group Marketing Manager" });
    expect(f?.category).toBe("nationality");
    expect(f?.suggestion).toBe("Marketing experience in the South Korean market");
    expect(f?.replacement).toBe("Marketing experience in the South Korean market");
    expect(f?.message).toMatch(/Nationality can't be a hiring criterion/);
  });

  it("nationality without a role title words the rewrite generically", () => {
    expect(suggestedRewrite("Japanese nationals only")).toBe("Experience in the Japanese market");
    expect(suggestedRewrite("Must be of Indian nationality")).toBe("Experience in the Indian market");
  });

  it("Arab / Arabic nationality becomes Arabic language skills", () => {
    expect(suggestedRewrite("Arabic national")).toBe("Arabic language skills");
    expect(suggestedRewrite("Arab nationality")).toBe("Arabic language skills");
    expect(suggestedRewrite("Arab candidates only")).toBe("Arabic language skills");
  });

  it("'must be <demonym>' and '<demonym> candidates only'", () => {
    expect(cats("Candidates must be Singaporean")).toEqual(["nationality"]);
    expect(cats("Filipino candidates preferred")).toEqual(["nationality"]);
    expect(cats("Nationality: Emirati")).toEqual(["nationality"]);
  });

  it("citizenship and passports, with a work-authorisation rewrite", () => {
    expect(suggestedRewrite("Must be a UK citizen")).toBe("Eligible to work in the UK");
    expect(suggestedRewrite("US citizenship required")).toBe("Eligible to work in the US");
    expect(suggestedRewrite("British passport holder")).toBe("Eligible to work in the UK");
    expect(suggestedRewrite("EU passport holders only")).toBe("Eligible to work in the EU");
    expect(cats("Citizenship of Canada")).toEqual(["citizenship"]);
  });

  it("age limits are removed, with the reason", () => {
    const [f] = findProtectedCriteria("Under 35");
    expect(f?.category).toBe("age");
    expect(f?.suggestion).toBeNull();
    expect(f?.replacement).toBe("");
    expect(f?.message).toMatch(/Age limits/);
    expect(suggestedRewrite("Fluent English, under 35")).toBe("Fluent English");
    for (const t of [
      "Aged 25-35",
      "Age limit 40",
      "Maximum age 45",
      "25 to 35 years old",
      "Not older than 40.",
      "Born after 1990",
      "Young professionals preferred",
      "Digital native",
    ]) {
      expect(cats(t), t).toContain("age");
    }
  });

  it("gender, religion, marital status and ethnicity", () => {
    expect(cats("Male candidates only")).toEqual(["gender"]);
    expect(cats("Must be female")).toEqual(["gender"]);
    expect(cats("Muslim candidates preferred")).toEqual(["religion"]);
    expect(cats("Single candidates only")).toEqual(["marital_status"]);
    expect(cats("No children")).toEqual(["marital_status"]);
    expect(cats("Marital status: married")).toEqual(["marital_status"]);
    expect(cats("Caucasian appearance")).toEqual(["ethnicity"]);
    expect(cats("Ethnicity: Chinese")).toEqual(["ethnicity"]);
    expect(suggestedRewrite("Male candidates only")).toBe("");
  });

  it("place of birth goes with the place named", () => {
    expect(suggestedRewrite("Born in Seoul")).toBe("");
    expect(cats("Local nationals only")).toEqual(["nationality"]);
    expect(cats("Aged 18-25")).toEqual(["age"]);
  });

  it("native speaker becomes fluent", () => {
    expect(suggestedRewrite("Native English speaker")).toBe("Fluent English speaker");
    expect(suggestedRewrite("Arabic: native-level")).toBe("Arabic: fluent");
    expect(cats("Mother tongue Arabic")).toEqual(["native_speaker"]);
  });

  it("keeps the rest of a longer criterion", () => {
    expect(suggestedRewrite("5+ years in FMCG, under 40")).toBe("5+ years in FMCG");
    expect(suggestedRewrite("Retail marketing in Korea; Korean nationality preferred", { roleTitle: "Marketing Director" })).toBe(
      "Retail marketing in Korea; marketing experience in the South Korean market",
    );
  });
});

describe("findProtectedCriteria never flags market, location or work wording", () => {
  for (const t of [
    "Experience in the Korean market",
    "Marketing experience in at least one of: South Korea, Japan, Singapore, Hong Kong, China or Vietnam",
    "Experience in the German, French or Benelux markets",
    "Eligible to work in the UAE",
    "Must have the right to work in the UK without sponsorship",
    "Based in Dubai",
    "If outside the UAE, must be willing to relocate to Dubai",
    "Arabic language skills",
    "Fluent in Korean and English",
    "Over 10 years of experience in retail",
    "Over 5 years managing teams",
    "Experience with React Native",
    "Cloud-native architecture",
    "Single point of contact for key accounts",
    "Must be Dynamic and Strategic",
    "Strategic candidates preferred",
    "Bachelor's degree in Marketing",
    "Managed a team of 25",
    "Revenue under 50 million",
    "We are an equal opportunity employer and welcome applicants regardless of race, religion, gender, age or nationality.",
    "Applicants of any nationality are welcome.",
    "Experience selling to Asian markets",
    "Technical background in SaaS",
    "Local candidates preferred",
    "Must be over 18",
    "Age 18+",
    "Must hold a valid passport for travel",
    "Gender-neutral language in all copy",
    "Aged care experience",
    "Must be Arabic speaking",
    "Christian Dior brand experience",
    "Married to the mission",
    "Under 30 minutes response time",
    "Native app development",
  ]) {
    it(t, () => expect(findProtectedCriteria(t)).toEqual([]));
  }
});

describe("field-level guard", () => {
  it("lists every finding with its rewrite and refuses with a clear message", () => {
    const fields = listFields("must_have_skills", "Must-have", [
      "Experience in the Korean market",
      "Korean nationality",
      "Under 35",
    ]);
    const found = findProtectedCriteriaInFields(fields, { roleTitle: "Marketing Manager" });
    expect(found.map((f) => [f.label, f.replacement])).toEqual([
      ["Must-have 2", "Marketing experience in the South Korean market"],
      ["Must-have 3", ""],
    ]);
    expect(() => assertNoProtectedCriteria(fields, { roleTitle: "Marketing Manager" })).toThrow(
      new RegExp(`^${PROTECTED_CRITERIA_ERROR_PREFIX}2 criteria use protected-attribute wording`),
    );
    try {
      assertNoProtectedCriteria(fields);
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/Must-have 2 \("Korean nationality"\)/);
      expect(msg).toMatch(/Suggested: "Experience in the South Korean market"/);
      expect(msg).toMatch(/Must-have 3 \("Under 35"\): Age limits .* Suggested: remove it\./);
    }
  });

  it("passes clean criteria", () => {
    expect(() =>
      assertNoProtectedCriteria(listFields("x", "Must-have", ["Eligible to work in the UAE", "Based in Dubai"])),
    ).not.toThrow();
  });

  it("leaves the scorer's own filter unchanged (scores do not move)", () => {
    expect(isProtectedAttributeText("Under 35")).toBe(false);
    expect(isProtectedAttributeText("Korean national preferred")).toBe(true);
  });
});
