import { z } from "zod";

export const workModelEnum = z.enum(["remote", "hybrid", "onsite"]);

export const intakeSchema = z
  .object({
    // Step 1 — contact & company
    firstName: z.string().trim().min(1, "First name is required").max(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),
    workEmail: z.string().trim().toLowerCase().email("Enter a valid work email").max(255),
    companyName: z.string().trim().min(1, "Company name is required").max(160),

    // Step 2 — role overview
    roleTitle: z.string().trim().min(1, "Role title is required").max(160),
    workModel: workModelEnum,
    location: z.string().trim().max(160).optional().or(z.literal("")),
    employmentType: z.string().trim().max(80).optional().or(z.literal("")),
    seniority: z.string().trim().max(80).optional().or(z.literal("")),

    // Step 3 — requirements
    mustHaveSkills: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    jobDescription: z.string().trim().max(20000).optional().or(z.literal("")),
    preferredRequirements: z.string().trim().max(4000).optional().or(z.literal("")),
    dealbreakers: z.string().trim().max(2000).optional().or(z.literal("")),

    // Step 4 — hiring context
    targetCountries: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    compensation: z.string().trim().max(160).optional().or(z.literal("")),
    headcount: z.coerce.number().int().min(1).max(999).optional().or(z.nan()),
    hiringUrgency: z.string().trim().max(80).optional().or(z.literal("")),
    targetTitles: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    workAuthorization: z.string().trim().max(160).optional().or(z.literal("")),

    // Consent
    consent: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to submit" }),
    }),
  })
  .refine(
    (v) =>
      (v.mustHaveSkills?.filter(Boolean).length ?? 0) >= 3 ||
      (v.jobDescription ?? "").trim().length >= 40,
    {
      message:
        "Provide at least 3 must-have skills or a job description of at least 40 characters",
      path: ["mustHaveSkills"],
    },
  );

export type IntakeInput = z.infer<typeof intakeSchema>;

export const normalizeCompanyName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");

export const emailDomain = (email: string) => {
  const at = email.lastIndexOf("@");
  return at === -1 ? null : email.slice(at + 1).toLowerCase();
};

export const DRAFT_KEY = "taasflow.intake.draft.v1";
export const IDEMPOTENCY_KEY = "taasflow.intake.idem.v1";
