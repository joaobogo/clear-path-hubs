/**
 * v1.7.0 rules on the CV shapes found on the Group Marketing Manager role:
 * every stored CV was one long line, career length is often stated rather
 * than dated, and the client added a market-experience must-have.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateDegreeRequirement,
  evaluateMarketRequirement,
  evaluateRelocationRequirement,
  evaluateYearsRequirement,
  findYearsClaims,
} from "@/lib/scoring/structured-requirements";
import {
  isProtectedAttributeText,
  removeProtectedSentences,
} from "@/lib/scoring/protected-attributes";
import { employmentIntervals } from "@/lib/cv/employment-dates";
import { isFlattenedCvText } from "@/lib/cv-extractor.server";
import { normaliseLetterSpacing } from "@/lib/cv/letter-spacing";

const TODAY = new Date("2026-10-29T00:00:00Z");
const MARKET =
  "Marketing experience in at least one of: South Korea, Japan, Singapore, Hong Kong, China or Vietnam";
const DEGREE = "Bachelor’s degree in Marketing, Business Administration or a related field";
const TEN = "10 or more years of progressive marketing experience";
const SENIOR = "Has been in a senior leadership role for atleast 2-3 years";

/** A CV as production stored it: one line, no breaks. */
const flat = (...parts: string[]) => parts.join(" ");

describe("market experience", () => {
  it("is a hiring criterion about places, never a protected attribute", () => {
    expect(isProtectedAttributeText(MARKET)).toBe(false);
    expect(
      isProtectedAttributeText(
        "Experience working in Korea, Hong Kong, Vietnam, China, Japan or Singapore",
      ),
    ).toBe(false);
    expect(removeProtectedSentences(MARKET)).toBe(MARKET);
    for (const t of [
      "Korean national preferred",
      "Japanese citizen",
      "Candidates must be Singaporean",
    ]) {
      expect(isProtectedAttributeText(t), t).toBe(true);
    }
  });

  it("a dated role in Tokyo is met, with the line quoted", () => {
    const v = evaluateMarketRequirement(
      MARKET,
      [
        "Director E-commerce, Uniqlo (India / Tokyo, Japan)",
        "Jan 2021 - Dec 2023",
        "SVP Omnichannel Asia",
      ].join("\n"),
      TODAY,
    );
    expect(v?.status).toBe("met");
    expect(v?.evidence[0]?.snippet).toMatch(/Tokyo/);
  });

  it("training, sourcing or benchmarking there is partial at most", () => {
    for (const line of [
      "Completed dealer training in Japan with Nissan",
      "Supplier negotiations in China for private-label ranges",
      "Used China as a source market and benchmarked against Singapore",
    ]) {
      expect(evaluateMarketRequirement(MARKET, `Name\n${line}`, TODAY)?.status, line).toBe(
        "partial",
      );
    }
  });

  it("nationality, birthplace and languages never count", () => {
    for (const line of [
      "Nationality: Japanese",
      "Born in Seoul, South Korea",
      "Languages: Korean, Japanese, English",
    ]) {
      expect(
        evaluateMarketRequirement(MARKET, `Name\n${line}\nMarketing Manager, Dubai`, TODAY)?.status,
        line,
      ).toBe("missing");
    }
  });

  it("a general Asia-Pacific mention is missing but flagged as a question", () => {
    const v = evaluateMarketRequirement(
      MARKET,
      "Name\nLed APAC retail strategy for a GCC group",
      TODAY,
    );
    expect(v?.status).toBe("missing");
    expect(v?.needs_validation).toBe(true);
  });

  it("leaves single-location requirements to the relocation and keyword rules", () => {
    expect(evaluateMarketRequirement("Experience in Dubai retail", "x", TODAY)).toBeNull();
  });
});

describe("a CV stored as one line", () => {
  const cv = flat(
    "AMIRA HASSAN Dubai, United Arab Emirates | +971 50 000 0000 | amira@example.com",
    "PROFESSIONAL SUMMARY Marketing leader with 18+ years of experience in retail and mall marketing across the GCC.",
    "WORK EXPERIENCE Group Marketing Director, Example Malls LLC Jan 2015 – Present Led brand, events and loyalty for six malls.",
    "Marketing Manager, Example Retail Mar 2008 – Dec 2014 Managed campaigns and a team of eight.",
    "EDUCATION Bachelor of Commerce (Marketing), University of Mumbai 2000 – 2003",
  );

  it("is recognised so the pipeline re-reads the original file", () => {
    expect(isFlattenedCvText(cv.repeat(5))).toBe(true);
    expect(isFlattenedCvText(cv.repeat(5), true)).toBe(false);
    expect(isFlattenedCvText("line one\nline two".repeat(200))).toBe(false);
  });

  it("still finds the degree, the location and the years", () => {
    expect(evaluateDegreeRequirement(DEGREE, cv)?.status).toBe("met");
    expect(evaluateDegreeRequirement(DEGREE, cv)?.evidence[0]?.snippet).toMatch(
      /Bachelor of Commerce \(Marketing\)/,
    );
    expect(
      evaluateRelocationRequirement("If outside the UAE must be willing to relocate", cv)?.status,
    ).toBe("met");
    expect(evaluateYearsRequirement(TEN, cv, TODAY)?.status).toBe("met");
    expect(evaluateYearsRequirement(SENIOR, cv, TODAY)?.status).toBe("met");
  });

  it("does not count education dates as work", () => {
    const v = evaluateYearsRequirement(
      TEN,
      flat("EDUCATION Bachelor of Commerce, University of Mumbai 2000 – 2014"),
      TODAY,
    );
    expect(v?.status).toBe("unknown");
  });
});

describe("career length stated in the CV", () => {
  it("'25+ years of retail marketing experience' meets ten years", () => {
    const v = evaluateYearsRequirement(
      TEN,
      "Name\nSVP Omnichannel with 25+ years of retail marketing experience.",
      TODAY,
    );
    expect(v?.status).toBe("met");
    expect(v?.needs_validation).toBe(true);
    expect(v?.note).toMatch(/states 25\+ years/);
  });

  it("numbers that are not durations of experience are ignored", () => {
    for (const line of [
      "Returned to work after a 10-year gap",
      "Mother of two, 10 years old and 7 years old",
      "Negotiated a 10 year lease for the flagship",
    ]) {
      expect(findYearsClaims(`Name\n${line}`), line).toEqual([]);
    }
  });

  it("leadership needs a leadership claim", () => {
    const cv = "Name\n16+ years in senior leadership roles across retail and hospitality.";
    expect(evaluateYearsRequirement(SENIOR, cv, TODAY)?.status).toBe("met");
    expect(
      evaluateYearsRequirement("At least 5 years in a marketing leadership role", cv, TODAY)
        ?.status,
    ).toBe("met");
    expect(
      evaluateYearsRequirement(SENIOR, "Name\n12 years of marketing experience in FMCG.", TODAY)
        ?.status,
    ).not.toBe("met");
  });
});

describe("based in X or willing to relocate", () => {
  const REQ = "Based in Dubai or willing to relocate";
  it("is met by living there or by saying so", () => {
    expect(evaluateRelocationRequirement(REQ, "Name\nDubai, UAE\nHead of Brand")?.status).toBe(
      "met",
    );
    expect(
      evaluateRelocationRequirement(REQ, "Name\nCairo, Egypt\nOpen to relocation")?.status,
    ).toBe("met");
    expect(evaluateRelocationRequirement(REQ, "Name\nCairo, Egypt\nHead of Brand")?.status).toBe(
      "unknown",
    );
  });
});

describe("dated employment in the formats CVs use", () => {
  it("reads 06/2013 to 04/2016, '2018 - Till 2022', 'Sept 2019 – Present' and 'till date'", () => {
    const text = [
      "WORK EXPERIENCE",
      "Marketing Lead 06/2013 to 04/2016",
      "Head of Marketing 2018 - Till 2022",
      "Director Sept 2019 – Present",
      "Consultant Jan 2023 - Till date",
    ].join("\n");
    expect(employmentIntervals(text, TODAY)).toHaveLength(4);
  });

  it("the word 'skills' in a sentence does not end the work history", () => {
    const text =
      "WORK EXPERIENCE Brand Manager built leadership skills across teams. Marketing Manager 2015 - 2019 EDUCATION BA 2010 - 2014";
    expect(employmentIntervals(text, TODAY)).toHaveLength(1);
  });
});

describe("the protected-attribute filter keeps the CV's structure", () => {
  it("keeps line breaks and the rest of a mixed line", () => {
    const out = removeProtectedSentences(
      "Name\nNationality: Indian | Dubai, UAE\nHead of Marketing\nJan 2015 - Present",
    );
    expect(out).toBe("Name\nDubai, UAE\nHead of Marketing\nJan 2015 - Present");
  });
});

describe("location in a contact block", () => {
  const REQ = "If outside the UAE must be willing to relocate";
  it("reads the place beside a phone, email or LinkedIn, and quotes only the place", () => {
    const cv =
      "EXECUTIVE PROFILE placeholder words to push the place further from the start of the text " +
      "+971 50 000 0000 | jane@example.com | Jane Doe | LinkedIn | Dubai, UAE E X E C U T I V E P R O F I L E Marketing leader.";
    const v = evaluateRelocationRequirement(REQ, cv);
    expect(v?.status).toBe("met");
    expect(v?.evidence[0]?.snippet).toBe("Dubai, UAE");
  });

  it("reads a 📍 pin", () => {
    const cv = "JANE DOE Insight • Activation 📍 Dubai, UAE 📞 +971 50 000 0000 ✉ jane@example.com";
    expect(evaluateRelocationRequirement(REQ, cv)?.evidence[0]?.snippet).toBe("Dubai, UAE");
  });

  it("does not read a past job in Dubai deep in the CV as a home address", () => {
    const cv = `Jane Doe | London, UK | +44 7000 000000 ${"Led campaigns across Europe. ".repeat(40)}Head of Brand, Dubai Mall 2012 - 2014`;
    expect(evaluateRelocationRequirement(REQ, cv)?.status).toBe("unknown");
  });
});

describe("work history under other headings", () => {
  it("reads roles listed under 'Career Overview:' in a one-line CV", () => {
    const text =
      "JANE DOE A results-oriented professional. Key skills: ▪ Team Leadership ▪ Lean management " +
      "Career Overview: Service Delivery Manager | Example Services, Northampton, UK November 2024 – Present ▪ Leading operations. " +
      "Operations Supervisor | Example Recycling, Milton Keynes, UK June 2023- September 2024 ▪ Led 75 staff. " +
      "Duty Manager, Example Centre, Loughborough, UK April 2022- May 2023 ▪ Supervised shifts. " +
      "Education MSc Management, Example University, UK";
    expect(employmentIntervals(text, TODAY)).toHaveLength(3);
  });
});

describe("second-review findings, 29 Oct", () => {
  it("a degree is read from its own words, not from the rest of a one-line CV", () => {
    for (const text of [
      "EDUCATION BSc Civil Engineering 2010 Leeds Metropolitan University CERTIFICATIONS Chartered Institute of Marketing Member, Digital Marketing Strategy",
      "EDUCATION Bachelor's Degree in Applied Mathematics 2011 Hassan II University | Google Ads certified, performance marketing",
    ]) {
      expect(evaluateDegreeRequirement(DEGREE, text)?.status, text).toBe("missing");
    }
    expect(
      evaluateDegreeRequirement(DEGREE, "EDUCATION Bachelors in Commerce M G University 2009 – 2012 EXPERIENCE")?.status,
    ).toBe("met");
  });

  it("a stated career length that the dated roles contradict is partial, not met", () => {
    const cv =
      "Marketing leader with 11+ years of experience in F&B marketing. WORK EXPERIENCE Marketing Director, Example Hospitality Jan 2026 – Present. " +
      "Manager – Marketing, Example Kitchens 2021 – 2025. EDUCATION Bachelors in Commerce 2009 – 2012";
    const v = evaluateYearsRequirement(TEN, cv, TODAY);
    expect(v?.status).toBe("partial");
    expect(v?.note).toMatch(/dated roles show/);
  });

  it("a stated career length with no dated roles to check is met but flagged", () => {
    const v = evaluateYearsRequirement(TEN, "Name\nVP Marketing with 20+ years of marketing experience across FMCG.", TODAY);
    expect(v?.status).toBe("met");
    expect(v?.needs_validation).toBe(true);
  });

  it("letter-spaced capitals are rebuilt so dates and titles count", () => {
    const cv =
      "Jane Doe Dubai, UAE W O R K E X P E R I E N C E A U G 2 0 2 3 P R E S E N T C L U S T E R D I R E C T O R O F M A R K E T I N G Example Hotels. " +
      "A U G 2 0 2 2 - A U G 2 0 2 3 D I R E C T O R O F M A R K E T I N G Example Resort. " +
      "J A N 2 0 1 0 - J U L 2 0 2 2 C L U S T E R M A R K E T I N G M A N A G E R Example Group. E D U C A T I O N";
    expect(normaliseLetterSpacing(cv)).toMatch(/AUG 2023 - PRESENT CLUSTER DIRECTOR OF MARKETING Example Hotels/);
    expect(employmentIntervals(cv, TODAY)).toHaveLength(3);
    expect(evaluateYearsRequirement(TEN, normaliseLetterSpacing(cv), TODAY)?.status).toBe("met");
    expect(normaliseLetterSpacing("An ordinary line, I A M fine.")).toBe("An ordinary line, I A M fine.");
  });
});
