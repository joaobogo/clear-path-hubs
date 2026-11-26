/**
 * v1.8.0 — scoring fix spec of 26 Nov 2026, Fixes 4 and 5.
 *
 * Fix 5: the same facts in different words score the same, and the wording
 * table never turns adjacent experience into the real thing.
 * Fix 4: the profile text a person wrote is read beside the CV, labelled by
 * who wrote it; a recruiter's dates win over the CV's; every evidence item
 * says where it was read.
 */
import { describe, it, expect } from "vitest";
import {
  computeInputHash,
  isContrastedMention,
  scoreCandidate,
  type RequirementInput,
  type ScreeningAnswer,
} from "@/lib/scoring-engine.server";
import { ENGINE_VERSION } from "../engine-version";
import {
  COMMUTABLE_PLACES,
  EQUIVALENCE_CONCEPTS,
  commutablePlaceIn,
  equivalentForms,
  homeWithinCommute,
  isEquivalenceWording,
  isTitleWordOnly,
} from "../wording-equivalence";
import {
  buildProfileText,
  profileFieldOrigin,
  profileSections,
  stampRecruiterEdit,
} from "../profile-text";
import { buildReplaySnapshot, ReplaySnapshotSchema } from "../replay";
import { profileDateCorrections } from "../structured-requirements";
import { SCREENING_BY_RECRUITER_NOTE, buildExplanation } from "@/lib/scoring-service.server";
import { offlineRescore, profileFingerprintText } from "../offline-rescore";
import { normaliseSource } from "@/lib/client-rationale";
import { humanizeSource } from "@/lib/evidence/quote-hygiene";
import { sourcePhrase } from "@/lib/client/score-breakdown";
import {
  ENTERPRISE_SALES_CV_ORIGINAL as ORIGINAL,
  ENTERPRISE_SALES_CV_REWORDED as REWORDED,
  ENTERPRISE_SALES_MUST_HAVES as MUST,
  ENTERPRISE_SALES_NICE_TO_HAVES as NICE,
  ENTERPRISE_SALES_REQUIREMENTS as REQUIREMENTS,
} from "./fixtures/enterprise-sales-wording-v180";

const AS_OF = new Date("2026-11-26T12:00:00Z");
const one = (text: string, required = true): RequirementInput[] => [
  { id: "r", text, required, keywords: [] },
];
const statusOf = (
  cv: string,
  requirement: string,
  extra: Partial<Parameters<typeof scoreCandidate>[0]> = {},
) =>
  scoreCandidate({ cv_text: cv, requirements: one(requirement), screening: [], as_of: AS_OF, ...extra })
    .requirement_assessment[0]!;
const yes = (
  id: string,
  question: string,
  must_have: string,
  answered_by?: "candidate" | "recruiter_on_behalf",
): ScreeningAnswer => ({
  question_id: id,
  question,
  required: true,
  answer_type: "boolean",
  value: true,
  disqualifying_condition: { operator: "equals", value: false },
  must_have,
  ...(answered_by ? { answered_by } : {}),
});
const filler = [
  "Worked across product squads shipping customer facing features on a weekly cadence.",
  "Owned reliability targets, wrote architecture decision records, ran incident reviews,",
  "mentored junior colleagues, improved onboarding documentation, tracked delivery metrics,",
  "partnered with design and support, presented quarterly roadmaps to leadership, and",
  "drove hiring loops for the team across four consecutive quarters of headcount growth.",
].join(" ");

// ---------------------------------------------------------------------------
// Fix 5: wording
// ---------------------------------------------------------------------------

describe("v1.8.0 — two CVs with the same facts in different words score the same", () => {
  const score = (cv: string, extra: Partial<Parameters<typeof scoreCandidate>[0]> = {}) =>
    scoreCandidate({ cv_text: cv, requirements: REQUIREMENTS, screening: [], as_of: AS_OF, ...extra });

  it("the wording pair is within 2 points, row for row", () => {
    const a = score(ORIGINAL);
    const b = score(REWORDED);
    expect(Math.abs(a.score - b.score)).toBeLessThanOrEqual(2);
    expect(b.requirement_assessment.map((r) => `${r.id}:${r.status}`)).toEqual(
      a.requirement_assessment.map((r) => `${r.id}:${r.status}`),
    );
  });

  it("and stays within 2 points with the profile location and the screening answers", () => {
    const screening: ScreeningAnswer[] = [
      yes("q-deal", "Have you personally sourced and closed a new-logo enterprise deal worth $2M or more?", MUST[1]),
      yes("q-london", "Are you based in or within commuting distance of London, and able to travel up to 50%?", MUST[5]),
    ];
    const extra = { candidate_location: "Hertfordshire, United Kingdom", screening };
    const a = score(ORIGINAL, extra);
    const b = score(REWORDED, extra);
    expect(Math.abs(a.score - b.score)).toBeLessThanOrEqual(2);
    expect(b.requirement_assessment.map((r) => r.status)).toEqual(a.requirement_assessment.map((r) => r.status));
  });

  it("reads each of the four wordings the role asked for", () => {
    for (const cv of [ORIGINAL, REWORDED]) {
      // new-logo (hunting) = new-logo acquisition = net-new customer acquisition
      expect(statusOf(cv, MUST[0]).status).toBe("met");
      // total contract value = ACV = annual contract value
      expect(statusOf(cv, MUST[1]).status).toBe("met");
      // met or exceeded bookings targets = % of quota = sales target, over-achieved
      expect(statusOf(cv, MUST[2]).status).toBe("met");
      // formal qualification method = MEDDPICC = MEDDICC
      expect(statusOf(cv, NICE[3], { requirements: one(NICE[3], false) }).status).toBe("met");
    }
  });
});

describe("v1.8.0 — the wording table applies where the requirement uses the phrase, and only there", () => {
  it("gives a keyword its other wordings inside the phrase", () => {
    expect(equivalentForms("closed deals of $2M+ in total contract value", "value")).toContain("acv");
    expect(equivalentForms("new-logo enterprise sales (hunting)", "hunting")).toContain("net-new");
    expect(equivalentForms("met or exceeded new-business bookings targets", "bookings")).toContain("quota");
    expect(equivalentForms("Uses a formal qualification method (MEDDPICC)", "method")).toContain("meddic");
  });

  it("gives it nothing where the word means something else", () => {
    expect(equivalentForms("Adds value to the team", "value")).toEqual([]);
    expect(equivalentForms("Met the deadline for every release", "met")).toEqual([]);
    expect(isEquivalenceWording("Head chef in a hotel kitchen", "head")).toBe(false);
    expect(isTitleWordOnly("Head chef in a hotel kitchen", "head")).toBe(false);
  });

  it("titles are interchangeable as buyers of technology, not everywhere a title appears", () => {
    expect(equivalentForms("Senior technology buyers (CIO, CTO)", "cto")).toContain("cio");
    expect(equivalentForms("Reports to the CTO and owns the platform roadmap", "cto")).toEqual([]);
    expect(isTitleWordOnly("Previous experience as Head of Data at a retailer", "head")).toBe(false);
    expect(isEquivalenceWording("Previous experience as Head of Data at a retailer", "head")).toBe(false);
  });

  it("is read through a line break in the CV", () => {
    const cv = `Enterprise seller. Closed enterprise deals with large banks, quoted as annual contract\nvalue on three-year terms. ${filler}`;
    const row = statusOf(cv, "Has personally closed enterprise deals of $2M+ in total contract value");
    expect(row.matched_terms).toEqual(expect.arrayContaining(["total", "contract", "value"]));
  });

  it("never lists adjacent experience as the thing itself", () => {
    const named = ["snowflake", "databricks", "bigquery", "teradata", "netezza", "hadoop", "oracle"];
    for (const c of EQUIVALENCE_CONCEPTS) {
      for (const form of c.also_match) {
        expect(named.some((n) => form.includes(n))).toBe(false);
        expect(form).not.toMatch(/migration|moderni[sz]ation/);
      }
    }
  });

  it("selling cloud migration is not Snowflake or Databricks experience", () => {
    const cv = `Sales Director selling hybrid-cloud migration, observability and data protection software to enterprise IT teams across EMEA. Won British Airways and TUI as new logos. ${filler}`;
    expect(statusOf(cv, MUST[3]).status).toBe("missing");
    expect(statusOf(cv, NICE[0], { requirements: one(NICE[0], false) }).status).toBe("missing");
    // The applicant's own CV: cloud and IT operations, no data platform named.
    expect(statusOf(ORIGINAL, MUST[3]).status).toBe("missing");
    expect(statusOf(REWORDED, MUST[3]).status).toBe("missing");
  });

  it("a thing a sentence sets aside is not evidence of it", () => {
    const text = "His background is cloud infrastructure and IT operations rather than data analytics platforms such as Snowflake or Databricks.";
    expect(isContrastedMention(text, text.indexOf("Snowflake"))).toBe(true);
    expect(isContrastedMention(text, text.indexOf("Databricks"))).toBe(true);
    expect(isContrastedMention(text, text.indexOf("cloud infrastructure"))).toBe(false);
    // The next bullet is another sentence.
    const bullets = "• Built on Azure rather than AWS\n• Ran Kubernetes in production";
    expect(isContrastedMention(bullets, bullets.indexOf("AWS"))).toBe(true);
    expect(isContrastedMention(bullets, bullets.indexOf("Kubernetes"))).toBe(false);

    const cv = `Platform engineer. ${text} ${filler}`;
    const row = statusOf(cv, "Hands-on with Snowflake");
    expect(row.status).toBe("missing");
    expect(row.matched_terms).not.toContain("snowflake");
  });
});

describe("v1.8.0 — a title in a requirement is wording, not a product the CV must name", () => {
  const buyers = MUST[4];

  it("does not hard-miss the row for a CV that never writes the word Head", () => {
    const cv = `Regional Client Director. Senior relationships across UK enterprises in banking and insurance; built a network of technology and data leaders through executive events. ${filler}`;
    const row = statusOf(cv, buyers);
    expect(row.status).toBe("partial");
    expect(row.matched_terms).toEqual(expect.arrayContaining(["network", "senior", "uk", "enterprises"]));
  });

  it("reads the title words as the title: the candidate's own 'Head of Sales' is not a buyer", () => {
    expect(isTitleWordOnly(buyers, "head")).toBe(true);
    const own = statusOf(`Head of EMEA Sales at a software vendor. ${filler}`, buyers);
    expect(own.matched_terms).not.toContain("head");
    const sold = statusOf(
      `Sold to the CIO and the Head of Infrastructure at UK enterprises; senior technology buyers in banking. Built a network of data leaders. ${filler}`,
      buyers,
    );
    expect(sold.matched_terms).toEqual(expect.arrayContaining(["cio", "head"]));
    expect(sold.status).toBe("met");
  });
});

describe("v1.8.0 — based in or commutable to London is the home, never the territory", () => {
  const london = MUST[5];
  const place = COMMUTABLE_PLACES.find((p) => p.place === "London")!;
  const territory = `Sales Director, UK & Ireland. Ran the EMEA region and the UK & Ireland territory for six years, travelling weekly. ${filler}`;

  it("names London as a commutable place", () => {
    expect(commutablePlaceIn(london)?.place).toBe("London");
    expect(commutablePlaceIn("Based in Manchester")).toBeNull();
  });

  it("reads London, a borough or a Home County as home", () => {
    for (const home of [
      "Sutton, United Kingdom",
      "Hertfordshire, UK • +44 7700 900123",
      "Greater London, UK | +44 7700 900123 | name@example.com",
      "London",
      "Surrey, England",
      "South London, UK",
    ]) {
      expect(homeWithinCommute(place, home), home).not.toBeNull();
    }
  });

  it("does not read a territory, a namesake abroad or a first name as home", () => {
    for (const home of [
      "United Kingdom",
      "UK & Ireland",
      "EMEA",
      "Manchester, UK",
      "Richmond, Virginia",
      "Kent, Washington, USA",
      "Essex County, New Jersey",
      "Kent Johnson, Manchester, UK",
      "Brent Cross Shopping Centre, UK",
    ]) {
      expect(homeWithinCommute(place, home), home).toBeNull();
    }
  });

  it("'UK & Ireland' or 'EMEA' alone does not prove London", () => {
    const row = statusOf(territory, london, { candidate_location: "United Kingdom" });
    expect(row.matched_terms).toEqual(["rule:home_location"]);
    expect(row.status).toBe("unknown");
    expect(row.evidence).toEqual([]);
    // The candidate's yes is then weak evidence: partial, to confirm.
    const answered = statusOf(territory, london, {
      candidate_location: "United Kingdom",
      screening: [yes("q", "Are you based in or within commuting distance of London, and able to travel up to 50%?", london)],
    });
    expect(answered.status).toBe("partial");
    expect(answered.needs_validation).toBe(true);
  });

  it("a home in the belt shows half of 'and able to travel'; the candidate's yes makes it met", () => {
    const alone = statusOf(territory, london, { candidate_location: "Sutton, United Kingdom" });
    expect(alone.status).toBe("partial");
    expect(alone.evidence[0]).toMatchObject({ source: "profile", snippet: "Profile location: Sutton, United Kingdom" });
    const answered = statusOf(territory, london, {
      candidate_location: "Sutton, United Kingdom",
      screening: [yes("q", "Are you based in or within commuting distance of London, and able to travel up to 50%?", london)],
    });
    expect(answered.status).toBe("met");
    expect(answered.needs_validation).toBe(false);
    expect(answered.evidence.map((e) => e.source)).toEqual(["profile", "screening_candidate"]);
  });

  it("a requirement that asks only for the home is met by it, read from the CV's own header", () => {
    const row = statusOf(ORIGINAL, "Based in or commutable to London");
    expect(row.status).toBe("met");
    expect(row.evidence[0]!.source).toBe("cv");
    expect(row.evidence[0]!.snippet).toContain("Hertfordshire");
  });

  it("leaves a requirement that willingness to relocate also satisfies to the rules it had", () => {
    const relocation = statusOf(territory, "Must be based in London or willing to relocate", {
      candidate_location: "Leeds, UK",
    });
    expect(relocation.matched_terms).toEqual(["rule:conditional_relocation"]);
    const worded = statusOf(territory, "Based in London, or open to relocation", { candidate_location: "Leeds, UK" });
    expect(worded.matched_terms).not.toContain("rule:home_location");
  });
});

// ---------------------------------------------------------------------------
// Fix 4: the profile
// ---------------------------------------------------------------------------

const RECRUITER = { user_id: "00000000-0000-4000-8000-000000000001", at: "2026-11-26T15:54:00Z" };
const parsed = (fields: string[]) => ({
  provenance: Object.fromEntries(fields.map((f) => [f, { source: "cv_parsed", parser: "llm" }])),
});

describe("v1.8.0 — the profile block holds what a person wrote, and nothing the CV already says", () => {
  const cv = "Jane Doe\nSales Manager\nPROFESSIONAL EXPERIENCE\nAcme | Sales Manager Jan 2015 – Dec 2020\n• Won enterprise accounts in retail.\n• Led a team of four.";

  it("leaves out the parser's copy of the CV and fields with no record of who wrote them", () => {
    const profile = {
      headline: "Sales Manager",
      summary: "Won enterprise accounts in retail. Closed new-logo deals at two airlines.",
      experience: [{ title: "Sales Manager", company: "Acme", start: "Jan 2015", end: "Dec 2020", summary: "Led a team of four." }],
    };
    expect(buildProfileText({ ...profile, consent: parsed(["headline", "summary", "experience"]) }, cv)).toBe("");
    expect(buildProfileText({ ...profile, consent: {} }, cv)).toBe("");
    expect(buildProfileText({ ...profile, consent: { provenance: { summary: { source: "legacy" } } } }, cv)).toBe("");
    expect(buildProfileText(null, cv)).toBe("");
  });

  it("keeps a recruiter's sentences that are new, labelled (R), and drops the ones the CV has", () => {
    const consent = stampRecruiterEdit(parsed(["headline", "experience"]), ["summary"], RECRUITER);
    expect(profileFieldOrigin(consent, "summary")).toBe("recruiter");
    expect(profileFieldOrigin(consent, "experience")).toBeNull();
    const block = buildProfileText(
      { summary: "Won enterprise accounts in retail. Closed new-logo deals at two airlines.", consent },
      cv,
    );
    expect(block).toBe("PROFILE SUMMARY (R)\nClosed new-logo deals at two airlines.");
    expect(profileSections(block)).toMatchObject([{ field: "summary", origin: "recruiter" }]);
  });

  it("labels the candidate's own text (C), never recruiter-edited", () => {
    const consent = { provenance: { summary: { source: "candidate_provided" }, experience: { source: "user_confirmed" } } };
    const block = buildProfileText(
      {
        summary: "Closed new-logo deals at two airlines.",
        experience: [
          { title: "Sales Manager", company: "Acme", start: "Jan 2015", end: "Dec 2020", summary: "Led a team of four." },
          { title: "Account Executive", company: "Globex", start: "Mar 2012", end: "Dec 2014", summary: "Sold payroll software to mid-market firms." },
        ],
        consent,
      },
      cv,
    );
    expect(block.split("\n")).toEqual([
      "PROFILE SUMMARY (C)",
      "Closed new-logo deals at two airlines.",
      "PROFILE EXPERIENCE (C)",
      // Acme adds no sentence beside the CV: it is the CV again and is left out.
      "Account Executive | Globex Mar 2012 – Dec 2014",
      "• Sold payroll software to mid-market firms.",
    ]);
    expect(profileSections(block).map((s) => s.origin)).toEqual(["candidate", "candidate"]);
  });

  it("keeps a recruiter's dated entries even where the wording repeats the CV: the dates are the correction", () => {
    const consent = stampRecruiterEdit({}, ["experience"], RECRUITER);
    const block = buildProfileText(
      { experience: [{ title: "Sales Manager", company: "Acme", start: "Mar 2016", end: "Dec 2020", summary: "Led a team of four." }], consent },
      cv,
    );
    expect(block).toBe("PROFILE EXPERIENCE (R)\nSales Manager | Acme Mar 2016 – Dec 2020");
  });
});

describe("v1.8.0 — a profile fact the CV implies moves the requirement, and removing it moves it back", () => {
  // The applicant's CV without the two lines that say "new-logo".
  const cv = ORIGINAL.replace("new-logo acquisition, ", "").replace("New Logo Acquisition • ", "");
  const requirement = MUST[0];
  const consent = stampRecruiterEdit({}, ["summary"], RECRUITER);
  const profile_text = buildProfileText(
    { summary: "Closed new-logo deals at British Airways and TUI.", consent },
    cv,
  );

  it("is partial on the CV alone: the wins are there, the word is not", () => {
    expect(cv).not.toMatch(/new[- ]logo/i);
    expect(statusOf(cv, requirement).status).toBe("partial");
  });

  it("is met with the recruiter's profile summary, quoted and labelled as profile evidence", () => {
    const row = statusOf(cv, requirement, { profile_text });
    expect(row.status).toBe("met");
    const fromProfile = row.evidence.filter((e) => e.source === "profile_recruiter_edited");
    expect(fromProfile.length).toBeGreaterThan(0);
    expect(fromProfile[0]!.snippet).toBe("Closed new-logo deals at British Airways and TUI.");
    expect(fromProfile[0]!.location).toMatch(/^profile:\d+-\d+$/);
    // CV quotes keep the offsets they always had.
    for (const e of row.evidence.filter((x) => x.source === "cv")) {
      const [, a, b] = /^cv:(\d+)-(\d+)$/.exec(e.location)!;
      expect(Number(b)).toBeLessThanOrEqual(cv.length);
      expect(Number(a)).toBeLessThan(Number(b));
    }
  });

  it("is partial again when the profile text is removed", () => {
    expect(statusOf(cv, requirement, { profile_text: "" }).status).toBe("partial");
    expect(statusOf(cv, requirement, { profile_text: null }).status).toBe("partial");
  });

  it("the candidate's own profile text counts too, labelled profile", () => {
    const own = buildProfileText(
      { summary: "Closed new-logo deals at British Airways and TUI.", consent: { provenance: { summary: { source: "candidate_provided" } } } },
      cv,
    );
    const row = statusOf(cv, requirement, { profile_text: own });
    expect(row.status).toBe("met");
    expect(row.evidence.some((e) => e.source === "profile")).toBe(true);
    expect(row.evidence.some((e) => e.source === "profile_recruiter_edited")).toBe(false);
  });

  it("a profile that repeats the CV adds nothing and counts nothing twice", () => {
    const repeat = buildProfileText(
      { summary: "Won British Airways (£1.4m ACV) and TUI (£750k ACV). Led enterprise sales, tenders and proofs of value alongside strategic technology partners.", consent },
      cv,
    );
    expect(repeat).toBe("");
    const withRepeat = scoreCandidate({ cv_text: cv, requirements: REQUIREMENTS, screening: [], as_of: AS_OF, profile_text: repeat });
    const without = scoreCandidate({ cv_text: cv, requirements: REQUIREMENTS, screening: [], as_of: AS_OF });
    expect(withRepeat.score).toBe(without.score);
    expect(withRepeat.input_hash).toBe(without.input_hash);
    expect(withRepeat.profile_evidence).toBeUndefined();
  });

  it("the label lines are never evidence", () => {
    const row = statusOf(cv, "Experience as a recruiter of summary and profile experience", { profile_text });
    expect(row.evidence.every((e) => !/PROFILE (SUMMARY|EXPERIENCE)/.test(e.snippet))).toBe(true);
    expect(row.matched_terms).not.toContain("profile");
  });

  it("what the recruiter's profile sets aside is not evidence", () => {
    const aside = buildProfileText(
      { summary: "His background is cloud infrastructure and IT operations rather than data analytics platforms such as Snowflake or Databricks.", consent },
      cv,
    );
    const row = statusOf(cv, MUST[3], { profile_text: aside });
    expect(row.status).toBe("missing");
    expect(row.matched_terms).not.toEqual(expect.arrayContaining(["snowflake"]));
    expect(row.matched_terms).not.toEqual(expect.arrayContaining(["databricks"]));
  });
});

describe("v1.8.0 — where the CV and the recruiter's profile disagree on dates, the profile wins", () => {
  const cv = [
    "Jordan Lee",
    "Sales Manager",
    "PROFESSIONAL EXPERIENCE",
    "Acme Ltd | Sales Manager Jan 2010 – Dec 2020",
    "• Sold payroll software to mid-market firms and managed renewals.",
    "• Ran quarterly business reviews with finance directors.",
    "Globex | Account Executive Jan 2008 – Dec 2009",
    "• Sold telephony to small businesses.",
    "EDUCATION",
    "BA Business Studies, University of Leeds (2004 – 2007)",
  ].join("\n");
  const years = "10+ years of experience";
  const corrected = (origin: "recruiter" | "candidate") =>
    buildProfileText(
      {
        experience: [
          { title: "Sales Manager", company: "Acme Ltd", start: "Jan 2016", end: "Dec 2020", summary: "" },
          { title: "Account Executive", company: "Globex", start: "Jan 2008", end: "Dec 2009", summary: "" },
        ],
        consent:
          origin === "recruiter"
            ? stampRecruiterEdit({}, ["experience"], RECRUITER)
            : { provenance: { experience: { source: "candidate_provided" } } },
      },
      cv,
    );

  it("counts the CV's dates when there is no recruiter profile", () => {
    const row = statusOf(cv, years);
    expect(row.matched_terms).toEqual(["rule:minimum_years"]);
    expect(row.status).toBe("met");
  });

  it("counts the recruiter's dates, and says the dates were corrected", () => {
    const profile_text = corrected("recruiter");
    const r = scoreCandidate({ cv_text: cv, requirements: one(years), screening: [], as_of: AS_OF, profile_text });
    const row = r.requirement_assessment[0]!;
    // Acme is five years on the profile, not eleven: seven years in all.
    expect(row.status).not.toBe("met");
    expect(row.rule_note).toContain("Dates as the recruiter corrected them on the profile.");
    expect(r.profile_evidence).toMatchObject({
      recruiter_edited: true,
      date_corrections: [{ role: "Acme", cv: "Jan 2010 – Dec 2020", profile: "Jan 2016 – Dec 2020" }],
    });
    expect(r.profile_evidence!.note).toBe(
      "Dates corrected by recruiter: Acme Jan 2016 – Dec 2020 (CV: Jan 2010 – Dec 2020).",
    );
    expect(buildExplanation(r, [])).toContain("Dates corrected by recruiter: Acme");
  });

  it("names each role once in the note, with the dates that were counted", () => {
    const billingCv = cv
      .replace("• Sold payroll software to mid-market firms and managed renewals.", "• Ran monthly billing for 400 clients.")
      .replace("• Sold telephony to small businesses.", "• Prepared invoices and billing adjustments.");
    const profile_text = buildProfileText(
      {
        experience: [
          { title: "Sales Manager", company: "Acme Ltd", start: "Jan 2016", end: "Dec 2020", summary: "Introduced e-billing for the largest clients." },
          { title: "Account Executive", company: "Globex", start: "Jan 2008", end: "Dec 2009", summary: "" },
          { title: "Billing Analyst", company: "Initech", start: "Jan 2012", end: "Dec 2015", summary: "Handled billing disputes and write-offs." },
        ],
        consent: stampRecruiterEdit({}, ["experience"], RECRUITER),
      },
      billingCv,
    );
    const row = statusOf(billingCv, "5+ years of billing experience", { profile_text });
    expect(row.status).toBe("met");
    // Acme 2016–2020, Initech 2012–2015 and Globex 2008–2009: eleven years.
    expect(row.rule_note).toContain("11 yrs from:");
    expect(row.rule_note).toContain("Jan 2016–Dec 2020");
    expect(row.rule_note).not.toContain("Jan 2010–Dec 2020");
    expect(row.rule_note).not.toContain("PROFILE EXPERIENCE");
    expect(row.rule_note!.match(/Acme/g)).toHaveLength(1);
    expect(row.rule_note!.match(/Globex/g)).toHaveLength(1);
    expect(row.rule_note).toContain("Initech");
    expect(row.evidence.map((e) => e.source)).toEqual(
      expect.arrayContaining(["cv", "profile_recruiter_edited"]),
    );
  });

  it("does not let the candidate's own profile dates override the CV", () => {
    // A candidate entry with no new sentence is the CV again: nothing is read.
    expect(corrected("candidate")).toBe("");
    const own = buildProfileText(
      {
        experience: [{ title: "Sales Manager", company: "Acme Ltd", start: "Jan 2016", end: "Dec 2020", summary: "Opened the Leeds office." }],
        consent: { provenance: { experience: { source: "candidate_provided" } } },
      },
      cv,
    );
    const r = scoreCandidate({ cv_text: cv, requirements: one(years), screening: [], as_of: AS_OF, profile_text: own });
    expect(r.requirement_assessment[0]!.status).toBe("met");
    expect(r.profile_evidence).toMatchObject({ recruiter_edited: false, date_corrections: [], note: null });
  });

  it("matches a role by the employer on the line above its dates, and leaves unmatched roles alone", () => {
    const stacked = [
      "PROFESSIONAL EXPERIENCE",
      "Sales Manager",
      "Acme Ltd | London",
      "(Jan 2010 – Dec 2020)",
      "• Sold payroll software to mid-market firms.",
      "Account Executive",
      "Initech | Leeds",
      "(Jan 2008 – Dec 2009)",
      "• Sold telephony to small businesses.",
    ].join("\n");
    const block = "PROFILE EXPERIENCE (R)\nSales Manager | Acme Ltd Jan 2016 – Dec 2020";
    const doc = `${stacked}\n\n${block}`;
    const start = stacked.length + 2 + "PROFILE EXPERIENCE (R)\n".length;
    expect(profileDateCorrections(doc, { start, end: doc.length }, AS_OF)).toEqual([
      { role: "Acme", cv: "Jan 2010 – Dec 2020", profile: "Jan 2016 – Dec 2020" },
    ]);
    expect(profileDateCorrections(doc, null, AS_OF)).toEqual([]);
  });

  it("does not guess between two CV roles at one employer", () => {
    const twoStints = [
      "PROFESSIONAL EXPERIENCE",
      "Acme Ltd | Sales Manager Jan 2016 – Dec 2020",
      "• Managed renewals.",
      "Acme Ltd | Account Executive Jan 2010 – Dec 2015",
      "• Sold payroll software.",
    ].join("\n");
    const block = "PROFILE EXPERIENCE (R)\nSales Manager | Acme Ltd Jan 2017 – Dec 2020";
    const doc = `${twoStints}\n\n${block}`;
    const start = twoStints.length + 2 + "PROFILE EXPERIENCE (R)\n".length;
    expect(profileDateCorrections(doc, { start, end: doc.length }, AS_OF)).toEqual([]);
  });
});

describe("v1.8.0 — every evidence item says where it was read, and the run says who answered", () => {
  const cv = ORIGINAL.replace("new-logo acquisition, ", "").replace("New Logo Acquisition • ", "");
  const consent = stampRecruiterEdit({}, ["summary"], RECRUITER);
  const profile_text = buildProfileText({ summary: "Closed new-logo deals at British Airways and TUI.", consent }, cv);
  const question = "Are you based in or within commuting distance of London, and able to travel up to 50%?";
  const run = (answered_by?: "candidate" | "recruiter_on_behalf") =>
    scoreCandidate({
      cv_text: cv,
      requirements: REQUIREMENTS,
      screening: [yes("q-london", question, MUST[5], answered_by)],
      candidate_location: "Hertfordshire, United Kingdom",
      as_of: AS_OF,
      profile_text,
    });

  it("uses only the five source labels", () => {
    const r = run("recruiter_on_behalf");
    const sources = new Set(r.requirement_assessment.flatMap((a) => a.evidence.map((e) => e.source)));
    for (const s of sources) {
      expect(["cv", "profile", "profile_recruiter_edited", "screening_candidate", "screening_recruiter"]).toContain(s);
    }
    expect(sources.has("cv")).toBe(true);
    expect(sources.has("profile_recruiter_edited")).toBe(true);
    expect(sources.has("screening_recruiter")).toBe(true);
    // The run's flat evidence list carries the same labels.
    expect(r.evidence.every((e) => (e.source as string) !== "screening")).toBe(true);
  });

  it("an answer a recruiter entered counts exactly as the candidate's own", () => {
    const own = run();
    const explicit = run("candidate");
    const entered = run("recruiter_on_behalf");
    expect(entered.score).toBe(own.score);
    expect(entered.requirement_assessment.map((a) => a.status)).toEqual(own.requirement_assessment.map((a) => a.status));
    expect(entered.category_breakdown.screening_alignment).toBe(own.category_breakdown.screening_alignment);
    expect(own.screening_source).toBeUndefined();
    expect(explicit.screening_source).toBeUndefined();
    expect(entered.screening_source).toEqual({ candidate: 0, recruiter_on_behalf: 1 });
    const london = entered.requirement_assessment.find((a) => a.id === "req-5")!;
    expect(london.evidence.map((e) => e.source)).toEqual(["profile", "screening_recruiter"]);
    expect(own.requirement_assessment.find((a) => a.id === "req-5")!.evidence.map((e) => e.source)).toEqual([
      "profile",
      "screening_candidate",
    ]);
  });

  it("the run's explanation says the screening was answered by a recruiter", () => {
    expect(SCREENING_BY_RECRUITER_NOTE).toBe("screening answered by recruiter, pending candidate confirmation");
    expect(buildExplanation(run("recruiter_on_behalf"), [])).toContain(SCREENING_BY_RECRUITER_NOTE);
    expect(buildExplanation(run(), [])).not.toContain("answered by recruiter");
  });

  it("a profile edit and a change of who answered are new inputs; the candidate's own answers hash as before", () => {
    const base = {
      engine_version: ENGINE_VERSION,
      cv_text: cv,
      requirements: REQUIREMENTS,
      screening: [yes("q-london", question, MUST[5])],
    };
    const plain = computeInputHash(base);
    expect(computeInputHash({ ...base, profile_text: "" })).toBe(plain);
    expect(computeInputHash({ ...base, profile_text: null })).toBe(plain);
    expect(computeInputHash({ ...base, screening: [yes("q-london", question, MUST[5], "candidate")] })).toBe(plain);
    expect(computeInputHash({ ...base, profile_text })).not.toBe(plain);
    expect(computeInputHash({ ...base, profile_text: `${profile_text} Edited.` })).not.toBe(
      computeInputHash({ ...base, profile_text }),
    );
    expect(
      computeInputHash({ ...base, screening: [yes("q-london", question, MUST[5], "recruiter_on_behalf")] }),
    ).not.toBe(plain);
    expect(run().input_hash).not.toBe(run("recruiter_on_behalf").input_hash);
  });

  it("the replay snapshot carries the profile text, the location and who answered, and only when set", () => {
    const plain = buildReplaySnapshot({ cv_text: cv, requirements: REQUIREMENTS, screening: [yes("q", question, MUST[5])] });
    expect(plain).not.toHaveProperty("profile_text");
    expect(plain).not.toHaveProperty("candidate_location");
    expect(plain.screening[0]).not.toHaveProperty("answered_by");
    const full = buildReplaySnapshot({
      cv_text: cv,
      requirements: REQUIREMENTS,
      screening: [yes("q-london", question, MUST[5], "recruiter_on_behalf")],
      profile_text,
      candidate_location: "Hertfordshire, United Kingdom",
    });
    expect(full.profile_text).toBe(profile_text);
    expect(full.candidate_location).toBe("Hertfordshire, United Kingdom");
    expect(full.screening[0]!.answered_by).toBe("recruiter_on_behalf");
    const reread = ReplaySnapshotSchema.parse(JSON.parse(JSON.stringify(full)));
    const again = scoreCandidate({
      cv_text: reread.cv_text,
      requirements: reread.requirements as RequirementInput[],
      screening: reread.screening as unknown as ScreeningAnswer[],
      profile_text: reread.profile_text ?? null,
      candidate_location: reread.candidate_location ?? null,
      as_of: AS_OF,
    });
    const first = run("recruiter_on_behalf");
    expect(again.input_hash).toBe(first.input_hash);
    expect(again.score).toBe(first.score);
  });
});

describe("v1.8.0 — the source label a client and an admin read", () => {
  it("the client's claim source", () => {
    expect(normaliseSource("profile_recruiter_edited")).toBe("Profile (recruiter verified)");
    expect(normaliseSource("profile")).toBe("Profile");
    expect(normaliseSource("screening_candidate")).toBe("Application answers");
    expect(normaliseSource("screening_recruiter")).toBe(
      "Screening answers (recruiter-entered, pending candidate confirmation)",
    );
    // Labels stored before v1.8.0 read as they did.
    expect(normaliseSource("cv")).toBe("CV");
    expect(normaliseSource("screening")).toBe("Screening call");
  });

  it("the admin's source line and the 'quoted from' sentence", () => {
    expect(humanizeSource("profile_recruiter_edited")).toBe("Profile (recruiter verified)");
    expect(humanizeSource("profile")).toBe("Profile");
    expect(humanizeSource("screening_candidate")).toBe("Screening answer");
    expect(humanizeSource("screening_recruiter")).toContain("recruiter-entered");
    expect(humanizeSource("profile:12-80")).toBe("Profile · characters 12–80");
    expect(humanizeSource("profile:location")).toBe("Profile · location");
    expect(humanizeSource("cv:134-299")).toBe("CV · characters 134–299");
    expect(sourcePhrase("profile_recruiter_edited")).toBe("the profile (recruiter verified)");
    expect(sourcePhrase("screening_recruiter")).toContain("pending the candidate's confirmation");
    expect(sourcePhrase("cv")).toBe("cv");
    expect(sourcePhrase(null)).toBe("the application");
  });
});

describe("v1.8.0 — the offline rescore reads the same profile and guards it", () => {
  const cv = ORIGINAL.replace("new-logo acquisition, ", "").replace("New Logo Acquisition • ", "");
  const consent = stampRecruiterEdit({}, ["summary"], RECRUITER);
  const match = {
    match_id: "11111111-1111-4111-8111-111111111111",
    application_id: "22222222-2222-4222-8222-222222222222",
    candidate_profile_id: "33333333-3333-4333-8333-333333333333",
    position_id: "44444444-4444-4444-8444-444444444444",
    organization_id: "55555555-5555-4555-8555-555555555555",
    eligibility_status: "eligible",
    cv_text: cv,
    location: "Hertfordshire, United Kingdom",
    city: null,
    country: "United Kingdom",
    headline: null,
    summary: "Closed new-logo deals at British Airways and TUI.",
    experience: null,
    consent,
    answers: [],
    eligibility_checks: [],
  };
  const ctx = {
    position: {
      id: match.position_id,
      title: "Enterprise Sales Director",
      requirements: [...MUST],
      preferred_requirements: [...NICE],
    },
    organisation: { name: "Example Client", brand_display_name: null },
    rubric: { id: "66666666-6666-4666-8666-666666666666", calibration: null },
    role_family: "sales",
    reason: "test",
  };

  it("scores with the profile text and refuses the write if the profile changed after the export", () => {
    const withProfile = offlineRescore(match, ctx);
    const cvOnly = offlineRescore({ ...match, summary: null, consent: null }, ctx);
    expect(withProfile.kind).toBe("scored");
    expect(cvOnly.kind).toBe("scored");
    if (withProfile.kind !== "scored" || cvOnly.kind !== "scored") return;
    expect(withProfile.score).toBeGreaterThan(cvOnly.score);
    expect(withProfile.sql).toContain("profile changed since export");
    expect(withProfile.sql).toContain("profile_recruiter_edited");
    expect(withProfile.sql).toContain('"profile_text"');
    expect(cvOnly.sql).not.toContain('"profile_text"');
  });

  it("fingerprints the fields the engine may read", () => {
    const a = profileFingerprintText(match);
    // headline | summary | experience | provenance, the last two as Postgres prints jsonb.
    expect(a.startsWith("|Closed new-logo deals at British Airways and TUI.||{")).toBe(true);
    expect(a).toContain('"source": "admin_corrected"');
    expect(profileFingerprintText({ ...match, summary: "Edited." })).not.toBe(a);
    expect(profileFingerprintText({ ...match, consent: {} })).not.toBe(a);
    expect(profileFingerprintText({ headline: null, summary: null, experience: null, consent: null })).toBe("|||");
  });
});

describe("v1.8.0 — version", () => {
  it("is the engine version new runs record", () => {
    expect(ENGINE_VERSION).toBe("taasflow-scoring-v1.8.0");
  });
});
