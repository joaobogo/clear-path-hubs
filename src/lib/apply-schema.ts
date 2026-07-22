import { z } from "zod";

export const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_CV_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
export const ALLOWED_CV_EXT = new Set(["pdf", "doc", "docx"]);

export const answerSchema = z.object({
  question_id: z.string().uuid(),
  value: z.union([z.string(), z.boolean(), z.number(), z.array(z.string())]).nullable(),
});

export const applySchema = z.object({
  position_id: z.string().uuid(),
  full_name: z.string().trim().min(2, "Enter your full name").max(160),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  cv: z.object({
    filename: z.string().min(1).max(255),
    mime: z.string().min(1).max(160),
    base64: z.string().min(1),
  }),
  answers: z.array(answerSchema).max(50).default([]),
  consent_terms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms" }),
  }),
  network_opt_in: z.boolean().default(false),
  // Client-generated stable id so a double-tap or reload cannot double-submit.
  idempotency_key: z.string().min(8).max(64),
});

export type ApplyInput = z.infer<typeof applySchema>;

export const APPLY_DRAFT_KEY = (positionId: string) =>
  `taasflow.apply.${positionId}.v1`;
export const APPLY_IDEMPOTENCY_KEY = (positionId: string) =>
  `taasflow.apply.${positionId}.idem.v1`;

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}
