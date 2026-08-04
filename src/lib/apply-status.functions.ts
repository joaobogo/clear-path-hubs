// Public application status lookup — reference + email, no account required.
// Thin wrapper: all logic lives in ./candidate/apply-status.server.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  answerInfoRequestByReference,
  loadPublicStatus,
  withdrawByReference,
} from "./candidate/apply-status.server";

export type { PublicApplicationStatus, PublicInfoRequest } from "./candidate/apply-status.server";

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
  .handler(({ data }) => loadPublicStatus(data.reference, data.email));

export const withdrawMyApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusLookupSchema.parse(input))
  .handler(({ data }) => withdrawByReference(data.reference, data.email));

export const respondToInfoRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => infoResponseSchema.parse(input))
  .handler(({ data }) => answerInfoRequestByReference(data));
