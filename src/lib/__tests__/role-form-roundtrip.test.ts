import { describe, expect, it } from "vitest";
import { expressIntakeSchema, requirementsToLines } from "@/lib/express-intake-schema";
import {
  editFormToPositionPatch,
  intakePayloadToPosition,
  isoDateOrNull,
  positionToEditForm,
  roleIntakeAnswersShape,
  roleRequiredness,
  seededLocation,
  storedDescription,
  type PositionEditInitial,
} from "@/lib/positions/role-form";
import { positionShapeFor } from "@/lib/positions/field-registry";
import { assessJobQuality, requisitionMetaSchema, DEFAULT_WEIGHTS } from "@/lib/requisition-schema";
import { z } from "zod";

/**
 * Owner report (8 Oct): "it kept saying I didn't put the time zone or city,
 * but I actually did in the intake form. The same information in the intake
 * form should be the one in the editing role area."
 *
 * These tests run the REAL mappings end to end: a fully answered intake →
 * the positions row the handler inserts → the edit form → the save patch →
 * the edit form again. Nothing may be lost, and nothing the client answered
 * may be reported as missing.
 */

const fullIntake = {
  idempotencyKey: "roundtrip-key-0001",
  companyName: "Northwind Health",
  companyWebsite: "northwindhealth.com",
  companyLinkedin: "",
  firstName: "Dana",
  lastName: "Okoro",
  contactTitle: "COO",
  workEmail: "dana@northwindhealth.com",
  phone: "",
  contactLinkedin: "",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
  roleTitle: "Clinical Operations Manager",
  team: "Clinical Operations",
  jobDescriptionText:
    "We are hiring a Clinical Operations Manager to run our clinics across the region. You will own scheduling, staffing and compliance.",
  jobDescriptionFile: null,
  mustHaves: "",
  niceToHaves: "",
  trainable: "",
  requirements: [
    { text: "Five years running multi-site clinical operations", tag: "must_have" },
    { text: "CQC inspection experience", tag: "must_have" },
    { text: "Epic or Cerner rollout", tag: "nice_to_have" },
    { text: "Our internal rostering tool", tag: "trainable" },
  ],
  manyMustHavesConfirmed: false,
  dealBreakers: "",
  dealBreakerList: ["No agency-side-only backgrounds", "Cannot start within six weeks"],
  location: "Manchester, United Kingdom",
  workModel: "remote",
  seniority: "Senior",
  employmentType: "full_time",
  remoteTimezones: ["uk_ireland", "europe_central"],
  remoteAnywhereInCountry: false,
  sponsorshipAvailable: "no",
  currency: "GBP",
  compensationPeriod: "year",
  salaryMin: 70000,
  salaryMax: 85000,
  compensationNote: "Can stretch for someone exceptional",
  compensationUndecided: false,
  bonusStructure: "10% annual bonus",
  equity: "offered",
  compensationFlexible: true,
  wideRangeConfirmed: false,
  workAuthorization: "already_authorized",
  workAuthorizationNote: "Right to work in the UK",
  targetStartDate: "2026-11-02",
  interviewProcess: "",
  interviewStages: [
    { name: "Intro call", format: "video_call", ownerName: "Sam Lee", ownerEmail: "sam@northwindhealth.com" },
    { name: "Final panel", format: "panel", ownerName: "", ownerEmail: "" },
  ],
  targetDaysToOffer: 21,
  decisionMaker: "Dana Okoro, COO",
  decisionMakerEmail: "dana@northwindhealth.com",
  inviteCollaborators: false,
  consent: true,
  pilotAcknowledgement: true,
  researchConsent: true,
  source: "express_onboarding",
  companyFax: "",
};

/** What the handler inserts, as a row the edit screen would load. */
function storedRow(intake: Record<string, unknown>) {
  // Exactly what the intake page's buildSubmitPayload sends alongside the list.
  const parsed = expressIntakeSchema.parse({
    ...intake,
    ...requirementsToLines((intake.requirements ?? []) as never),
  });
  const { position } = intakePayloadToPosition(parsed, { now: "2026-10-08T10:00:00.000Z" });
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organization_id: "22222222-2222-4222-8222-222222222222",
    organizations: { name: "Northwind Health" },
    status: "submitted",
    visibility: "private",
    openings: 1,
    blueprint: {},
    ...position,
  };
}

/** The exact validator the save handler runs. */
const saveSchema = z.object({ id: z.string().uuid(), ...positionShapeFor("admin"), ...roleIntakeAnswersShape });

function toSaveData(form: PositionEditInitial) {
  const { organization_id: _o, organization_name: _n, status: _s, visibility: _v, ...rest } = form;
  return { ...rest, headcount: typeof rest.headcount === "number" ? rest.headcount : null };
}

describe("intake → role → edit form: no answer is lost", () => {
  const row = storedRow(fullIntake);
  const form = positionToEditForm(row);

  it("every intake answer is pre-filled on the edit screen", () => {
    expect(form.title).toBe("Clinical Operations Manager");
    expect(form.department).toBe("Clinical Operations");
    expect(form.description).toContain("Clinical Operations Manager to run our clinics");
    expect(form.location).toBe("Manchester, United Kingdom");
    expect(form.work_model).toBe("remote");
    expect(form.seniority).toBe("Senior");
    expect(form.employment_type).toBe("full_time");
    expect(form.remote_timezones).toEqual(["uk_ireland", "europe_central"]);
    expect(form.remote_anywhere_in_country).toBe(false);
    expect(form.sponsorship_available).toBe("no");
    expect(form.work_authorization_rule).toBe("already_authorized");
    expect(form.work_authorization_rule_note).toBe("Right to work in the UK");
    expect(form.currency).toBe("GBP");
    expect(form.budget_period).toBe("year");
    expect(form.budget_min).toBe("70000");
    expect(form.budget_max).toBe("85000");
    expect(form.compensation).toBe("Can stretch for someone exceptional");
    expect(form.bonus_structure).toBe("10% annual bonus");
    expect(form.equity).toBe("offered");
    expect(form.compensation_flexible).toBe(true);
    expect(form.compensation_undecided).toBe(false);
    expect(form.target_start_date).toBe("2026-11-02");
    expect(form.must_have_skills).toEqual([
      "Five years running multi-site clinical operations",
      "CQC inspection experience",
    ]);
    expect(form.nice_to_have_skills).toEqual(["Epic or Cerner rollout"]);
    expect(form.trainable_skills).toEqual(["Our internal rostering tool"]);
    expect(form.disqualifier_tags).toEqual([
      "No agency-side-only backgrounds",
      "Cannot start within six weeks",
    ]);
    expect(form.interview_stages.map((s) => s.name)).toEqual(["Intro call", "Final panel"]);
    expect(form.interview_stages[0].ownerEmail).toBe("sam@northwindhealth.com");
    expect(form.interview_process).toContain("Intro call");
    expect(form.time_to_hire).toBe("21");
    expect(form.decision_maker).toBe("Dana Okoro, COO");
    expect(form.decision_maker_email).toBe("dana@northwindhealth.com");
  });

  it("reports nothing the client answered as missing — not the city, not the time zone", () => {
    const req = roleRequiredness(form);
    expect(req.errors).toEqual({});
    expect(req.missing).toEqual([]);
    const quality = assessJobQuality({
      ...form,
      locations: [],
      travel_expectation: "",
      primary_timezone: "",
      timezone_overlap_hours: null,
      owner_user_id: null,
      reference_code: "",
      compensation_collected: true,
      location_text: form.location,
    });
    const ids = quality.gaps.map((g) => g.id);
    expect(ids).not.toContain("locations");
    expect(ids).not.toContain("timezone");
    expect(quality.blocking).toEqual([]);
  });

  it("the untouched form passes the exact save validator", () => {
    const parsed = saveSchema.safeParse(toSaveData(form));
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);
  });

  it("save → reload keeps every answer (edit form round-trip)", () => {
    const data = saveSchema.parse(toSaveData(form)) as never;
    const patch = editFormToPositionPatch(data, row, { now: "2026-10-08T11:00:00.000Z" });
    const reloaded = positionToEditForm({ ...row, ...patch });
    const strip = (f: PositionEditInitial) => ({ ...f, screening_questions: [] });
    expect(strip(reloaded)).toEqual(strip(form));
  });

  it("the edit-screen location seeds a structured row with city and country", () => {
    const seeded = seededLocation(false, "hybrid", "Manchester, United Kingdom");
    expect(seeded.city).toBe("Manchester");
    expect(seeded.country_code).toBe("GB");
    expect(seeded.notes).toBe("");
  });
});

describe("the edit screen never obliges a time zone or a city", () => {
  it("a remote role with time zones but no city saves", () => {
    const row = storedRow({ ...fullIntake, location: "" });
    const form = positionToEditForm(row);
    expect(form.location).toBe("");
    expect(roleRequiredness(form).errors).toEqual({});
    expect(saveSchema.safeParse(toSaveData(form)).success).toBe(true);
  });

  it("a remote role with no city and no time zone saves", () => {
    const row = storedRow({ ...fullIntake, location: "", remoteTimezones: [], remoteAnywhereInCountry: true });
    const form = positionToEditForm({ ...row });
    const edited = { ...form, remote_timezones: [], remote_anywhere_in_country: false };
    const req = roleRequiredness(edited);
    expect(req.errors).toEqual({});
    // A hint at most — never an error.
    expect(req.missing).not.toContain("Remote, hybrid or on site");
    expect(saveSchema.safeParse(toSaveData(edited)).success).toBe(true);
  });

  it("changing the time zone to empty and saving succeeds and is stored as empty", () => {
    const row = storedRow(fullIntake);
    const form = { ...positionToEditForm(row), remote_timezones: [] };
    const data = saveSchema.parse(toSaveData(form)) as never;
    const patch = editFormToPositionPatch(data, row) as { intake_context: Record<string, unknown> };
    expect(patch.intake_context.remote_timezones).toEqual([]);
    expect(positionToEditForm({ ...row, ...patch }).remote_timezones).toEqual([]);
  });

  it("an edit with every optional field blank saves", () => {
    const blank: PositionEditInitial = {
      ...positionToEditForm(storedRow(fullIntake)),
      department: "",
      location: "",
      work_model: "",
      employment_type: "",
      seniority: "",
      headcount: "",
      target_start_date: "",
      budget_min: "",
      budget_max: "",
      compensation: "",
      remote_timezones: [],
      remote_anywhere_in_country: false,
      onsite_days: "",
      sponsorship_available: "",
      work_authorization_rule: "",
      interview_stages: [],
      decision_maker: "",
      decision_maker_email: "",
      disqualifier_tags: [],
      nice_to_have_skills: [],
      trainable_skills: [],
    };
    expect(roleRequiredness(blank).errors).toEqual({});
    const parsed = saveSchema.safeParse(toSaveData(blank));
    expect(parsed.success, JSON.stringify(parsed.error?.issues ?? [])).toBe(true);
    expect(() => editFormToPositionPatch(parsed.data as never, {})).not.toThrow();
  });

  it("a hybrid role without a city or day count saves (hint only)", () => {
    const form = { ...positionToEditForm(storedRow(fullIntake)), work_model: "hybrid" as const, location: "", onsite_days: "" as const };
    const req = roleRequiredness(form);
    expect(req.errors).toEqual({});
    expect(req.missing).toContain("Where the role is based");
  });

  it("only what sourcing cannot start without blocks a save", () => {
    const form = positionToEditForm(storedRow(fullIntake));
    expect(roleRequiredness({ ...form, title: "" }).errors.title).toBeTruthy();
    expect(
      roleRequiredness({ ...form, must_have_skills: [], description: "" }).errors.must_have_skills,
    ).toBeTruthy();
    // One must-have is enough, as on the intake (it used to demand three).
    expect(roleRequiredness({ ...form, must_have_skills: ["CQC"], description: "" }).errors).toEqual({});
  });

  it("structured locations are optional: zero rows, or a row without a city, save", () => {
    const base = {
      position_id: "11111111-1111-4111-8111-111111111111",
      evaluation_weights: DEFAULT_WEIGHTS,
    };
    expect(requisitionMetaSchema.safeParse({ ...base, locations: [] }).success).toBe(true);
    expect(
      requisitionMetaSchema.safeParse({
        ...base,
        locations: [{ country_code: "GB", work_model: "hybrid", is_primary: true }],
      }).success,
    ).toBe(true);
  });
});

describe("values the old editor refused", () => {
  it("long must-haves, a 2-character title and a long description still save", () => {
    const row = storedRow({
      ...fullIntake,
      roleTitle: "QA",
      jobDescriptionText: "x".repeat(30_000),
      requirements: [{ text: "R".repeat(110), tag: "must_have" }],
    });
    const form = positionToEditForm(row);
    expect(saveSchema.safeParse(toSaveData(form)).success).toBe(true);
  });

  it("generated prose longer than a field is fitted, not a save failure", () => {
    const row = {
      ...storedRow(fullIntake),
      intake_context: { hiring_timeline: "h".repeat(300), timezone_requirements: "t".repeat(500) },
    };
    const form = positionToEditForm(row);
    expect(saveSchema.safeParse(toSaveData(form)).success).toBe(true);
  });

  it("a prose start date from the parser does not reach the date column", () => {
    const { position } = intakePayloadToPosition(
      expressIntakeSchema.parse({ ...fullIntake, ...requirementsToLines(fullIntake.requirements as never), targetStartDate: "As soon as possible" }),
    );
    expect(position.target_start_date).toBeNull();
    expect((position.intake_context as Record<string, unknown>).target_start_date_note).toBe(
      "As soon as possible",
    );
  });

  it("a compensation note alone is kept (it used to be dropped)", () => {
    const { position } = intakePayloadToPosition(
      expressIntakeSchema.parse({
        ...fullIntake,
        ...requirementsToLines(fullIntake.requirements as never),
        salaryMin: undefined,
        salaryMax: undefined,
        bonusStructure: "",
        equity: "",
        compensationFlexible: false,
        compensationNote: "Depends on location",
      }),
    );
    expect((position.compensation as Record<string, unknown>).note).toBe("Depends on location");
  });

  it("the intake leaves the role queued for analysis, never 'analysing' with nobody running it", () => {
    const { position } = intakePayloadToPosition(
      expressIntakeSchema.parse({ ...fullIntake, ...requirementsToLines(fullIntake.requirements as never) }),
    );
    expect(position.blueprint_status).toBe("queued");
  });
});


describe("review fixes on the role mapping", () => {
  it("refuses an impossible calendar date instead of letting the database reject the save", () => {
    expect(isoDateOrNull("2026-02-31")).toBeNull();
    expect(isoDateOrNull("2026-13-01")).toBeNull();
    expect(isoDateOrNull("2026-02-28")).toBe("2026-02-28");
    expect(isoDateOrNull("2028-02-29")).toBe("2028-02-29");
    expect(isoDateOrNull("As soon as possible")).toBeNull();
  });

  it("an untouched save never changes who may see the pay range", () => {
    const row = {
      id: "p1",
      title: "Clinical Operations Manager",
      description: "Run our clinics.",
      requirements: [{ label: "CQC inspection experience", kind: "must_have" }],
      preferred_requirements: [],
      dealbreakers: [],
      intake_context: {},
      compensation: { currency: "GBP", min: 70000, max: 85000, period: "year" },
      compensation_visibility: "internal",
      work_authorization: {},
      location: "Manchester, United Kingdom",
      work_model: "remote",
    };
    const form = positionToEditForm(row);
    expect(form.budget_min).toBe("70000");
    const patch = editFormToPositionPatch(form as never, row as never) as Record<string, unknown>;
    expect(patch).not.toHaveProperty("compensation_visibility");
    expect(patch.compensation_collected).toBe(true);
  });

  it("reads the description an uploaded-file role keeps in jd_text, so a no-op save is a no-op", () => {
    const row = { description: null, intake_context: {}, jd_text: "We are hiring a nurse.", blueprint: null };
    expect(storedDescription(row)).toBe("We are hiring a nurse.");
    expect(positionToEditForm({ ...row, requirements: [], preferred_requirements: [], dealbreakers: [] }).description).toBe(
      "We are hiring a nurse.",
    );
  });

  it("turns the intake's one-line location into a structured row", () => {
    const seeded = seededLocation(false, "hybrid", "Manchester, United Kingdom");
    expect(seeded).toMatchObject({ city: "Manchester", country_code: "GB", work_model: "hybrid", is_primary: true, notes: "" });
    expect(seededLocation(true, "remote", "Anywhere").country_code).toBe("");
  });
});
