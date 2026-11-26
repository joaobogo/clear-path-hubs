// A recruiter corrects what a candidate's profile says: the headline, the
// summary, or the experience entries (title, company, dates, summary).
//
// The scorer reads profile text only where the profile records that a person
// wrote it (scoring/profile-text.ts). This is the path that writes that
// record: each field it changes is stamped as corrected by the member of
// staff, with the reason, and the change is audited field by field. The
// database then flags the candidate's live matches for a re-score. Nothing
// here approves, publishes or emails.

import type { StaffActionContext } from "@/lib/staff-action-context";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { stampRecruiterEdit, type ProfileField } from "@/lib/scoring/profile-text";

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

const line = (max: number) => z.string().trim().max(max);
const experienceEntry = z.object({
  title: line(200),
  company: line(200),
  start: line(40),
  end: line(40),
  summary: z.string().trim().max(4000),
});

export const editProfileNarrativeValidate = (i: unknown) =>
  z
    .object({
      candidate_profile_id: z.string().uuid(),
      /** Where the correction comes from, e.g. "Dates corrected to LinkedIn, 26 Nov". */
      reason: z.string().trim().min(8).max(500),
      headline: line(300).optional(),
      summary: z.string().trim().max(6000).optional(),
      experience: z.array(experienceEntry).max(40).optional(),
      /**
       * Record that these fields, as they stand, were written by a recruiter,
       * without changing them: for a correction made before this record
       * existed.
       */
      confirm_fields: z
        .array(z.enum(["headline", "summary", "experience"]))
        .max(3)
        .optional(),
    })
    .refine(
      (v) =>
        v.headline !== undefined ||
        v.summary !== undefined ||
        v.experience !== undefined ||
        (v.confirm_fields?.length ?? 0) > 0,
      { message: "Nothing to change." },
    )
    .parse(i);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const editProfileNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(editProfileNarrativeValidate)
  .handler(editProfileNarrativeHandler);

export async function editProfileNarrativeHandler({
  data,
  context,
}: {
  data: ReturnType<typeof editProfileNarrativeValidate>;
  context: StaffActionContext;
}) {
  await requireStaff(context.userId);
  const s = await getAdmin();
  const { data: before, error: readErr } = await s
    .from("candidate_profiles")
    .select("id,headline,summary,experience,consent")
    .eq("id", data.candidate_profile_id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!before) throw new Error("profile_not_found");

  const patch: Record<string, unknown> = {};
  const changed: ProfileField[] = [];
  if (data.headline !== undefined && !same(before.headline ?? "", data.headline)) {
    patch.headline = data.headline || null;
    changed.push("headline");
  }
  if (data.summary !== undefined && !same(before.summary ?? "", data.summary)) {
    patch.summary = data.summary || null;
    changed.push("summary");
  }
  if (data.experience !== undefined && !same(before.experience ?? [], data.experience)) {
    patch.experience = data.experience;
    changed.push("experience");
  }
  const stamped = [...new Set<ProfileField>([...changed, ...(data.confirm_fields ?? [])])];
  if (stamped.length === 0) {
    return { ok: true as const, updated: [] as ProfileField[], recorded: [] as ProfileField[] };
  }

  const at = new Date().toISOString();
  patch.consent = stampRecruiterEdit(before.consent, stamped, {
    user_id: context.userId,
    at,
    note: data.reason,
  });
  const { error } = await s
    .from("candidate_profiles")
    .update(patch)
    .eq("id", data.candidate_profile_id);
  if (error) throw new Error(error.message);

  const fieldState = (row: AnyRow) =>
    Object.fromEntries(changed.map((f) => [f, row?.[f] ?? null])) as Record<string, unknown>;
  const { error: auditErr } = await s.from("audit_events").insert({
    actor_user_id: context.userId,
    entity_type: "candidate_profiles",
    entity_id: data.candidate_profile_id,
    action: "admin_profile_narrative_edit",
    before_state: fieldState(before) as never,
    after_state: {
      ...fieldState(patch),
      reason: data.reason,
      recorded_as_recruiter_written: stamped,
    } as never,
  });
  if (auditErr) {
    console.error(
      "[profile-narrative] audit insert failed",
      data.candidate_profile_id,
      auditErr.message,
    );
  }
  return { ok: true as const, updated: changed, recorded: stamped };
}
