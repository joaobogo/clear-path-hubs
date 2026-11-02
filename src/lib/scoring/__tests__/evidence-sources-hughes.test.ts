/**
 * Evidence sources — Hughes Mushrooms "Mushroom Harvesting Manager"
 * (position 9466d8ac), owner's research of 2 Nov 2026, platform issues 2 and 3.
 *
 *   2. "The engine credits the role's own words back to the candidate."
 *      Anna Brintha (match 8dd2623c) got "partial" on both mushroom must-haves
 *      because her work-authorisation answer names Hughes Mushrooms; Vijay
 *      Mane (match 352c28ae) got "Previous experience as a Harvesting Manager:
 *      met" from a summary sentence about applying for the role.
 *   3. "Student and course work is scored as professional experience."
 *      Adiya Vatsa (match b058712e): a college mushroom centre as a Student
 *      Member, coursework modules and a university consulting project.
 *      Thaddeus Armoh (match 8b3b78e9): a university mushroom-cultivation
 *      course, plus a "yes" to the mushroom dealbreaker.
 *
 * Fixtures are the candidates' own CV text as stored (flattened where the
 * stored text is), with names, contact details and visa lines removed.
 */
import { describe, expect, it } from "vitest";
import {
  computeInputHash,
  scoreCandidate,
  type RequirementInput,
  type ScreeningAnswer,
} from "@/lib/scoring-engine.server";
import { dealbreakerCondition } from "../eligibility";
import {
  isExperienceRequirement,
  maskNonEvidence,
  roleContextOf,
  studyContextOf,
} from "../evidence-sources";
import { offlineRescore, type OfflineContext, type OfflineMatch } from "../offline-rescore";
import { ReplaySnapshotSchema, buildReplaySnapshot } from "../replay";

// ---------- the role, as stored ----------

const ROLE = roleContextOf({
  organisation_name: "Hughes Mushrooms",
  role_title: "Mushroom Harvesting Manager",
});

const MUST = [
  "Hands-on mushroom picking experience",
  "Previous supervisory experience on a mushroom farm",
  "Strong people management and communication skills, written and verbal",
  "Excellent organisational and interpersonal skills",
  "Good basic IT and numerical skills",
  "Flexible approach to working hours, including weekends and peak overtime",
];
const NICE = [
  "Previous experience as a Harvesting Manager in the mushroom industry",
  "Experience managing pick rates, manning plans and agency labour",
  "Food safety team experience (HACCP, TACCP, VACCP, BRC)",
  "Advanced Food Hygiene qualification",
  "Degree-level education",
];
const REQUIREMENTS: RequirementInput[] = [
  ...MUST.map((text, i) => ({ id: `req-${i}`, text, required: true, keywords: [] })),
  ...NICE.map((text, i) => ({ id: `pref-${i}`, text, required: false, keywords: [] })),
];

type Q = {
  id: string;
  question: string;
  answer_type: string;
  required: boolean;
  dealbreaker: boolean;
  must_have: string;
};
const Q_MUSHROOM: Q = {
  id: "7da77185-54dc-4fd9-89ea-1f960fee0fdb",
  question:
    "Do you have direct, hands-on mushroom picking experience as well as supervisory experience on a commercial mushroom farm?",
  answer_type: "boolean",
  required: true,
  dealbreaker: true,
  must_have: "Hands-on mushroom picking experience and supervisory experience on a mushroom farm",
};
const Q_ONSITE: Q = {
  id: "9816fc81-6e28-4d8e-815d-ee86f37b1f2c",
  question:
    "Are you able to work 100% onsite in Holme-on-Spalding-Moor on a 5-days-out-of-7 rota, including weekends and overtime during peak periods?",
  answer_type: "boolean",
  required: true,
  dealbreaker: true,
  must_have: "Full onsite availability on a 5-out-of-7 rota including weekends",
};
const Q_AUTH: Q = {
  id: "c5b1023e-0b34-40be-b352-ceda257589d6",
  question: "What is your current UK work authorization status?",
  answer_type: "single_choice",
  required: true,
  dealbreaker: false,
  must_have: "Right to work in the UK or eligibility for employer visa sponsorship",
};
const Q_FOOD: Q = {
  id: "4b294949-8742-4fcd-847a-2e2823fca88a",
  question:
    "Do you hold an Advanced Food Hygiene qualification or direct experience participating in HACCP/TACCP/VACCP food safety teams?",
  answer_type: "boolean",
  required: false,
  dealbreaker: false,
  must_have: "Food safety compliance and HACCP awareness",
};
const answer = (q: Q, value: unknown): ScreeningAnswer => ({
  question_id: q.id,
  question: q.question,
  required: q.required,
  answer_type: q.answer_type,
  value,
  disqualifying_condition: dealbreakerCondition(q),
  must_have: q.must_have,
});

const AS_OF = new Date("2026-11-02T00:00:00Z");
const score = (cv: string, screening: ScreeningAnswer[], role_context = ROLE) =>
  scoreCandidate({
    cv_text: cv,
    requirements: REQUIREMENTS,
    screening,
    role_context,
    as_of: AS_OF,
  });
const row = (r: ReturnType<typeof scoreCandidate>, id: string) =>
  r.requirement_assessment.find((a) => a.id === id)!;

// ---------- fixtures (stored CV text; names, contacts and visa lines removed) ----------

const ANNA_CV =
  "PROFESSIONAL PROFILE Cell Biology Technician with hands-on experience in Double Haploid (DH) cereal production, plant breeding, tissue culture, glasshouse operations and seed processing. Experienced in wheat Wide Cross, wheat and barley Anther Culture, embryo rescue, chromosome doubling, plant-out coordination, laboratory quality monitoring and experimental research. Combines lab-to-glasshouse crop experience with an MSc in Food Science and a Bachelor's degree in Agricultural Engineering. CORE TECHNICAL, IT & PROFESSIONAL SKILLS Cell Biology & Laboratory: DH production; wheat Wide Cross; wheat & barley Anther Culture; embryo rescue; tissue culture; aseptic transfers; chromosome doubling; plant regeneration; culture-media dispensing; contamination control. Plant Breeding & Glasshouse: Plant-out planning & scheduling; pollination/crossing; sowing; transplanting; plant husbandry; tissue sampling; vernalisation; harvesting; seed processing; seed cleaning/counting; pest & disease monitoring; irrigation/fertilisation. IT & Technical: Microsoft Excel, Word & PowerPoint; SharePoint; SPSS; XLSTAT. PROFESSIONAL EXPERIENCE Cell Biology Technician | Syngenta | Jealott's Hill, UK | Aug 2025 - Present ⚫ Support DH cereal production across wheat Wide Cross, wheat Anther Culture and barley Anther Culture, including embryo rescue, aseptic tissue culture, chromosome doubling and plant regeneration. ⚫ Plan and coordinate laboratory plant-out schedules and organise timely handover of plant material to glasshouse teams. ⚫ Maintain plant-material traceability and laboratory documentation in line with HSE, GVP, quality and safety requirements. Glasshouse Technician (NSPP) | Syngenta | Jealott's Hill, UK | Mar 2024 - Aug 2025 ⚫ Supported wheat breeding programmes through sowing, transplanting, plant-out, plant husbandry, tissue sampling, pollination/crossing, harvesting and seed processing. Production Supervisor | Kanyakumari Coconut Producer Company Ltd | India | May 2022 - Sep 2022 ⚫ Coordinated production workflows, team activities and quality-control processes while maintaining hygiene, food-safety and operational standards. EDUCATION MSc Food Science (Merit) | University of Reading, UK | Sep 2022 - Sep 2023 Bachelor's in Agricultural Engineering (Distinction) | Kalaignarkarunanidhi Institute of Technology, India | Jul 2018 - Jul 2022";
const ANNA_AUTH_ANSWER =
  "I currently hold a UK Skilled Worker visa sponsored by Syngenta, valid until 17 August 2030. I would require sponsorship from Hughes Mushrooms and approval to update my visa before starting this role.";
const ANNA_SCREENING = [
  answer(Q_MUSHROOM, false),
  answer(Q_ONSITE, true),
  answer(Q_AUTH, ANNA_AUTH_ANSWER),
  answer(Q_FOOD, true),
];

const VIJAY_CV =
  "Agricultural Operations and Team Management | Mushroom Production Training PROFESSIONAL SUMMARY Agricultural professional and former horticultural FPO Chief Executive with experience in operations, grower coordination, and crop research. MSc graduate with Distinction, IIHR commercial mushroom cultivation training and practical shiitake mushroom production training. Currently a Research Technician at the University of Greenwich, seeking to apply leadership, crop assessment, and problem- solving skills to the Mushroom Harvesting Manager role at Hughes Mushrooms. RELEVANT STRENGTHS Agricultural operations coordination • Team leadership and stakeholder communication • Planning and prioritization • Crop health and fungal biology • Quality checks and accurate records PROFESSIONAL EXPERIENCE Research Technician Molecular Biology & Microbiology | Natural Resources Institute, University of Greenwich Feb 2025 – Present • Support crop health research on strawberry Botrytis crown rot, contributing to disease phenotyping across more than 700 strawberry cultivars. • Coordinate greenhouse and laboratory activities, prepare materials, monitor experimental progress and maintain accurate records in controlled environments. • Work with researchers and technicians to organize activities and communicate progress, including weekly supervisor updates and occasional presentations to laboratory groups and industry partners. • Support MSc students with laboratory techniques and troubleshooting when they need assistance. Chief Executive Officer Yamakanmardi Horticultural Farmer Producer Organisation, India • Jul 2021 – Aug 2023 • Led agricultural business operations involving grower coordination, procurement, value addition and product marketing. • Provided technical advice and commercial support to more than 500 farmers, communicating practical recommendations on crop production and agricultural inputs. • Explored market opportunities for mushrooms produced by an FPO farmer, contacting hotels, fresh produce vendors and household consumers directly to assess demand and potential sales channels. Sales Supervisor Aries Agro, India • Sep 2019 – Mar 2021 • Supervised agricultural sales activities and coordinated relationships with growers and distributors. Mushroom production training Online Mushroom Entrepreneurship Training Course on Spawn Production and Mushroom Cultivation ICAR–Indian Institute of Horticultural Research, Bengaluru | 25–30 Oct 2021 • Six-day online course covering pure cultures, spawn production, contamination control, button and oyster mushroom cultivation, farm design, post-harvest practices and marketing. Practical Shiitake Mushroom Production Training Krishi Vigyan Kendra (KVK), Belagavi | 2021 • Completed one day practical training in Shiitake mushroom production. EDUCATION MSc Agriculture for Sustainable Development (Distinction) University of Greenwich, UK • 2024 • Relevant modules: Agronomy and Crop Physiology, Integrated Pest Management, Plant pathology. BSc (Hons) Agriculture University of Agricultural Sciences, Dharwad, India • 2020 ADDITIONAL EXPERIENCE AND TECHNICAL SKILLS • Digital skills: Microsoft Office and preparation of records, reports and presentations.";
const VIJAY_SCREENING = [answer(Q_MUSHROOM, false), answer(Q_ONSITE, true), answer(Q_FOOD, false)];

const ADIYA_CV = `PROFESSIONAL SUMMARY
Biotechnology with Business Enterprise postgraduate with a BSc (Hons.) in Botany and practical academic
training in mushroom cultivation. Two-year association with a university mushroom research centre, with
experience in spawn preparation, substrate preparation, cultivation, harvesting, grading and post-harvest
handling. Additional experience in microbiological laboratory practices, environmental data collection and
team leadership.
EDUCATION
University of Leeds - MSc Biotechnology with Business Enterprise
Leeds, UK | 2024-2025 | High Merit
Acharya Narendra Dev College, University of Delhi - BSc (Hons.) Botany
Delhi, India | 2021-2024 | CGPA: 8.51/10 | Third Rank in College (2023–2024)
RELEVANT MYCOLOGY, MUSHROOM CULTIVATION AND LABORATORY EXPERIENCE
Mushroom Research and Skill Development Centre | Student Member | 2022–2023
 Two-year association with the Mushroom Research and Skill Development Centre, which cultivated
and commercially sold edible mushrooms.
 Hands-on experience with Agaricus bisporus and Pleurotus, including substrate preparation, crop
monitoring, harvesting, grading and post-harvest handling.
 Guided fellow students during practical cultivation and harvesting activities, helping coordinate tasks
and oversee work.
Mycology, Phytopathology and Mushroom Cultivation Technology | University of Delhi | 2022-2023
 Prepared and sterilised culture media and carried out spawn preparation and multiplication.
 Studied fungal classification, fungal diseases, plant pathogens, disease cycles and methods of disease
prevention and control.
 Covered the nutritional and medicinal value of mushrooms, food preparation and processing, and the
economics and marketing of mushroom production.


PROFESSIONAL EXPERIENCE
Blackmont Consulting | Business Consultant | Aug-Oct 2026
 Conducted market and commercial research, pricing analysis and strategic assessment for a clientfacing consulting engagement.
Practera Industry Consulting Project | Team Lead | University of Leeds | 2025
 Led a seven-member team developing a market-entry strategy for a carbon-removal startup expanding
into Rwanda.
Environmental Field Data Collection | Air Quality Monitoring | 2023
 Conducted field-based air quality index data collection over five months.
LEADERSHIP AND STAKEHOLDER MANAGEMENT
University of Leeds | Student Ambassador and Course Representative | 2024-2025
 Represented the University at outreach events, engaging 500+ visitors, and facilitated student–
faculty communication, contributing to programme improvements.

SKILLS
Mushroom Cultivation: Spawn preparation and multiplication, culture media preparation,
sterilisation, substrate preparation, mushroom bed preparation and cultivation techniques.
Harvesting & Post-Harvest Handling: Mushroom harvesting, grading, quality assessment, storage
and preservation.
Data & IT: Microsoft Excel, Google Sheets, data recording, numerical analysis and reporting.
ADDITIONAL INFORMATION
Willing to relocate to East Yorkshire | Available for onsite work and flexible shifts.
`;

/** Adiya's student and course sections with her one paid role: what her mushroom work rests on. */
const ADIYA_STUDENT_CV = ADIYA_CV.slice(
  ADIYA_CV.indexOf("EDUCATION"),
  ADIYA_CV.indexOf("Practera"),
);

/**
 * Thaddeus's stored CV, flattened. His mushroom background is the course his
 * cover letter describes ("I did a full course on mushroom cultivation as an
 * agronomy student"); the engine reads the CV and screening answers, so the
 * sentence sits where a CV states it, under the degree.
 */
const THADDEUS_CV =
  "Support Worker SEND Learning Support Assistant PROFESSIONAL PROFILE Compassionate and adaptable Support Worker with extensive experience supporting adults and children with learning disabilities, autism, schizophrenia, and complex needs. Brings over 15 years of combined experience across health & social care, education, and community services. KEY SKILLS Operational & Administrative • Team supervision & collaboration • Data collection & reporting • Microsoft Word, Excel, PowerPoint PROFESSIONAL EXPERIENCE Residential Support Worker IBC Healthcare, Mansfield, UK Feb 2024 – Present • Support adults with learning disabilities, autism, and schizophrenia in supported living settings. • Maintain accurate daily records in line with CQC standards. Care Support Worker Portland Community College / Care Stream Home Care, Mansfield, UK Jun 2023 – Jan 2024 • Supported students with learning disabilities and behavioural challenges. Assistant Registration Officer / District Registration Officer National Identification Authority 2020 – 2023 • Registered over 3,500 citizens for national ID programmes. • Supervised teams of up to 367 staff. Teacher (Science & Primary) Various Schools 2003 – 2013 • Delivered lessons, prepared students for exams, and supported learning needs. EDUCATION BSc Agriculture Technology (Agronomy) University for Development Studies, Ghana | 2008 – 2012 • Did a full course on mushroom cultivation as an agronomy student. TRAINING & CERTIFICATIONS (SELECTED) • Self-Harm & Ligature Training (2025) • CPI Safety Intervention Foundation (2024, 2025) • First Aid at Work (2024) • Principles of Management (2023)";
const THADDEUS_SCREENING = [answer(Q_MUSHROOM, true), answer(Q_ONSITE, true), answer(Q_FOOD, true)];

// ---------- 2. the role's own words ----------

describe("the role's own words are not evidence (owner item 2)", () => {
  it("a work-authorisation answer naming the client does not evidence the mushroom must-haves (Anna Brintha)", () => {
    const r = score(ANNA_CV, ANNA_SCREENING);
    for (const id of ["req-0", "req-1"]) {
      expect(row(r, id).status).toBe("missing");
      expect(row(r, id).evidence.some((e) => e.location === `screening:${Q_AUTH.id}`)).toBe(false);
    }
    expect(row(r, "pref-0").matched_terms).not.toContain("mushroom");
    // Her own "no" to the dealbreaker still decides eligibility, as before.
    expect(r.disqualifying_answers.map((d) => d.question_id)).toEqual([Q_MUSHROOM.id]);
  });

  it("was crediting the client's name as mushroom experience before the client was known to the engine", () => {
    const r = score(ANNA_CV, ANNA_SCREENING, null);
    expect(row(r, "req-0").status).toBe("partial");
    expect(row(r, "req-0").evidence[0]!.snippet).toContain("Hughes Mushrooms");
  });

  it("a sentence about applying for the role is not experience as that role (Vijay Mane)", () => {
    for (const ctx of [ROLE, null]) {
      const r = score(VIJAY_CV, VIJAY_SCREENING, ctx);
      const pref0 = row(r, "pref-0");
      expect(pref0.status).not.toBe("met");
      expect(pref0.matched_terms).not.toContain("harvesting");
      expect(pref0.matched_terms).not.toContain("manager");
      expect(r.evidence.some((e) => /Harvesting Manager role/.test(e.snippet))).toBe(false);
    }
    // His real mushroom work is still read: marketing an FPO farmer's mushrooms.
    expect(row(score(VIJAY_CV, VIJAY_SCREENING), "req-0").evidence[0]!.snippet).toMatch(
      /market opportunities for mushrooms/,
    );
  });

  it("the same title held at another employer is still evidence", () => {
    const cv = `${VIJAY_CV} PREVIOUS ROLES Mushroom Harvesting Manager | Glenmore Mushrooms Ltd | Mar 2016 – Jan 2019 • Ran harvesting for 40 growing rooms in the mushroom industry, leading 60 pickers across two shifts.`;
    const pref0 = row(score(cv, VIJAY_SCREENING), "pref-0");
    expect(pref0.status).toBe("met");
    expect(pref0.matched_terms).toEqual(expect.arrayContaining(["harvesting", "manager"]));
  });

  it("offline rescore reads the client and the title from the export and stores them for replay", () => {
    const ctx: OfflineContext = {
      position: {
        id: "9466d8ac-0b74-4b14-94e9-0e9d56021fa2",
        title: "Mushroom Harvesting Manager",
        requirements: MUST.map((label) => ({ label, kind: "must_have" })),
        preferred_requirements: NICE.map((label) => ({ label, kind: "nice_to_have" })),
      },
      organisation: { name: "Hughes Mushrooms", brand_display_name: null },
      rubric: { id: "37e53863-a4a7-4ee4-85f0-0f6af9fad818", calibration: {} },
      role_family: "people",
      reason: "test",
    };
    const q = (x: Q) => ({
      question: x.question,
      answer_type: x.answer_type,
      required: x.required,
      dealbreaker: x.dealbreaker,
      must_have: x.must_have,
    });
    const match: OfflineMatch = {
      match_id: "8dd2623c-54e4-4aeb-ab91-b9a4f05f1b4a",
      application_id: "11111111-1111-4111-8111-111111111111",
      candidate_profile_id: "22222222-2222-4222-8222-222222222222",
      position_id: ctx.position.id,
      organization_id: "33333333-3333-4333-8333-333333333333",
      eligibility_status: "not_eligible",
      cv_text: ANNA_CV,
      location: null,
      city: null,
      country: null,
      answers: [
        { question_id: Q_MUSHROOM.id, answer: { value: false }, q: q(Q_MUSHROOM) },
        { question_id: Q_AUTH.id, answer: { value: ANNA_AUTH_ANSWER }, q: q(Q_AUTH) },
      ],
    };
    const out = offlineRescore(match, ctx, {
      run_id: "44444444-4444-4444-8444-444444444444",
      trace_id: "sc_test",
    });
    expect(out.kind).toBe("scored");
    if (out.kind !== "scored") return;
    const result = JSON.parse(
      out.sql.match(/r jsonb := \$res\d*\$([\s\S]*?)\$res\d*\$::jsonb/)![1]!,
    );
    const statuses = Object.fromEntries(
      (result.requirement_assessment as Array<{ id: string; status: string }>).map((a) => [
        a.id,
        a.status,
      ]),
    );
    expect(statuses["req-0"]).toBe("missing");
    expect(statuses["req-1"]).toBe("missing");
    const snapshot = JSON.parse(
      out.sql.match(/s jsonb := \$snp\d*\$([\s\S]*?)\$snp\d*\$::jsonb/)![1]!,
    );
    expect(snapshot.role_context).toEqual({
      organisation_names: ["Hughes Mushrooms"],
      role_title: "Mushroom Harvesting Manager",
    });
  });
});

// ---------- 3. study and training ----------

describe("study and training count as partial at most for experience requirements (owner item 3)", () => {
  it("student and course work does not meet previous experience as a Harvesting Manager (Adiya Vatsa)", () => {
    const r = score(ADIYA_CV, []);
    const pref0 = row(r, "pref-0");
    expect(pref0.status).toBe("partial");
    expect(pref0.needs_validation).toBe(true);
    expect(pref0.rule_note).toMatch(/study or training/);
    for (const id of ["req-0", "req-1"]) expect(row(r, id).status).not.toBe("met");
  });

  it("hands-on harvesting at a college centre as a Student Member is partial, not met, and a yes does not lift it", () => {
    const requirement = {
      id: "req-h",
      text: "Hands-on mushroom harvesting experience",
      required: true,
      keywords: [],
    };
    const linkedYes: ScreeningAnswer = {
      ...answer(Q_MUSHROOM, true),
      disqualifying_condition: null,
      must_have: "Hands-on mushroom harvesting experience",
    };
    for (const screening of [[], [linkedYes]]) {
      const a = scoreCandidate({
        cv_text: ADIYA_STUDENT_CV,
        requirements: [requirement],
        screening,
        role_context: ROLE,
        as_of: AS_OF,
      }).requirement_assessment[0]!;
      expect(a.matched_terms).toEqual(expect.arrayContaining(["mushroom", "harvesting"]));
      expect(a.status).toBe("partial");
      expect(a.needs_validation).toBe(true);
      expect(a.rule_note).toMatch(/study or training/);
      if (screening.length) expect(a.evidence.some((e) => e.source === "screening")).toBe(true);
    }
  });

  it("a university mushroom course plus a yes stays partial for hands-on picking (Thaddeus Armoh)", () => {
    const r = score(THADDEUS_CV, THADDEUS_SCREENING);
    const req0 = row(r, "req-0");
    expect(req0.matched_terms).toContain("mushroom");
    expect(req0.status).toBe("partial");
    expect(req0.needs_validation).toBe(true);
    // The claim is kept for the recruiter, not used to exclude or to promote.
    expect(req0.evidence.some((e) => e.snippet.startsWith("Answered yes to"))).toBe(true);
    expect(r.disqualifying_answers).toEqual([]);
  });

  it("commercial work still meets the requirement, quoted from the job", () => {
    const requirement = {
      id: "req-h",
      text: "Hands-on mushroom harvesting experience",
      required: true,
      keywords: [],
    };
    const cv = `${ADIYA_STUDENT_CV}\nMushroom Harvester | Glenmore Mushrooms Ltd | Mar 2019 – Feb 2022\n Picked and graded oyster and button mushrooms to retailer specification during harvesting shifts.\n`;
    const a = scoreCandidate({
      cv_text: cv,
      requirements: [requirement],
      screening: [],
      role_context: ROLE,
      as_of: AS_OF,
    }).requirement_assessment[0]!;
    expect(a.status).toBe("met");
    expect(a.rule_note).toBeUndefined();
    expect(a.evidence.some((e) => /Picked and graded|Glenmore/.test(e.snippet))).toBe(true);
  });

  it("degree, qualification and skill requirements are not experience requirements", () => {
    expect(MUST.slice(0, 2).every(isExperienceRequirement)).toBe(true);
    expect(isExperienceRequirement(NICE[0]!)).toBe(true);
    expect(isExperienceRequirement(NICE[1]!)).toBe(true);
    expect(isExperienceRequirement(NICE[2]!)).toBe(true);
    expect(isExperienceRequirement("Advanced Food Hygiene qualification")).toBe(false);
    expect(isExperienceRequirement("Degree-level education")).toBe(false);
    expect(isExperienceRequirement(MUST[2]!)).toBe(false);
    expect(row(score(ADIYA_CV, []), "pref-4").rule_note).toBeUndefined();
  });
});

// ---------- helpers ----------

describe("maskNonEvidence", () => {
  it("keeps every offset and line break", () => {
    const masked = maskNonEvidence(ADIYA_CV, ROLE);
    expect(masked).toHaveLength(ADIYA_CV.length);
    expect(masked.split("\n")).toHaveLength(ADIYA_CV.split("\n").length);
    const anna = maskNonEvidence(ANNA_AUTH_ANSWER, ROLE);
    expect(anna).toHaveLength(ANNA_AUTH_ANSWER.length);
    expect(anna).not.toMatch(/mushroom/i);
    expect(anna).toContain("Syngenta");
  });

  it("blanks aspirational clauses to the end of the clause only", () => {
    const text =
      "Seeking a role in mushroom harvesting; managed 40 pickers at a mushroom farm. I would like to lead a picking team.";
    const masked = maskNonEvidence(text, null);
    expect(masked).not.toMatch(/Seeking|harvesting|lead a picking/);
    expect(masked).toContain("managed 40 pickers at a mushroom farm.");
  });

  it("leaves learning statements to the negation cues and degree names alone", () => {
    expect(maskNonEvidence("I would like to learn mushroom picking.", null)).toBe(
      "I would like to learn mushroom picking.",
    );
    const degree =
      "MSc – Biology Applied to Sustainability of Natural Resources, University of Oviedo";
    expect(maskNonEvidence(degree, null)).toBe(degree);
  });
});

describe("studyContextOf", () => {
  const studied = (text: string, phrase: string) => studyContextOf(text)(text.indexOf(phrase));

  it("marks Adiya's student, course and university-project entries and not her paid role or skills", () => {
    expect(studied(ADIYA_CV, "Hands-on experience with Agaricus")).toBe(true);
    expect(studied(ADIYA_CV, "Guided fellow students")).toBe(true);
    expect(studied(ADIYA_CV, "Covered the nutritional")).toBe(true);
    expect(studied(ADIYA_CV, "Led a seven-member team")).toBe(true);
    expect(studied(ADIYA_CV, "Conducted market and commercial research")).toBe(false);
    expect(studied(ADIYA_CV, "Mushroom harvesting, grading")).toBe(false);
  });

  it("reads headings and training courses inside a CV stored as one line", () => {
    expect(studied(VIJAY_CV, "Six-day online course")).toBe(true);
    expect(studied(VIJAY_CV, "Relevant modules")).toBe(true);
    expect(studied(VIJAY_CV, "Explored market opportunities for mushrooms")).toBe(false);
    expect(studied(VIJAY_CV, "Digital skills")).toBe(false);
  });

  it("training given and students supervised are work", () => {
    const cv =
      "PROFESSIONAL EXPERIENCE\nHarvest Supervisor | Glenmore Mushrooms Ltd | 2019 – 2022\n• Conducted staff training for 30 new pickers.\n• Co-supervised MSc and PhD students on placement.\n• Completed a Lantra supervisor training course.\n• Ran the night picking shift.";
    expect(studied(cv, "Conducted staff training")).toBe(false);
    expect(studied(cv, "Co-supervised MSc")).toBe(false);
    expect(studied(cv, "Completed a Lantra")).toBe(true);
    // One course listed under a real job does not recast the job.
    expect(studied(cv, "Ran the night picking shift")).toBe(false);
  });
});

describe("role context as a scoring input", () => {
  it("is stored on the replay snapshot only when set, and old snapshots still parse", () => {
    const base = { cv_text: "x", requirements: [], screening: [], role_family: null };
    expect(buildReplaySnapshot(base)).not.toHaveProperty("role_context");
    expect(buildReplaySnapshot({ ...base, role_context: ROLE }).role_context).toEqual(ROLE);
    expect(ReplaySnapshotSchema.safeParse(buildReplaySnapshot(base)).success).toBe(true);
  });

  it("changes the input hash only when set", () => {
    const parts = { engine_version: "v", cv_text: "cv", requirements: [], screening: [] };
    expect(computeInputHash({ ...parts, role_context: null })).toBe(computeInputHash(parts));
    expect(computeInputHash({ ...parts, role_context: ROLE })).not.toBe(computeInputHash(parts));
  });
});
