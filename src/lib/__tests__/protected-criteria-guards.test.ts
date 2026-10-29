/**
 * Server-side refusals for protected-attribute criteria on every save path:
 * client intake, the role editor, publishing, and generated blueprints.
 */
import { describe, expect, it } from "vitest";
import {
  assertRoleFormCriteriaAllowed,
  intakeProtectedCriteriaResponse,
  storedCriteriaPublishDetail,
} from "@/lib/positions/protected-criteria-guard";
import {
  intakeCriteriaFields,
  postingCopyFields,
  roleFormCriteriaFields,
  screenBlueprintCriteria,
  storedPositionCriteriaFields,
} from "@/lib/positions/protected-criteria-fields";
import {
  evaluatePublishGate,
  humanizePublishBlockedMessage,
  publishBlockedMessage,
  type PublishGateInput,
} from "@/lib/publish-gate";
import { findLanguageIssues, hasBlockingLanguageFinding } from "@/lib/jobs/language-findings";
import { publishGaps, type PublishGateInput as JobsGateInput } from "@/lib/jobs/publish-gates";
import { PROTECTED_CRITERIA_ERROR_PREFIX } from "@/lib/scoring/protected-attributes";

describe("client intake", () => {
  const base = {
    roleTitle: "Group Marketing Manager",
    requirements: [
      { text: "10+ years of marketing experience", tag: "must_have" },
      { text: "Korean nationality", tag: "must_have" },
      { text: "Arabic language skills", tag: "nice_to_have" },
    ],
    dealBreakerList: ["Under 35", "Cannot start within six weeks"],
  };

  it("labels rows the way the form shows them", () => {
    expect(intakeCriteriaFields(base).map((f) => f.label)).toEqual([
      "Must-have 1",
      "Must-have 2",
      "Nice-to-have 1",
      "Deal-breaker 1",
      "Deal-breaker 2",
    ]);
  });

  it("refuses with every finding and its suggested rewrite", () => {
    const r = intakeProtectedCriteriaResponse(base);
    expect(r?.error).toBe("protected_criteria");
    expect(r?.findings.map((f) => [f.field, f.index, f.replacement])).toEqual([
      ["requirements", 1, "Marketing experience in the South Korean market"],
      ["dealBreakerList", 0, ""],
    ]);
    expect(r?.message).toMatch(/Must-have 2 \("Korean nationality"\)/);
    expect(r?.message).toMatch(/Deal-breaker 1 \("Under 35"\): Age limits/);
    expect(r?.message.startsWith(PROTECTED_CRITERIA_ERROR_PREFIX)).toBe(false);
  });

  it("accepts market, location and work-authorisation wording", () => {
    expect(
      intakeProtectedCriteriaResponse({
        roleTitle: "Marketing Manager",
        requirements: [
          { text: "Experience in the Korean market", tag: "must_have" },
          { text: "Eligible to work in the UAE", tag: "must_have" },
          { text: "Based in Dubai", tag: "must_have" },
        ],
        dealBreakerList: [],
      }),
    ).toBeNull();
  });

  it("reads legacy text lists when no tagged list is sent", () => {
    const fields = intakeCriteriaFields({ mustHaves: "- SQL\n- Male candidates only", dealBreakers: "" });
    expect(fields.map((f) => f.text)).toEqual(["SQL", "Male candidates only"]);
    expect(intakeProtectedCriteriaResponse({ mustHaves: "SQL\nMale candidates only" })?.findings).toHaveLength(1);
  });
});

describe("role editor save", () => {
  const form = {
    title: "Head of Sales",
    must_have_skills: ["B2B SaaS sales", "Native English speaker"],
    nice_to_have_skills: [],
    trainable_skills: [],
    disqualifier_tags: ["No agency-only backgrounds"],
    screening_questions: [{ question: "What is your nationality?" }],
  };

  it("covers must-haves, nice-to-haves, deal-breakers and screening questions", () => {
    expect(roleFormCriteriaFields(form).map((f) => f.field)).toEqual([
      "must_have_skills",
      "must_have_skills",
      "disqualifier_tags",
      "screening_questions",
    ]);
  });

  it("throws a message naming each finding and its rewrite", () => {
    expect(() => assertRoleFormCriteriaAllowed(form)).toThrow(/^protected_criteria: 2 criteria use/);
    try {
      assertRoleFormCriteriaAllowed(form);
    } catch (e) {
      expect((e as Error).message).toMatch(/Must-have 2 \("Native English speaker"\).*Suggested: "Fluent English speaker"/);
      expect((e as Error).message).toMatch(/Screening question 1 \("What is your nationality\?"\)/);
    }
  });

  it("checks posting copy saved with the role, but not the EEO statement", () => {
    const fields = roleFormCriteriaFields({ languages: "Native Arabic speaker", benefits: "Health cover" });
    expect(fields.map((f) => [f.field, f.index])).toEqual([
      ["languages", undefined],
      ["benefits", undefined],
    ]);
    expect(() => assertRoleFormCriteriaAllowed({ languages: "Native Arabic speaker" })).toThrow(
      /Languages \("Native Arabic speaker"\).*Suggested: "Fluent Arabic speaker"/,
    );
    expect(postingCopyFields({ languages: "" })).toEqual([]);
  });

  it("lets a clean form through", () => {
    expect(() =>
      assertRoleFormCriteriaAllowed({ ...form, must_have_skills: ["B2B SaaS sales"], screening_questions: [] }),
    ).not.toThrow();
  });
});

describe("publish gate", () => {
  const ready: PublishGateInput = {
    status: "approved",
    payment_status: "paid",
    approved_at: "2026-10-01T00:00:00Z",
    published_at: null,
    title: "Group Marketing Manager",
    description: "x".repeat(120),
    employment_type: "permanent",
    work_model: "onsite",
    seniority: "senior",
    location: "Dubai",
    requirements: [{ label: "10+ years of marketing", kind: "must_have" }],
  };

  it("a clean role has no protected-criteria blocker", () => {
    expect(evaluatePublishGate(ready)).not.toContain("protected_criteria");
  });

  it("blocks on a stored requirement, deal-breaker or screening question", () => {
    expect(
      evaluatePublishGate({ ...ready, requirements: [{ label: "Korean nationality", kind: "must_have" }] }),
    ).toContain("protected_criteria");
    expect(evaluatePublishGate({ ...ready, dealbreakers: [{ label: "Over 45" }] })).toContain(
      "protected_criteria",
    );
    expect(
      evaluatePublishGate({ ...ready, screening_questions: [{ question: "Are you married?" }] }),
    ).not.toContain("protected_criteria");
    expect(
      evaluatePublishGate({ ...ready, screening_questions: [{ question: "Marital status?" }] }),
    ).toContain("protected_criteria");
  });

  it("the refusal names each criterion with its rewrite", () => {
    const detail = storedCriteriaPublishDetail({
      title: "Marketing Manager",
      requirements: [{ label: "Arab nationality" }],
    });
    expect(detail).toMatch(/Must-have 1 \("Arab nationality"\).*Suggested: "Arabic language skills"/);
    const msg = `${publishBlockedMessage(["protected_criteria"])} ${detail}`;
    expect(humanizePublishBlockedMessage(msg)).toMatch(
      /^Approval blocked: a hiring criterion states a protected attribute\. One criterion uses/,
    );
  });

  it("stored rows read {label} objects and plain strings", () => {
    expect(
      storedPositionCriteriaFields({
        requirements: [{ label: "SQL" }, "Python"],
        preferred_requirements: [{ label: "dbt", kind: "nice_to_have" }],
      }).map((f) => f.text),
    ).toEqual(["SQL", "Python", "dbt"]);
  });
});

describe("posting language and brief gates", () => {
  it("language findings block with the suggested rewrite", () => {
    const f = findLanguageIssues("We need a Korean national to lead the launch.");
    const blocking = f.filter((x) => x.blocking);
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking[0]!.suggestion).toMatch(/South Korean market/);
    expect(hasBlockingLanguageFinding("Experience in the Korean market is essential.")).toBe(false);
  });

  it("brief publish gaps block a protected requirement and cannot be waived", () => {
    const input: JobsGateInput = {
      arrangement: {} as never,
      compensation: {} as never,
      authorisation: {} as never,
      requirements: [
        { id: "r1", text: "Under 35", kind: "must_have" },
        { id: "r2", text: "SQL", kind: "must_have" },
      ] as never,
      waived: ["protected_criteria.r1"],
    };
    const gap = publishGaps(input).find((g) => g.key === "protected_criteria.r1");
    expect(gap?.group).toBe("blocking");
    expect(gap?.question).toMatch(/Age limits/);
  });
});

describe("generated blueprints", () => {
  it("holds back flagged items with their rewrite and keeps the rest", () => {
    const out = screenBlueprintCriteria({
      role: { title: "Marketing Director" },
      must_have_skills: ["Brand strategy", "Japanese nationality"],
      nice_to_have_skills: ["Fluent Japanese"],
      dealbreakers: ["Female candidates only"],
      screening_questions: [{ question: "How old are you? Must be under 40." }, { question: "Do you have the right to work in Japan?" }],
      sourcing_plan: { disqualifiers: [] },
    });
    expect(out.mustHaves).toEqual(["Brand strategy"]);
    expect(out.niceToHaves).toEqual(["Fluent Japanese"]);
    expect(out.dealbreakers).toEqual([]);
    expect(out.held.map((h) => [h.field, h.replacement])).toEqual([
      ["requirements", "Marketing experience in the Japanese market"],
      ["dealbreakers", ""],
      ["screening_questions", "How old are you?"],
    ]);
  });
});
