import { z } from "zod";

/**
 * Express onboarding contract.
 *
 * The client gives us the minimum we cannot infer — who they are, how to reach
 * them, what the role is called, and the job description. Everything else in
 * the full intake is generated afterwards into the editable Role Blueprint.
 */

export const MAX_JD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_JD_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
  "text/rtf",
]);
export const ALLOWED_JD_EXT = new Set(["pdf", "docx", "txt", "rtf"]);
/**
 * Legacy binary .doc cannot be read in the edge runtime. We name it explicitly
 * so the client gets a fix ("save as PDF or DOCX") instead of a generic reject.
 */
export const UNREADABLE_JD_EXT = new Set(["doc"]);
export const JD_ACCEPT_ATTR = ".pdf,.docx,.txt,.rtf";
export const JD_ACCEPT_LABEL = "PDF, DOCX, TXT or RTF, up to 10 MB";

export const MIN_JD_TEXT = 80;
export const MIN_ACCOUNT_PASSWORD = 8;

export const jdFileSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(160),
  base64: z.string().min(1),
});

const linkedinField = (label: string) =>
  z
    .string()
    .trim()
    .max(255)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /linkedin\.com\//i.test(v), `Enter a valid ${label} LinkedIn URL`);

export const expressIntakeSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128),

    // Company
    companyName: z.string().trim().min(2, "Enter your company name").max(160),
    companyWebsite: z
      .string()
      .trim()
      .min(3, "Enter your company website")
      .max(255)
      .refine((v) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(v), "Enter a valid website"),
    companyLinkedin: linkedinField("company"),

    // Contact
    firstName: z.string().trim().min(1, "Enter your first name").max(80),
    lastName: z.string().trim().min(1, "Enter your last name").max(80),
    contactTitle: z.string().trim().max(120).optional().or(z.literal("")),
    workEmail: z.string().trim().toLowerCase().email("Enter a valid work email").max(255),
    phone: z.string().trim().min(6, "Enter a phone number we can reach you on").max(40),
    contactLinkedin: linkedinField("personal"),

    // Account
    // Optional: an already-authenticated client keeps their existing password.
    // When absent the server only accepts an email that already has an account.
    password: z
      .string()
      .min(MIN_ACCOUNT_PASSWORD, `Use at least ${MIN_ACCOUNT_PASSWORD} characters`)
      .max(128)
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().max(128).optional().or(z.literal("")),

    // Role
    roleTitle: z.string().trim().min(2, "Enter the job title").max(160),
    jobDescriptionText: z.string().trim().max(60000).optional().or(z.literal("")),
    jobDescriptionFile: jdFileSchema.optional().nullable(),

    consent: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
    pilotAcknowledgement: z.literal(true, {
      errorMap: () => ({ message: "Please confirm you understand how the pilot works" }),
    }),
    researchConsent: z.boolean().default(true),
    source: z.string().trim().max(80).default("express_onboarding"),
    // Silent spam trap — must stay empty.
    companyFax: z.string().max(200).optional().or(z.literal("")),
  })
  .refine((v) => (v.password ?? "") === (v.confirmPassword ?? ""), {
    path: ["confirmPassword"],
    message: "Both passwords must match",
  })
  .refine(
    (v) => (v.jobDescriptionText ?? "").trim().length >= MIN_JD_TEXT || !!v.jobDescriptionFile,
    {
      path: ["jobDescriptionText"],
      message: `Upload a job description file or paste at least ${MIN_JD_TEXT} characters`,
    },
  );


export type ExpressIntakeInput = z.infer<typeof expressIntakeSchema>;

export const EXPRESS_DRAFT_KEY = "taasflow.express.intake.v1";
export const EXPRESS_IDEMPOTENCY_KEY = "taasflow.express.intake.idem.v1";

export function jdFileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

/** Blueprint preparation stages, in the order the client sees them. */
export const BLUEPRINT_STAGES = [
  { key: "queued", label: "Role created in your workspace" },
  { key: "analyzing_jd", label: "Reading your job description" },
  { key: "researching_company", label: "Reviewing your public company information" },
  { key: "drafting_blueprint", label: "Building the role blueprint and scoring rubric" },
  { key: "ready", label: "Blueprint ready for your review" },
] as const;

export type BlueprintStage = (typeof BLUEPRINT_STAGES)[number]["key"] | "not_started" | "failed";

export function blueprintProgress(status: string): number {
  const idx = BLUEPRINT_STAGES.findIndex((s) => s.key === status);
  if (status === "failed") return 100;
  if (idx === -1) return 0;
  return Math.round(((idx + 1) / BLUEPRINT_STAGES.length) * 100);
}
