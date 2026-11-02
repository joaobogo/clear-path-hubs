// Public application status lookup — reference + email, no account required.
// Thin wrapper: all logic lives in ./candidate/apply-status.server.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  answerInfoRequestByReference,
  loadPublicStatus,
  withdrawByReference,
} from "./candidate/apply-status.server";
import { throttlePublicFn } from "@/lib/public-api/server-fn-guard";
import { answerSchema } from "./apply-schema";

export type { PublicApplicationStatus, PublicInfoRequest } from "./candidate/apply-status.server";
export type {
  MyScreeningQuestions,
  PublicScreeningQuestion,
} from "./candidate/screening-answers.server";

export const statusLookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "Enter the 6-character reference from your confirmation"),
  email: z.string().trim().toLowerCase().email("Enter the email you applied with"),
});

export const infoResponseSchema = statusLookupSchema.extend({
  requestId: z.string().uuid(),
  response: z.string().trim().min(1, "Write your reply first").max(4000),
});

export const lookupApplicationStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusLookupSchema.parse(input))
  .handler(({ data }) => {
    throttlePublicFn("apply_lookup");
    return loadPublicStatus(data.reference, data.email);
  });

export const withdrawMyApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusLookupSchema.parse(input))
  .handler(({ data }) => {
    throttlePublicFn("candidate_write");
    return withdrawByReference(data.reference, data.email);
  });

export const respondToInfoRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => infoResponseSchema.parse(input))
  .handler(({ data }) => {
    throttlePublicFn("candidate_write");
    return answerInfoRequestByReference(data);
  });

export const screeningAnswersSchema = statusLookupSchema.extend({
  answers: z.array(answerSchema).max(50),
});

// The role's screening questions for an application that never saw the apply
// form (a CV sent by email, a staff entry, an import). Reference + email.
export const getMyScreeningQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusLookupSchema.parse(input))
  .handler(async ({ data }) => {
    throttlePublicFn("apply_lookup");
    const { loadScreeningByReference } = await import("./candidate/screening-answers.server");
    return loadScreeningByReference(data.reference, data.email);
  });

export const submitMyScreeningAnswers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => screeningAnswersSchema.parse(input))
  .handler(async ({ data }) => {
    throttlePublicFn("candidate_write");
    const { answerScreeningByReference } = await import("./candidate/screening-answers.server");
    return answerScreeningByReference(data);
  });
