import { describe, expect, it } from "vitest";
import {
  isFieldProtected,
  normalizeParsedCertifications,
  normalizeParsedYears,
  planProfileBackfill,
} from "@/lib/cv/profile-backfill";
import { toClientCandidateDTO } from "@/lib/client-kpi.server";

/**
 * Hughes research, item 5: "Parser output never reaches the profile."
 * Each profile below is the live row for a Mushroom Harvesting Manager
 * applicant (2 Nov 2026): consent.extracted held the certifications, the
 * certifications column was [], and the client page showed none of them.
 */
const noFacts = { years_experience: null, linkedin_url: null, languages: [], skills: [] };

const vijay = {
  certifications: [],
  years_experience: 5,
  linkedin_url: "https://www.linkedin.com/in/vijay-mane-a77805211/",
  languages: [{ name: "English", level: "fluent" }],
  skills: ["Crop assessment"],
  consent: {
    provenance: { certifications: { source: "cv_parsed" } },
    extracted: {
      certifications: [
        "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
        "Practical Shiitake Mushroom Production Training",
      ],
    },
  },
};

const daim = {
  certifications: [],
  years_experience: null,
  linkedin_url: "https://linkedin.com/in/daimahmedshah/",
  languages: [],
  skills: [],
  consent: {
    extracted: {
      certifications: ["IOSH Managing Safely", "LANTRA Temporary Traffic Management"],
      years_of_experience: 5,
    },
  },
};

const anna = {
  certifications: [],
  years_experience: 3,
  linkedin_url: "https://www.linkedin.com/in/anna-2809m",
  consent: {
    extracted: {
      certifications: [
        "Germplasm Value Preservation (GVP)",
        "HSE Policy & Standards",
        "Lift Truck Operator",
        "Fire Safety",
        "Corporate Security",
        "Cybersecurity Awareness",
        "AI at Syngenta",
        "HACCP",
        "ISO/IEC 17025 Awareness",
        "Food Safety & Hygiene",
        "Food Labelling / FSS- related training",
        "FSSC / food-safety management training",
      ],
    },
  },
};

const chiedza = {
  certifications: null,
  years_experience: null,
  linkedin_url: null,
  consent: { extracted: { certifications: ["Driver’s license code 10"] } },
};

describe("planProfileBackfill — the Hughes Mushrooms applicants", () => {
  it("writes Vijay's two mushroom courses and leaves what he already has", () => {
    const patch = planProfileBackfill(vijay, noFacts);
    expect(patch.certifications?.map((c) => c.name)).toEqual([
      "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
      "Practical Shiitake Mushroom Production Training",
    ]);
    expect(patch.certifications?.[0]).toEqual({
      name: "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
      issuer: null,
      date: null,
    });
    expect(Object.keys(patch)).toEqual(["certifications"]);
  });

  it("writes Daim's IOSH and LANTRA and the five years hydration parsed", () => {
    const patch = planProfileBackfill(daim, noFacts);
    expect(patch.certifications?.map((c) => c.name)).toEqual([
      "IOSH Managing Safely",
      "LANTRA Temporary Traffic Management",
    ]);
    expect(patch.years_experience).toBe(5);
    expect(patch.linkedin_url).toBeUndefined();
  });

  it("writes all twelve of Anna's, HACCP and FSSC included", () => {
    const patch = planProfileBackfill(anna, noFacts);
    const names = patch.certifications?.map((c) => c.name) ?? [];
    expect(names).toHaveLength(12);
    expect(names).toContain("HACCP");
    expect(names).toContain("FSSC / food-safety management training");
    expect(patch.years_experience).toBeUndefined();
  });

  it("writes Chiedza's driving licence onto a NULL column", () => {
    const patch = planProfileBackfill(chiedza, noFacts);
    expect(patch.certifications).toEqual([
      { name: "Driver’s license code 10", issuer: null, date: null },
    ]);
  });

  it("refreshing evidence without a CV fact still repairs the profile from consent.extracted", () => {
    expect(planProfileBackfill(daim, null).certifications).toHaveLength(2);
  });
});

describe("planProfileBackfill — additive only", () => {
  it("never replaces certifications the candidate or a recruiter entered", () => {
    const patch = planProfileBackfill(
      { ...daim, certifications: [{ name: "CSCS Card", issuer: "CITB", date: "2024" }] },
      noFacts,
    );
    expect(patch.certifications).toBeUndefined();
  });

  it("never replaces a stored years_experience, LinkedIn, languages or skills", () => {
    const patch = planProfileBackfill(
      {
        certifications: [{ name: "x" }],
        years_experience: 7,
        linkedin_url: "https://linkedin.com/in/own-entry",
        // A language line stored as text is a value, not a gap.
        languages: "English (native), Shona (fluent)",
        skills: ["Harvest planning"],
        consent: { extracted: { years_of_experience: 12 } },
      },
      {
        years_experience: 10,
        linkedin_url: "https://linkedin.com/in/from-cv",
        languages: ["English"],
        skills: ["Picking"],
      },
    );
    expect(patch).toEqual({});
  });

  it("leaves an empty field alone when a person locked or corrected it", () => {
    expect(
      planProfileBackfill({ ...daim, consent: { ...daim.consent, locked_fields: ["certifications"] } }, noFacts)
        .certifications,
    ).toBeUndefined();
    expect(
      planProfileBackfill(
        {
          ...daim,
          consent: { ...daim.consent, provenance: { certifications: { source: "admin_corrected" } } },
        },
        noFacts,
      ).certifications,
    ).toBeUndefined();
    expect(
      planProfileBackfill(
        {
          ...daim,
          consent: { ...daim.consent, provenance: { years_of_experience: { source: "user_confirmed" } } },
        },
        noFacts,
      ).years_experience,
    ).toBeUndefined();
  });

  it("prefers the deterministic CV fact over the model's years", () => {
    expect(planProfileBackfill(daim, { ...noFacts, years_experience: 6 }).years_experience).toBe(6);
  });

  it("fills LinkedIn, languages and skills from the CV only when empty", () => {
    const patch = planProfileBackfill(
      { certifications: [], years_experience: null, linkedin_url: "", languages: [], skills: null, consent: null },
      {
        years_experience: null,
        linkedin_url: "https://linkedin.com/in/someone",
        languages: ["English (fluent)"],
        skills: ["Harvest planning"],
      },
    );
    expect(patch).toEqual({
      linkedin_url: "https://linkedin.com/in/someone",
      languages: ["English (fluent)"],
      skills: ["Harvest planning"],
    });
  });

  it("returns nothing for a missing profile", () => {
    expect(planProfileBackfill(null, noFacts)).toEqual({});
  });
});

describe("normalizeParsedCertifications", () => {
  it("maps objects with alias keys onto name/issuer/date", () => {
    expect(
      normalizeParsedCertifications([
        { title: "Food Hygiene Level 3", organization: "  Highfield ", year: 2021 },
        { name: "IOSH Managing Safely", issuer: "IOSH", date: "2023-04" },
      ]),
    ).toEqual([
      { name: "Food Hygiene Level 3", issuer: "Highfield", date: "2021" },
      { name: "IOSH Managing Safely", issuer: "IOSH", date: "2023-04" },
    ]);
  });

  it("drops blanks, collapses whitespace and keeps repeats once", () => {
    expect(
      normalizeParsedCertifications(["  HACCP ", "haccp", "", null, 7, { issuer: "no name" }, "Fire\n Safety"]),
    ).toEqual([
      { name: "HACCP", issuer: null, date: null },
      { name: "Fire Safety", issuer: null, date: null },
    ]);
  });

  it("caps the list at the profile editor's limit of 50", () => {
    const many = Array.from({ length: 60 }, (_, i) => `Course ${i}`);
    expect(normalizeParsedCertifications(many)).toHaveLength(50);
  });

  it("reads nothing from a non-list", () => {
    expect(normalizeParsedCertifications(undefined)).toEqual([]);
    expect(normalizeParsedCertifications({})).toEqual([]);
  });
});

describe("normalizeParsedYears", () => {
  it("rounds down and keeps 1..60", () => {
    expect(normalizeParsedYears(5)).toBe(5);
    expect(normalizeParsedYears(4.6)).toBe(4);
    expect(normalizeParsedYears("5+")).toBe(5);
    expect(normalizeParsedYears(0)).toBeNull();
    expect(normalizeParsedYears(0.5)).toBeNull();
    expect(normalizeParsedYears(61)).toBeNull();
    expect(normalizeParsedYears("five")).toBeNull();
    expect(normalizeParsedYears(null)).toBeNull();
  });
});

describe("isFieldProtected", () => {
  it("is false without consent and true for any locked alias", () => {
    expect(isFieldProtected(null, ["certifications"])).toBe(false);
    expect(isFieldProtected({ locked_fields: ["years_of_experience"] }, ["years_experience", "years_of_experience"])).toBe(true);
  });
});

describe("the client workspace sees the backfilled certifications", () => {
  function clientRow(certifications: unknown) {
    return {
      id: "m1",
      stage: "delivered",
      delivered_at: "2026-11-02T00:00:00Z",
      updated_at: "2026-11-02T00:00:00Z",
      candidate_profiles: { full_name: "Vijay Mane", certifications, updated_at: "2026-11-02T00:00:00Z" },
      positions: { id: "p1", title: "Mushroom Harvesting Manager", requirements: [], preferred_requirements: [] },
    };
  }

  it("shows Vijay's courses once the plan is written", () => {
    const written = planProfileBackfill(vijay, noFacts).certifications;
    const dto = toClientCandidateDTO(clientRow(written));
    expect(dto.certifications.map((c) => c.name)).toEqual([
      "Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation",
      "Practical Shiitake Mushroom Production Training",
    ]);
  });

  it("shows a certification stored as a plain string instead of dropping it", () => {
    const dto = toClientCandidateDTO(clientRow(["IOSH Managing Safely", { name: "LANTRA", issuer: "Lantra" }, "  "]));
    expect(dto.certifications).toEqual([
      { name: "IOSH Managing Safely", issuer: null, date: null },
      { name: "LANTRA", issuer: "Lantra", date: null },
    ]);
  });
});
