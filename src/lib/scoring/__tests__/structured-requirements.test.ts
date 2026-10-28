/**
 * Recruiter-style rules (v1.6.0), on the requirement wording and CV shapes of
 * the Stratium Partners / Group Marketing Manager brief.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateDegreeRequirement,
  evaluateRelocationRequirement,
  evaluateStructuredRequirement,
  evaluateYearsRequirement,
  findDatedRanges,
} from "@/lib/scoring/structured-requirements";
import { scoreCandidate } from "@/lib/scoring-engine.server";

const DEGREE = "Bachelor's degree in Marketing, Business Administration or a related field";
const RELOCATE = "If outside the UAE, must be willing to relocate to Dubai";
const TEN_YEARS = "10 or more years of progressive marketing experience";
const FIVE_LEAD = "At least 5 years in a marketing leadership role";
const SENIOR = "Has been in a senior leadership role for at least 2-3 years";
const TODAY = new Date("2026-10-29T00:00:00Z");

const cv = (...ls: string[]) => ls.join("\n");

describe("degree field", () => {
  it("BBA in Marketing is met", () => {
    const v = evaluateDegreeRequirement(
      DEGREE,
      cv(
        "EDUCATION",
        "BBA in Marketing, minor in Mass Communication - American University of Sharjah",
      ),
    );
    expect(v?.status).toBe("met");
    expect(v?.evidence[0]?.snippet).toMatch(/BBA in Marketing/);
  });

  it("a related subject (Mass Communication, Commerce, English Communications) is met when the brief says 'related field'", () => {
    for (const line of [
      "Bachelor of Arts in Mass Communication, Cairo University",
      "Bachelor of Commerce (Accounting major, Business minor), Ain Shams University",
      "Bachelor's in English Communications",
      "B.Com (Financial Accounting & Audit), University of Mumbai",
    ]) {
      expect(evaluateDegreeRequirement(DEGREE, cv("Education", line))?.status, line).toBe("met");
    }
  });

  it("without 'related field', only the named field counts", () => {
    const v = evaluateDegreeRequirement(
      "Bachelor's degree in Marketing",
      cv("Bachelor of Commerce, Delhi University"),
    );
    expect(v?.status).toBe("missing");
  });

  it("a postgraduate qualification in the field is met, because it presupposes a first degree", () => {
    const amalie = evaluateDegreeRequirement(
      DEGREE,
      cv(
        "QUALIFICATIONS",
        "CIM Postgraduate Diploma in Marketing, Chartered Institute of Marketing",
      ),
    );
    expect(amalie?.status).toBe("met");
    expect(amalie?.needs_validation).toBe(false);

    const syed = evaluateDegreeRequirement(
      DEGREE,
      cv("B.Sc. Microbiology, University of Karachi", "MBA (Marketing), Preston University, 2004"),
    );
    expect(syed?.status).toBe("met");
    expect(syed?.evidence.map((e) => e.snippet).join(" ")).toMatch(/MBA \(Marketing\)/);
  });

  it("a clearly unrelated subject with nothing in the field is missing, with the degree quoted", () => {
    const v = evaluateDegreeRequirement(
      DEGREE,
      cv("BA (Hons) Ancient History, University College London"),
    );
    expect(v?.status).toBe("missing");
    expect(v?.evidence[0]?.snippet).toMatch(/Ancient History/);
    expect(
      evaluateDegreeRequirement(DEGREE, cv("BSc Applied Mathematics, Université Hassan II"))
        ?.status,
    ).toBe("missing");
  });

  it("a degree with no subject, or no degree at all, is a question, not a zero", () => {
    const general = evaluateDegreeRequirement(
      DEGREE,
      cv("Bachelor of Arts, University of Karachi"),
    );
    expect(general?.status).toBe("unknown");
    expect(general?.needs_validation).toBe(true);
    const none = evaluateDegreeRequirement(
      DEGREE,
      cv("EXPERIENCE", "Head of Marketing, Emaar Entertainment", "2014 - 2016"),
    );
    expect(none?.status).toBe("unknown");
  });

  it("a postgraduate outside the field still proves a degree; only the first degree's subject is open", () => {
    const v = evaluateDegreeRequirement(DEGREE, cv("MSc Data Science, University of Leeds"));
    expect(v?.status).toBe("unknown");
    expect(v?.note).toMatch(/first degree is held/);
  });

  it("does not claim experience requirements that mention a degree in passing", () => {
    expect(
      evaluateDegreeRequirement("5 years of marketing experience after a business degree", cv("x")),
    ).toBeNull();
  });
});

describe("conditional relocation", () => {
  it("a candidate already in Dubai meets it without saying 'relocate'", () => {
    const v = evaluateRelocationRequirement(
      RELOCATE,
      cv(
        "RADWA ABDEL MONEIM",
        "Dubai, United Arab Emirates | +971 50 000 0000",
        "Marketing & Communications Director",
      ),
    );
    expect(v?.status).toBe("met");
    expect(v?.needs_validation).toBe(false);
    expect(v?.evidence[0]?.snippet).toMatch(/Dubai/);
  });

  it("any emirate counts for 'outside the UAE'", () => {
    expect(evaluateRelocationRequirement(RELOCATE, cv("Name", "Location: Abu Dhabi"))?.status).toBe(
      "met",
    );
  });

  it("someone elsewhere who says they will relocate meets it", () => {
    const v = evaluateRelocationRequirement(
      RELOCATE,
      cv("Name", "Mumbai, India", "Open to relocation to the GCC"),
    );
    expect(v?.status).toBe("met");
  });

  it("someone elsewhere who says nothing is a question for screening, not a fail", () => {
    const v = evaluateRelocationRequirement(RELOCATE, cv("Name", "Mumbai, India", "Head of Brand"));
    expect(v?.status).toBe("unknown");
    expect(v?.needs_validation).toBe(true);
  });

  it("past work in Dubai deep in the CV is not read as where someone lives", () => {
    const body = cv(
      "Name",
      "London, United Kingdom",
      "Summary",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "Led campaigns for Dubai Mall tenants, 2012 - 2014",
    );
    expect(evaluateRelocationRequirement(RELOCATE, body)?.status).toBe("unknown");
  });

  it("an unconditional relocation requirement is left to the keyword matcher", () => {
    expect(evaluateRelocationRequirement("Willing to relocate to Riyadh", cv("x"))).toBeNull();
  });
});

describe("minimum years", () => {
  const radwa = cv(
    "EXPERIENCE",
    "Independent Marketing Consultant",
    "Nov 2025 - Present",
    "Director of Marketing & Communications, DMCC (Uptown Dubai, JLT)",
    "Jan 2021 - Nov 2025",
    "Head of Marketing, Al Habtoor City",
    "2016 - 2019",
    "Head of Marketing & Communications, Emaar Entertainment",
    "Mar 2014 - Jun 2016",
    "Marketing Executive, Jumeirah Group",
    "Sep 1998 - Feb 2004",
    "EDUCATION",
    "Bachelor of Arts in Mass Communication, 1994 - 1998",
  );

  it("counts dated roles up to today and ignores education dates", () => {
    const spans = findDatedRanges(radwa, TODAY);
    expect(spans.length).toBe(6);
    const v = evaluateYearsRequirement(TEN_YEARS, radwa, TODAY);
    expect(v?.status).toBe("met");
    expect(v?.note).toMatch(/years from dated roles/);
  });

  it("a past date is never treated as future-dated", () => {
    const v = evaluateYearsRequirement(
      "At least 1 year of marketing experience",
      cv("Brand Manager", "Jan 2024 - Jul 2025"),
      TODAY,
    );
    expect(v?.status).toBe("met");
  });

  it("leadership years count only leadership titles", () => {
    const v = evaluateYearsRequirement(FIVE_LEAD, radwa, TODAY);
    expect(v?.status).toBe("met");
    const junior = cv("Marketing Executive", "2012 - 2020", "Marketing Coordinator", "2008 - 2012");
    expect(evaluateYearsRequirement(FIVE_LEAD, junior, TODAY)?.status).toBe("unknown");
  });

  it("senior leadership reads the range '2-3 years' as at least 2", () => {
    const v = evaluateYearsRequirement(
      SENIOR,
      cv("Head of Brand, Majid Al Futtaim", "Jan 2024 - Present"),
      TODAY,
    );
    expect(v?.status).toBe("met");
  });

  it("short of the number is partial when close and missing when far, with the roles quoted", () => {
    const near = evaluateYearsRequirement(
      TEN_YEARS,
      cv("Marketing Manager", "Jan 2018 - Present"),
      TODAY,
    );
    expect(near?.status).toBe("partial");
    const far = evaluateYearsRequirement(
      TEN_YEARS,
      cv("Marketing Manager", "Jan 2021 - Present"),
      TODAY,
    );
    expect(far?.status).toBe("missing");
    expect(far?.evidence.length).toBeGreaterThan(0);
  });

  it("no dated roles is a question, not a zero", () => {
    const v = evaluateYearsRequirement(
      TEN_YEARS,
      cv("Experienced marketer with P&L responsibility"),
      TODAY,
    );
    expect(v?.status).toBe("unknown");
    expect(v?.needs_validation).toBe(true);
  });
});

describe("routing", () => {
  it("leaves ordinary requirements to the keyword matcher", () => {
    expect(evaluateStructuredRequirement("Arabic language skills", "Arabic, English")).toBeNull();
    expect(
      evaluateStructuredRequirement("Experience within retail, shopping malls or hospitality", "x"),
    ).toBeNull();
  });
});

describe("in the engine", () => {
  const requirements = [
    { id: "deg", text: DEGREE, required: true },
    { id: "loc", text: RELOCATE, required: true },
  ];
  const dubaiMasters = cv(
    "AMALIE WIJESINGHE",
    "Dubai, United Arab Emirates",
    "Group Marketing Director with eighteen years across mall and retail groups in the UAE, leading brand, loyalty and launch programmes.",
    "QUALIFICATIONS",
    "CIM Postgraduate Diploma in Marketing, Chartered Institute of Marketing",
    "EXPERIENCE",
    "Group Head of Marketing, Majid Al Futtaim Properties",
    "Jan 2016 - Present",
    "Marketing Manager, Al-Futtaim Group",
    "Mar 2008 - Dec 2015",
  );

  it("scores both rows met with the CV line attached and a rule note", () => {
    const result = scoreCandidate({
      cv_text: dubaiMasters,
      requirements: requirements as never,
      screening: [],
    });
    const deg = result.requirement_assessment.find((a) => a.id === "deg")!;
    const loc = result.requirement_assessment.find((a) => a.id === "loc")!;
    expect(deg.status).toBe("met");
    expect(loc.status).toBe("met");
    expect(deg.rule_note).toBeTruthy();
    expect(deg.evidence[0]?.snippet).toMatch(/Postgraduate Diploma in Marketing/);
    expect(result.engine_version).toBe("taasflow-scoring-v1.6.0");
  });
});
