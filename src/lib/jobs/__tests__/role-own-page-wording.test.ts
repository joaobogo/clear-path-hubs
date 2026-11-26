/**
 * A role can state, in its own words, what the public job page cannot work
 * out from its structured fields (26 Nov 2026, two field-based sales roles
 * posted for a confidential client):
 *
 *  - "Hybrid — on-site days not specified" was wrong: the roles are
 *    field-based. A role's own work-arrangement statement now replaces the
 *    derived line and the work-model tag.
 *  - "Range shared on the first call" promised a range nobody had. With no
 *    stored range, the employer's own figure-free pay line is shown instead.
 *  - A contractor role is not sponsored: its own line replaces the
 *    sponsorship sentence.
 *  - A confidential employer can be described; titles use the short form.
 *  - A role can leave response-time promises off its page.
 */
import { describe, expect, it } from "vitest";
import {
  RANGE_ON_CALL,
  buildPublicJobFacts,
  resolveCompensation,
  resolveLocation,
  resolveWorkArrangement,
  resolveWorkAuthorisation,
} from "@/lib/jobs/public-facts";
import {
  PUBLIC_WORDING_KEYS,
  arrangementLabel,
  employerLabelForTitle,
  responseTimesHidden,
  wordingText,
} from "@/lib/jobs/public-wording";
import { publicHeading } from "@/lib/positions/field-registry";
import { positionToEditForm } from "@/lib/positions/role-form";
import { postingCopyFields } from "@/lib/positions/protected-criteria-fields";

describe("pay line when the range is not published", () => {
  const noRange = { budget_min: null, budget_max: null, min: null, max: null };

  it("shows the employer's own pay line when no range was ever given", () => {
    const c = {
      ...noRange,
      summary: "Competitive base salary + uncapped commission on new bookings",
    };
    expect(resolveCompensation(c, "internal")).toEqual({
      display: null,
      line: "Competitive base salary + uncapped commission on new bookings",
    });
    expect(
      resolveCompensation({ ...noRange, note: "Monthly retainer + uncapped commission" }, null)
        .line,
    ).toBe("Monthly retainer + uncapped commission");
  });

  it("still says the range is shared on the first call when a range exists", () => {
    const c = { budget_min: 80000, budget_max: 100000, summary: "Base plus bonus" };
    expect(resolveCompensation(c, "internal").line).toBe(RANGE_ON_CALL);
    expect(resolveCompensation({ min: 65000, summary: "Base plus bonus" }, "internal").line).toBe(
      RANGE_ON_CALL,
    );
  });

  it("never lets a figure through a hidden pay line", () => {
    for (const summary of ["£120k base + commission", "Base of 90,000 plus bonus", "OTE 2x base"]) {
      const out = resolveCompensation({ ...noRange, summary }, "internal");
      expect(out.line).toBe(RANGE_ON_CALL);
      expect(out.display).toBeNull();
    }
  });

  it("keeps the old line when there is neither a range nor a pay line", () => {
    expect(resolveCompensation(noRange, "internal").line).toBe(RANGE_ON_CALL);
    expect(resolveCompensation(null, undefined).line).toBe(RANGE_ON_CALL);
  });

  it("leaves a published range untouched", () => {
    const c = { budget_min: 80000, budget_max: 100000, currency: "GBP", period: "year" };
    expect(resolveCompensation(c, "public").line).toMatch(/80,000/);
  });
});

describe("work arrangement in the role's own words", () => {
  const own = "Field-based in London. Up to 50% travel to clients and partners.";

  it("replaces the derived line", () => {
    expect(resolveWorkArrangement("hybrid", null, "", own)).toBe(own);
    expect(resolveWorkArrangement("hybrid", null, "", "  ")).toBe(
      "Hybrid — on-site days not specified",
    );
    expect(resolveWorkArrangement("hybrid", 3, "")).toBe("Hybrid — 3 days a week on-site");
  });

  it("gives a short tag from the first sentence, or none", () => {
    expect(arrangementLabel(own)).toBe("Field-based in London");
    expect(
      arrangementLabel(
        "Field-based in Amsterdam. Up to 50% travel across the Netherlands and Europe.",
      ),
    ).toBe("Field-based in Amsterdam");
    expect(
      arrangementLabel(
        "Based wherever you are in the United Kingdom, visiting customer sites most weeks.",
      ),
    ).toBe("");
    expect(arrangementLabel("")).toBe("");
    expect(arrangementLabel(null)).toBe("");
  });
});

describe("location line in the role's own words", () => {
  it("replaces the derived line", () => {
    expect(
      resolveLocation(
        "London, United Kingdom",
        "Europe/London",
        null,
        "London, UK (field-based). Territory: UK & Ireland.",
      ),
    ).toBe("London, UK (field-based). Territory: UK & Ireland.");
    expect(resolveLocation("London, United Kingdom", null, null, "")).toBe(
      "London, United Kingdom",
    );
  });
});

describe("work authorisation for a contractor role", () => {
  const line = "Must be able to work in the Netherlands and invoice through your own KvK business.";

  it("shows the role's own line, not the sponsorship sentence", () => {
    expect(
      resolveWorkAuthorisation({ rule: "contractor", sponsorship_available: false }, line),
    ).toBe(line);
    expect(
      resolveWorkAuthorisation(
        { rule: "contractor", sponsorship_available: false, note: "Own business" },
        "",
      ),
    ).toBe("Own business");
  });

  it("leaves an employed role's sponsorship sentence as it was", () => {
    expect(
      resolveWorkAuthorisation({ rule: "already_authorized", sponsorship_available: false }, line),
    ).toBe("No sponsorship — you must already be authorised to work");
    expect(resolveWorkAuthorisation({ rule: "contractor", sponsorship_available: false }, "")).toBe(
      "No sponsorship — you must already be authorised to work",
    );
  });
});

describe("the facts block for a field-based contractor role", () => {
  it("carries every own line through", () => {
    const facts = buildPublicJobFacts({
      compensation: {
        budget_min: null,
        budget_max: null,
        summary: "Monthly retainer + uncapped commission on new bookings",
      },
      compensation_visibility: "internal",
      work_model: "hybrid",
      location: "Amsterdam, Netherlands",
      primary_timezone: "Europe/Amsterdam",
      work_authorization: { rule: "contractor", sponsorship_available: false },
      work_authorization_note:
        "Must be able to work in the Netherlands and invoice through your own KvK business.",
      employment_type: "contract",
      published_at: "2026-11-24T17:38:47.069+00:00",
      work_arrangement_statement:
        "Field-based in Amsterdam. Up to 50% travel across the Netherlands and Europe.",
      location_line:
        "Amsterdam, Netherlands (field-based). Territory: Netherlands plus key European markets.",
    });
    expect(facts.compensation).toBe("Monthly retainer + uncapped commission on new bookings");
    expect(facts.workArrangement).toBe(
      "Field-based in Amsterdam. Up to 50% travel across the Netherlands and Europe.",
    );
    expect(facts.location).toBe(
      "Amsterdam, Netherlands (field-based). Territory: Netherlands plus key European markets.",
    );
    expect(facts.workAuthorisation).toBe(
      "Must be able to work in the Netherlands and invoice through your own KvK business.",
    );
    expect(facts.employmentType).toBe("Contract");
    expect(JSON.stringify(facts)).not.toMatch(/Hybrid|first call|sponsorship/i);
  });
});

describe("employer wording, response times and text handling", () => {
  it("names a described employer in short for titles", () => {
    expect(
      employerLabelForTitle("An AI-first engineering firm (name shared after screening)"),
    ).toBe("An AI-first engineering firm");
    expect(employerLabelForTitle("A listed UK retailer")).toBe("A listed UK retailer");
    expect(employerLabelForTitle("")).toBe("");
  });

  it("hides response times only on the exact setting", () => {
    expect(responseTimesHidden("hidden")).toBe(true);
    expect(responseTimesHidden(" Hidden ")).toBe(true);
    for (const v of ["", "standard", null, undefined, true, 1])
      expect(responseTimesHidden(v)).toBe(false);
  });

  it("reads one line of text and nothing else", () => {
    expect(wordingText("  One role,\n based in  London. ")).toBe("One role, based in London.");
    for (const v of [null, undefined, 3, {}, []]) expect(wordingText(v)).toBe("");
  });
});

describe("the editor and the copy check know the wording", () => {
  it("loads the stored wording into the role form", () => {
    const form = positionToEditForm({
      id: "p1",
      title: "Enterprise Sales Director",
      intake_context: {
        posting: {
          confidentiality: "confidential",
          headline: "One role, based in London.",
          work_arrangement: "Field-based in London.",
          location_line: "London, UK (field-based).",
          employer_label: "An AI-first engineering firm (name shared after screening)",
          response_times: "hidden",
        },
      },
    });
    expect(form.headline).toBe("One role, based in London.");
    expect(form.work_arrangement).toBe("Field-based in London.");
    expect(form.location_line).toBe("London, UK (field-based).");
    expect(form.employer_label).toBe("An AI-first engineering firm (name shared after screening)");
    expect(form.response_times).toBe("hidden");
    const empty = positionToEditForm({ id: "p2", title: "Role" });
    for (const k of PUBLIC_WORDING_KEYS) expect(empty[k]).toBe("");
  });

  it("puts the new candidate-facing lines through the protected-attribute check", () => {
    const fields = postingCopyFields({
      headline: "One role, based in London.",
      work_arrangement: "Field-based in London.",
      location_line: "London, UK (field-based).",
      employer_label: "An AI-first engineering firm",
    }).map((f) => f.field);
    expect(fields).toEqual(["headline", "work_arrangement", "location_line", "employer_label"]);
  });
});

describe("requirement headings on the job page", () => {
  it("label what rules a candidate out and what does not", () => {
    expect(publicHeading("must_have_skills")).toBe("Must-haves");
    expect(publicHeading("nice_to_have_skills")).toBe("Nice to have (not required)");
  });
});
