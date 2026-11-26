// Staff entry of screening answers on a candidate's behalf, and the confirm
// step before publishing a candidate whose answers are recruiter-entered.
// Both are staff-gated and audited; neither approves, publishes or emails.

import type { StaffActionContext } from "@/lib/staff-action-context";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { SOURCE_NOTE_MAX } from "./answer-source";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyRow;
}

async function requireStaff(userId: string) {
  const s = await getAdmin();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

const answerValue = z.union([
  z.string().max(4000),
  z.boolean(),
  z.number().finite(),
  z.array(z.string().max(400)).max(40),
  z.null(),
]);

export const recordAnswersOnBehalfValidate = (i: unknown) =>
  z
    .object({
      match_id: z.string().uuid(),
      source_note: z.string().max(SOURCE_NOTE_MAX + 200),
      answers: z
        .array(z.object({ question_id: z.string().uuid(), value: answerValue }))
        .min(1)
        .max(40),
    })
    .parse(i);

/** Store answers a recruiter gathered from another channel, labelled as such. */
export const recordAnswersOnBehalf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(recordAnswersOnBehalfValidate)
  .handler(recordAnswersOnBehalfHandler);

export async function recordAnswersOnBehalfHandler({
  data,
  context,
}: {
  data: ReturnType<typeof recordAnswersOnBehalfValidate>;
  context: StaffActionContext;
}) {
  await requireStaff(context.userId);
  const m = await import("./answers-on-behalf.server");
  return m.recordAnswersOnBehalf(await getAdmin(), {
    matchId: data.match_id,
    actorUserId: context.userId,
    sourceNote: data.source_note,
    answers: data.answers,
  });
}

export const acknowledgeRecruiterAnswersValidate = (i: unknown) =>
  z.object({ match_id: z.string().uuid() }).parse(i);

/** The recruiter's confirm step before publishing with recruiter-entered answers. */
export const acknowledgeRecruiterAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(acknowledgeRecruiterAnswersValidate)
  .handler(acknowledgeRecruiterAnswersHandler);

export async function acknowledgeRecruiterAnswersHandler({
  data,
  context,
}: {
  data: ReturnType<typeof acknowledgeRecruiterAnswersValidate>;
  context: StaffActionContext;
}) {
  await requireStaff(context.userId);
  const m = await import("./answers-on-behalf.server");
  return m.acknowledgeRecruiterAnswers(await getAdmin(), {
    matchId: data.match_id,
    actorUserId: context.userId,
  });
}
