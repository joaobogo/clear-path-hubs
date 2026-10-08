/**
 * Step 1 asks for the description. Everything else is read out of it.
 *
 * The intake was a three-step typed form with about nine required fields
 * spread across it, and its own headline promise ("upload the job description,
 * we build the blueprint") sat on step 2 — so every field the description
 * could have filled was typed by hand before the description was ever given
 * (audit 15 Sep, INT-001).
 *
 * The rebuild is deliberately a PRESENTATION change: the same form state, the
 * same submit payload, the same server schema, the same position record. What
 * moved is when the client is asked. These tests hold that line — if the
 * server contract ever drifts from the form, they fail.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALWAYS_REQUIRED_INTAKE_FIELDS,
  FREE_MAIL_DOMAINS,
  INTAKE_STEPS,
  STEP_FIELDS,
  companyWebsiteFromEmail,
  expressIntakeSchema,
  stepValidators,
} from "@/lib/express-intake-schema";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the work email answers the website question", () => {
  it("derives the company domain", () => {
    expect(companyWebsiteFromEmail("rita@northwindhealth.com")).toBe("northwindhealth.com");
    expect(companyWebsiteFromEmail("Rita.S@Sub.Example.CO.UK")).toBe("sub.example.co.uk");
  });

  it("refuses a free-mail domain, which says nothing about a company", () => {
    for (const d of ["gmail.com", "outlook.com", "icloud.com", "proton.me"]) {
      expect(FREE_MAIL_DOMAINS.has(d), `${d} should be known free-mail`).toBe(true);
      expect(companyWebsiteFromEmail(`someone@${d}`)).toBeNull();
    }
  });

  it("refuses anything that is not an address", () => {
    for (const bad of ["", "   ", "no-at-sign", "a@", "a@b", "a@localhost", "a@ spaced.com"]) {
      expect(companyWebsiteFromEmail(bad), bad).toBeNull();
    }
  });
});

describe("step 1 asks for the description, and does not ask for the website", () => {
  it("puts the job description on step 1", () => {
    expect(STEP_FIELDS.company).toContain("jobDescriptionText");
    expect(STEP_FIELDS.role, "it must not also be claimed by step 2").not.toContain(
      "jobDescriptionText",
    );
  });

  it("assigns the fallback website question to step 2", () => {
    expect(STEP_FIELDS.company).not.toContain("companyWebsite");
    expect(STEP_FIELDS.role).toContain("companyWebsite");
  });

  it("does not block step 1 on the website", () => {
    // The field is not on screen there any more, so failing step 1 on it would
    // stop the client on something they were never shown.
    const ok = stepValidators.company.safeParse({
      companyName: "Northwind Health",
      firstName: "Rita",
      lastName: "Sequeira",
      workEmail: "rita@northwindhealth.com",
    });
    expect(ok.success, JSON.stringify(ok.success ? {} : ok.error.issues)).toBe(true);
  });

  it("still requires the website by the review step", () => {
    // Free-mail clients are asked there. The server has always required it and
    // still does — relaxing the form without relaxing the server would fail at
    // submit instead of at the field.
    const missing = stepValidators.role.safeParse({ roleTitle: "Senior Accountant" });
    expect(missing.success).toBe(false);
    const present = stepValidators.role.safeParse({
      roleTitle: "Senior Accountant",
      companyWebsite: "northwindhealth.com",
    });
    expect(present.success).toBe(true);
  });

  it("renders the website question only when the email could not answer it", () => {
    const intake = strip(src("src/routes/intake.tsx"));
    expect(intake).toMatch(/!companyWebsiteFromEmail\(state\.workEmail\)\s*&&/);
  });

  it("names the steps for what they now do", () => {
    expect(INTAKE_STEPS[0].title).toMatch(/job description/i);
    expect(INTAKE_STEPS[1].title).toMatch(/what we read/i);
    expect(INTAKE_STEPS).toHaveLength(3);
  });
});

describe("the server contract did not move", () => {
  it("still requires everything it always required", () => {
    // The form changed when it asks. The server did not change what it needs.
    expect([...ALWAYS_REQUIRED_INTAKE_FIELDS]).toEqual([
      "companyName",
      "companyWebsite",
      "firstName",
      "lastName",
      "workEmail",
      "roleTitle",
      "requirements",
      "sponsorshipAvailable",
      "consent",
      "pilotAcknowledgement",
    ]);
  });

  it("still rejects a submission with no website, however it was collected", () => {
    const base = {
      idempotencyKey: "abcdefgh1234",
      companyName: "Northwind Health",
      firstName: "Rita",
      lastName: "Sequeira",
      workEmail: "rita@northwindhealth.com",
      roleTitle: "Senior Accountant",
      sponsorshipAvailable: "no",
      consent: true,
      pilotAcknowledgement: true,
    };
    const out = expressIntakeSchema.safeParse(base);
    expect(out.success, "a submission without a website must still be refused").toBe(false);
  });
});

describe("the description is read before anything is asked about the role", () => {
  const intake = strip(src("src/routes/intake.tsx"));

  it("validates the description on step 1", () => {
    const fn = intake.slice(intake.indexOf("const validateStep"), intake.indexOf("const goToStep"));
    const companyBranch = fn.slice(fn.indexOf('if (key === "company")'), fn.indexOf('if (key === "role")'));
    expect(companyBranch, "the description is asked on step 1, so it is checked there").toMatch(
      /jobDescriptionText/,
    );
  });

  it("keeps the JD control in a step-1 section", () => {
    expect(intake).toMatch(/id="section-jd" title="The job description" step=\{1\}/);
  });

  it("holds submit on the conflicts too, not only on missing answers", () => {
    // The review's "still missing" list can only describe an unanswered field.
    // Gating the buttons on that alone is what let a compensation conflict
    // leave an enabled-looking button that did nothing when clicked
    // (audit 16 Sep, INT-001). Every submit button must consult both lists.
    const buttons = intake.match(/disabled=\{\s*submitting[^}]*\}/g) ?? [];
    const submitButtons = buttons.filter((b) => b.includes("review.missing"));
    expect(submitButtons.length, "no gated submit button found").toBeGreaterThan(0);
    for (const b of submitButtons) {
      expect(b, "a submit button ignores the conflict list").toContain("submitBlockers.length");
    }
  });

  it("names those conflicts on screen rather than only beside the button", () => {
    expect(intake).toMatch(/submitBlockers\.map\(/);
  });

  it("derives the website without asking", () => {
    expect(intake).toMatch(/companyWebsiteFromEmail\(state\.workEmail\)/);
    expect(intake, "never over an answer the client gave").toMatch(
      /editedRef\.current\.has\("companyWebsite"\)/,
    );
  });
});
