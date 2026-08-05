import { z } from "zod";

export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
// CVs are PDF-only across UI, backend, storage and processing.
export const ALLOWED_CV_MIME = new Set(["application/pdf"]);
export const ALLOWED_CV_EXT = new Set(["pdf"]);
export const MIN_PASSWORD_LENGTH = 8;

export const answerSchema = z.object({
  question_id: z.string().uuid(),
  value: z.union([z.string(), z.boolean(), z.number(), z.array(z.string())]).nullable(),
});

const optionalUrl = z
  .string()
  .trim()
  .max(400)
  .optional()
  .or(z.literal(""))
  .refine(
    (v) => !v || /^https?:\/\/\S+\.\S+/.test(v),
    "Enter a full link starting with https://",
  );

export const applySchema = z.object({
  position_id: z.string().uuid(),
  full_name: z.string().trim().min(2, "Enter your full name").max(160),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  phone: z.string().trim().min(6, "Enter a phone number we can reach you on").max(40),
  country: z.string().trim().min(2, "Select or enter your country").max(80),
  // Optional on purpose: mobile applicants should not be blocked by a
  // region field that many countries do not use.
  region: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(1, "Enter your city").max(120),
  cv: z.object({
    filename: z.string().min(1).max(255),
    mime: z.string().min(1).max(160),
    base64: z.string().min(1),
  }),
  cover_letter: z.string().trim().max(5000).optional().or(z.literal("")),
  portfolio_url: optionalUrl,
  linkedin_url: optionalUrl,
  website_url: optionalUrl,
  accommodation_request: z.string().trim().max(2000).optional().or(z.literal("")),
  answers: z.array(answerSchema).max(50).default([]),
  consent_terms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
  network_opt_in: z.boolean().default(false),
  source: z.string().trim().max(80).default("public_job_board"),
  // Optional account password: set when an unauthenticated applicant chooses
  // to create a candidate account so they can track their application.
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(128)
    .optional(),
  // Client-generated stable id so a double-tap or reload cannot double-submit.
  idempotency_key: z.string().min(8).max(64),
  // Seconds the candidate actually spent on the form. Feeds the median we
  // quote on the job page, so it is clamped server-side before storage.
  elapsed_seconds: z.number().finite().nonnegative().optional(),

});

export type ApplyInput = z.infer<typeof applySchema>;

export function composeLocation(parts: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  return [parts.city, parts.region, parts.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

export const APPLY_DRAFT_KEY = (positionId: string) =>
  `taasflow.apply.${positionId}.v2`;
export const APPLY_IDEMPOTENCY_KEY = (positionId: string) =>
  `taasflow.apply.${positionId}.idem.v2`;

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}
