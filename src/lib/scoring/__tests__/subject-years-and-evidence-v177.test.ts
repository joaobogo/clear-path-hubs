/**
 * v1.7.7 — recruiter research on the Billing Manager role (14 Nov 2026).
 *
 * B1. A years requirement counts the roles that show its subject. "5+ years
 *     of billing" is five years of billing; "2+ years managing a team" needs
 *     a team described. Every dated role used to count for both.
 * B2. Headings, objectives, addresses and club memberships are not evidence,
 *     and a requirement word inside an unrelated compound does not match.
 * B3. On-site attendance is the answer plus the home location.
 * B4. General accounting is shown by accounting work, whatever it is called.
 * B5. The parser fallback reads work history from the CV and never takes a
 *     street address as a headline.
 *
 * The fixtures are frozen CVs with the shape of the real ones, names and
 * employers replaced.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateOnsiteRequirement,
  evaluateYearsRequirement,
  roleBlocks,
} from "@/lib/scoring/structured-requirements";
import { scoreCandidate, type ScreeningAnswer } from "@/lib/scoring-engine.server";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";
import { parseYearsSubject } from "@/lib/scoring/years-subject";
import { maskNonQuotableLines } from "@/lib/scoring/non-evidence-lines";
import { judgeBehaviouralAnswer } from "@/lib/scoring/behavioural-answer";
import { isHeadlineLine, outlineCv } from "@/lib/cv/cv-outline";
import { heuristicStructure } from "@/lib/cv-hydration.server";
import { ACCOUNTANT_CV, AR_MANAGER_CV, PROMOTION_CHAIN_CV } from "./fixtures/billing-manager-v177";

const TODAY = new Date("2026-11-15T00:00:00Z");
const cv = (...ls: string[]) => ls.join("\n");

const BILLING_YEARS = "5+ years of billing experience";
const TEAM_YEARS = "2+ years managing a team";
const MECHANICS =
  "Command of billing mechanics: engagement terms, rate structures, discounts, adjustments (write-ups and write-downs) and invoice revisions";
const TIME_ENTRY =
  "Experience getting busy professionals to complete time entry and bill review on schedule";
const OFFICE = "Able to work from the Woodbridge, New Jersey office at least 3 days a week";
const ACCOUNTING = "General accounting knowledge";

const REQUIREMENTS = [
  { id: "req-0", text: BILLING_YEARS, required: true, keywords: [] },
  { id: "req-1", text: TEAM_YEARS, required: true, keywords: [] },
  { id: "req-2", text: MECHANICS, required: true, keywords: [] },
  { id: "req-4", text: TIME_ENTRY, required: true, keywords: [] },
  { id: "req-5", text: OFFICE, required: true, keywords: [] },
  { id: "pref-4", text: ACCOUNTING, required: false, keywords: [] },
];

const yesNo = (
  id: string,
  question: string,
  must_have: string,
  value: boolean,
  dealbreaker: boolean,
): ScreeningAnswer => ({
  question_id: id,
  question,
  required: true,
  answer_type: "boolean",
  value,
  disqualifying_condition: dealbreaker ? { operator: "equals", value: false } : null,
  must_have,
});
const office = (v: boolean) =>
  yesNo(
    "q-office",
    "Can you work from our office in Woodbridge, New Jersey at least 3 days a week?",
    OFFICE,
    v,
    true,
  );
const years = (v: boolean) =>
  yesNo("q-years", "Do you have at least 5 years of billing experience?", BILLING_YEARS, v, true);
const team = (v: boolean) =>
  yesNo("q-team", "Have you managed a team for at least 2 years?", TEAM_YEARS, v, false);
const timeEntry = (value: string): ScreeningAnswer => ({
  question_id: "q-time",
  question:
    "Attorneys and other busy professionals often put off time entry and bill review. Tell us about a time you got people to finish on schedule. What did you do?",
  required: false,
  answer_type: "long_text",
  value,
  disqualifying_condition: null,
  must_have: TIME_ENTRY,
});

const score = (cv_text: string, screening: ScreeningAnswer[], candidate_location: string | null) =>
  scoreCandidate({
    cv_text,
    requirements: REQUIREMENTS,
    screening,
    candidate_location,
    as_of: TODAY,
  });
const row = (r: ReturnType<typeof score>, id: string) =>
  r.requirement_assessment.find((a) => a.id === id)!;

describe("B1: years are counted for what the requirement asks", () => {
  it("reads the subject of a years requirement", () => {
    expect(parseYearsSubject(BILLING_YEARS)?.kind).toBe("terms");
    expect(parseYearsSubject(BILLING_YEARS)?.label).toBe("billing");
    expect(parseYearsSubject(TEAM_YEARS)?.kind).toBe("team");
    expect(parseYearsSubject("3 years of people management")?.kind).toBe("team");
    // No subject: every role counts, as before.
    expect(parseYearsSubject("5+ years of experience")).toBeNull();
    expect(parseYearsSubject("10 years of professional experience")).toBeNull();
  });

  it("an accountant with one billing job has that job's years of billing, not the whole career", () => {
    const v = evaluateYearsRequirement(BILLING_YEARS, ACCOUNTANT_CV, TODAY)!;
    expect(v.status).toBe("met");
    // Five years against five required: a recruiter confirms it.
    expect(v.needs_validation).toBe(true);
    expect(v.note).toBe(
      "5 yrs from: Bookkeeper / Medical Biller, The Riverside Cancer Center 2002–2007. Against 5 required; close to the minimum, confirm at screening.",
    );
    expect(v.evidence[0]!.snippet).toContain("Managed billing and accounts receivable");
  });

  it("a requirement with no subject still counts every dated role", () => {
    const v = evaluateYearsRequirement("5+ years of experience", ACCOUNTANT_CV, TODAY)!;
    expect(v.status).toBe("met");
    // The 28.8 years every subject used to be credited with.
    expect(v.note).toBe("28.8 years from dated roles on the CV, against 5 required.");
  });

  it("a manager title with no team described is partial, never met", () => {
    const v = evaluateYearsRequirement(TEAM_YEARS, ACCOUNTANT_CV, TODAY)!;
    expect(v.status).toBe("partial");
    expect(v.needs_validation).toBe(true);
    expect(v.note).toContain("from a title alone, with no team described");
  });

  it("a no to the team question makes it not met", () => {
    const r = score(
      ACCOUNTANT_CV,
      [office(true), years(true), team(false)],
      "Scotch Plains, NJ, USA",
    );
    const a = row(r, "req-1");
    expect(a.status).toBe("missing");
    expect(a.rule_note).toContain(
      'The candidate answered no to "Have you managed a team for at least 2 years?".',
    );
    expect(a.evidence).toEqual([]);
    // Billing stays at the one role's five years.
    expect(row(r, "req-0").status).toBe("met");
    expect(row(r, "req-0").needs_validation).toBe(true);
  });

  it("a no to the years question keeps a described history partial for the recruiter", () => {
    // The recruiter lifted the dealbreaker; the answer still stands.
    const r = scoreCandidate({
      cv_text: PROMOTION_CHAIN_CV,
      requirements: REQUIREMENTS,
      screening: [office(true), years(false), team(true)],
      candidate_location: "Essex County, New Jersey, United States",
      eligibility_checks: [{ qualifier_key: "recruiter_review:q-years", status: "excepted" }],
      as_of: TODAY,
    });
    const a = row(r, "req-0");
    expect(a.status).toBe("partial");
    expect(a.needs_validation).toBe(true);
    expect(a.rule_note).toContain("The CV describes it; confirm at screening.");
  });

  it("managing people counts; managing accounts for a team does not", () => {
    const v = evaluateYearsRequirement(TEAM_YEARS, AR_MANAGER_CV, TODAY)!;
    // 1.8 described years (three employees, two collectors) against 2.
    expect(v.status).toBe("partial");
    expect(v.note).toContain("1.8 yrs with managing a team described");
    expect(v.note).not.toContain("Hartwell");
    // The candidate's yes then carries it, flagged for the recruiter.
    const r = score(
      AR_MANAGER_CV,
      [office(true), years(true), team(true)],
      "South Plainfield, NJ, United States",
    );
    expect(row(r, "req-1").status).toBe("met");
    expect(row(r, "req-1").needs_validation).toBe(true);
  });

  it("overlapping roles are counted once", () => {
    const OVERLAP = cv(
      "Experience",
      "Billing Lead, Acme | Jan 2020 - Dec 2022",
      "• Ran monthly billing for 40 clients.",
      "Billing Consultant, Bolt | Jan 2021 - Dec 2023",
      "• Prepared invoices and billing reports.",
    );
    const v = evaluateYearsRequirement(BILLING_YEARS, OVERLAP, TODAY)!;
    // Jan 2020 to Dec 2023 is four years, not three plus three.
    expect(v.status).toBe("partial");
    expect(v.note).toContain("4 yrs with billing described");
  });

  it("a year-only range runs mid-year to mid-year", () => {
    const v = evaluateYearsRequirement(
      BILLING_YEARS,
      cv(
        "Experience",
        "Medical Biller",
        "Riverside Center | 2002 – 2007",
        "• Managed billing under Medicare.",
      ),
      TODAY,
    )!;
    expect(v.note).toContain("5 yrs from: Medical Biller, Riverside Center 2002–2007.");
  });

  it("a promotion chain under a role is that role, and its bullets describe the whole period", () => {
    const blocks = roleBlocks(PROMOTION_CHAIN_CV, TODAY);
    const firm = blocks.find((b) => b.header.includes("Financial Planning Analyst May 2016"))!;
    expect(firm.header).toContain("Billing Analyst (May 2016 – Sep 2017)");
    expect(firm.body).toContain("supervised a team of 3 billing assistants");
    // No separate six-month role for the last step of the chain.
    expect(blocks.some((b) => b.span.raw === "Jul 2018 – Dec 2018")).toBe(false);
    const v = evaluateYearsRequirement(TEAM_YEARS, PROMOTION_CHAIN_CV, TODAY)!;
    expect(v.status).toBe("met");
    expect(v.note).toContain("2.7 yrs from: Billing, Collections & Financial Planning Analyst");
  });

  it("the last role does not own the education and skills listed under it", () => {
    const TAIL = cv(
      "Experience",
      "Office Clerk, Acme | Jan 2015 - Dec 2022",
      "• Filed paperwork and answered phones.",
      "EDUCATION",
      "Certificate in Medical Billing, 2014",
      "SKILLS",
      "Billing, invoicing, team management of 5 staff",
    );
    expect(evaluateYearsRequirement(BILLING_YEARS, TAIL, TODAY)!.status).toBe("missing");
    expect(evaluateYearsRequirement(TEAM_YEARS, TAIL, TODAY)!.status).toBe("missing");
    expect(evaluateYearsRequirement(BILLING_YEARS, TAIL, TODAY)!.note).toBe(
      "The one dated role on the CV does not show billing, against 5 years required.",
    );
  });

  it("issuing invoices is billing; processing vendor invoices is not", () => {
    const v = evaluateYearsRequirement(BILLING_YEARS, PROMOTION_CHAIN_CV, TODAY)!;
    expect(v.note).toContain("Administrative Analyst");
    expect(v.note).not.toContain("Logistics Financial Specialist");
  });
});

describe("B2: lines that are not evidence", () => {
  it("masks headings, objectives, addresses and club memberships at the same length", () => {
    const masked = maskNonQuotableLines(AR_MANAGER_CV);
    expect(masked.length).toBe(AR_MANAGER_CV.length);
    expect(masked).not.toContain("PROFESSIONAL EXPERIENCE");
    expect(masked).not.toContain("To obtain an AR and Billing management position");
    expect(masked).not.toContain("245 Golf Avenue E");
    expect(masked).not.toContain("Employee Engagement groups");
    // What the person did is still there.
    expect(masked).toContain("Handle all billing issues");
  });

  it('"Employee Engagement groups" is not evidence of engagement terms', () => {
    const r = score(
      AR_MANAGER_CV,
      [office(true), years(true), team(true)],
      "South Plainfield, NJ, United States",
    );
    const a = row(r, "req-2");
    expect(a.matched_terms).not.toContain("engagement");
    expect(a.evidence.some((e) => /Employee Engagement/i.test(e.snippet))).toBe(false);
  });

  it('"busy professionals" does not match the heading "PROFESSIONAL EXPERIENCE"', () => {
    const r = score(
      ACCOUNTANT_CV,
      [office(true), years(true), team(false)],
      "Scotch Plains, NJ, USA",
    );
    const a = row(r, "req-4");
    expect(a.status).toBe("missing");
    expect(a.matched_terms).toEqual([]);
  });
});

describe("B3: on-site attendance is the answer plus where the person lives", () => {
  it("home in the office's state is met, quoting the location it was read from", () => {
    const v = evaluateOnsiteRequirement(
      OFFICE,
      ACCOUNTANT_CV,
      "scotch plains, NJ, USA, scotch plains, USA",
    )!;
    expect(v.rule).toBe("onsite_attendance");
    expect(v.status).toBe("met");
    expect(v.evidence[0]!.snippet).toBe("Profile location: scotch plains, NJ, USA");
    // A profile with no state leaves it to the CV's contact line.
    const fromCv = evaluateOnsiteRequirement(OFFICE, ACCOUNTANT_CV, "Newark, US")!;
    expect(fromCv.status).toBe("met");
    expect(fromCv.evidence[0]!.snippet).toContain("Scotch Plains, NJ");
  });

  it("a home in another state, or none stated, needs validation", () => {
    const other = evaluateOnsiteRequirement(
      OFFICE,
      "Dana Mills\nSenior Accountant",
      "Philadelphia, PA",
    )!;
    expect(other.status).toBe("unknown");
    expect(other.needs_validation).toBe(true);
    expect(other.note).toBe(
      "Home is in Pennsylvania; the office is in New Jersey. Confirm the commute at screening.",
    );
    const none = evaluateOnsiteRequirement(OFFICE, "Dana Mills\nSenior Accountant", null)!;
    expect(none.needs_validation).toBe(true);
  });

  it("yes with a New Jersey home is met; yes from another state is partial for the recruiter", () => {
    const nj = score(
      AR_MANAGER_CV,
      [office(true), years(true), team(true)],
      "South Plainfield, NJ, United States",
    );
    expect(row(nj, "req-5").status).toBe("met");
    expect(row(nj, "req-5").needs_validation).toBe(false);
    // The CV's own contact block says New Jersey, so the profile decides here.
    const pa = score(AR_MANAGER_CV, [office(true), years(true), team(true)], "Philadelphia, PA");
    expect(row(pa, "req-5").status).toBe("partial");
    expect(row(pa, "req-5").needs_validation).toBe(true);
    expect(pa.score).toBeLessThan(nj.score);
  });

  it("is not read as a keyword requirement: Microsoft Office and New York are not evidence", () => {
    const r = scoreCandidate({
      cv_text: cv(
        "Sam Poe",
        "Experience",
        "Clerk, Acme, New York | Jan 2020 - Present",
        "• Microsoft Office, 3 days of training a week.",
      ),
      requirements: [{ id: "req-5", text: OFFICE, required: true, keywords: [] }],
      screening: [],
      as_of: TODAY,
    });
    expect(r.requirement_assessment[0]!.matched_terms).toEqual(["rule:onsite_attendance"]);
    expect(r.requirement_assessment[0]!.status).not.toBe("met");
  });
});

describe("B4: general accounting is shown by accounting work", () => {
  it("account reconciliations and applying payments show it without the word", () => {
    const r = score(
      AR_MANAGER_CV,
      [office(true), years(true), team(true)],
      "South Plainfield, NJ, United States",
    );
    expect(row(r, "pref-4").status).toBe("met");
    expect(row(r, "pref-4").evidence[0]!.snippet).toContain("account reconciliations");
  });
});

describe("a written screening answer is evidence for its requirement", () => {
  const CONCRETE =
    "My provider count doubled from 106 to 208. I worked with our vendor to automate a tasking feature that routed unsigned charts back to the providers automatically. It decreased our missing slips by 50% in 2 days.";
  const GENERAL = "I would send reminders and make sure everyone knows the deadline.";

  it("tells an occasion from an approach", () => {
    expect(judgeBehaviouralAnswer(CONCRETE)).toBe("concrete");
    expect(judgeBehaviouralAnswer(GENERAL)).toBe("general");
    expect(judgeBehaviouralAnswer("N/A")).toBe("none");
  });

  it("what the candidate did meets the requirement; an approach is partial", () => {
    const base = [office(true), years(true), team(true)];
    const home = "Essex County, New Jersey, United States";
    const none = score(PROMOTION_CHAIN_CV, base, home);
    const concrete = score(PROMOTION_CHAIN_CV, [...base, timeEntry(CONCRETE)], home);
    const general = score(PROMOTION_CHAIN_CV, [...base, timeEntry(GENERAL)], home);
    expect(row(none, "req-4").status).toBe("missing");
    expect(row(concrete, "req-4").status).toBe("met");
    expect(row(concrete, "req-4").evidence[0]!.source).toBe("screening");
    expect(row(general, "req-4").status).toBe("partial");
    expect(row(general, "req-4").needs_validation).toBe(true);
    expect(concrete.score).toBeGreaterThan(general.score);
    expect(general.score).toBeGreaterThan(none.score);
  });
});

describe("B5: the parser fallback reads the CV's own structure", () => {
  it("never takes a street address, a city line or a contact line as a headline", () => {
    for (const line of [
      "245 Golf Avenue E",
      "13 Jade Meadow Drive, Springfield, NJ 07081",
      "South Plainfield, NJ 07080",
      "Mobile 555-829-0929",
      "E-Mail: jordan.hale@example.com",
      "PROFESSIONAL EXPERIENCE",
    ]) {
      expect(isHeadlineLine(line), line).toBe(false);
    }
    expect(isHeadlineLine("AR and Billing Manager")).toBe(true);
  });

  it("a CV that opens with an address takes the most recent job title as its headline", () => {
    const o = outlineCv(AR_MANAGER_CV, TODAY);
    expect(o.full_name).toBe("Jordan T. Hale");
    expect(o.headline).toBe("Accounts Receivable Manager");
    expect(o.experience.map((r) => `${r.title} @ ${r.company}`)).toEqual([
      "Accounts Receivable Manager @ Brightline Marketing, Inc",
      "Accounts Receivable & Billing Manager @ Nook Inc",
      "Collections Manager @ Wander Inc",
      "Senior Collections Analyst @ Hartwell Financial Services",
      "Billing & Collections Manager @ Olive Foods USA, LLC",
    ]);
    expect(o.experience[0]).toMatchObject({ start: "July 2024", end: "Present" });
  });

  it("reads a name in capitals, the headline under it, the roles and the degree", () => {
    const o = outlineCv(ACCOUNTANT_CV, TODAY);
    expect(o.full_name).toBe("Dana R. Mills");
    expect(o.headline).toBe("Senior Accountant");
    expect(o.experience).toHaveLength(5);
    expect(o.experience[3]).toMatchObject({
      title: "Bookkeeper / Medical Biller",
      company: "The Riverside Cancer Center",
      start: "2002",
      end: "2007",
    });
    expect(o.education).toEqual([
      {
        school: "Western State University",
        degree: "Bachelor of Science",
        field: "Accounting",
        year: "2026",
      },
    ]);
    expect(o.summary).toContain("Senior Accountant with 20+ years of experience");
  });

  it("a wrapped contact line is not a headline, and a section heading is not a job", () => {
    const o = outlineCv(PROMOTION_CHAIN_CV, TODAY);
    expect(o.full_name).toBe("Morgan Lee");
    expect(o.headline).toBe("Logistics Financial Specialist");
    expect(o.experience.map((r) => r.title)).toEqual([
      "Logistics Financial Specialist",
      "Billing, Collections & Financial Planning Analyst",
      "Administrative Analyst",
    ]);
  });

  it("the fallback fills work history, education and the current role", () => {
    const h = heuristicStructure(AR_MANAGER_CV);
    expect(h.full_name?.value).toBe("Jordan T. Hale");
    expect(h.headline?.value).toBe("Accounts Receivable Manager");
    expect(h.current_role?.value).toBe("Accounts Receivable Manager");
    expect((h.experience?.value as unknown[]).length).toBe(5);
    expect(h.employers?.value).toContain("Nook Inc");
    const a = heuristicStructure(ACCOUNTANT_CV);
    expect(a.full_name?.value).toBe("Dana R. Mills");
    expect((a.education?.value as unknown[]).length).toBe(1);
  });
});

describe("frozen CVs: the direction each one moves", () => {
  // Under v1.7.6 the accountant read as 28 years of billing and of managing a
  // team; the AR manager had no accounting and an address for a headline; the
  // written answer about time entry was not read at all.
  it("the accountant who said no to managing a team scores below the two billing managers", () => {
    const accountant = score(
      ACCOUNTANT_CV,
      [office(true), years(true), team(false)],
      "Scotch Plains, NJ, USA",
    );
    const manager = score(
      AR_MANAGER_CV,
      [office(true), years(true), team(true)],
      "South Plainfield, NJ, United States",
    );
    const withAnswer = score(
      PROMOTION_CHAIN_CV,
      [
        office(true),
        years(true),
        team(true),
        timeEntry(
          "My provider count doubled from 106 to 208. I worked with our vendor to automate a tasking feature that routed unsigned charts back to the providers automatically. It decreased our missing slips by 50% in 2 days.",
        ),
      ],
      "Essex County, New Jersey, United States",
    );
    expect(row(accountant, "req-1").status).toBe("missing");
    expect(row(manager, "pref-4").status).toBe("met");
    expect(row(withAnswer, "req-4").status).toBe("met");
    expect(accountant.score).toBeLessThan(manager.score);
    expect(accountant.score).toBeLessThan(withAnswer.score);
    expect(accountant.engine_version).toBe(ENGINE_VERSION);
    expect(ENGINE_VERSION).toMatch(/^taasflow-scoring-v1\.\d+\.\d+$/);
  });
});
