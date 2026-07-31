// Public application status lookup — reference + email, no account required.
// Deliberately returns plain-language status only. Never exposes scores,
// evidence, rubric data, admin notes or internal state names.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const statusLookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "Enter the 6-character reference from your confirmation"),
  email: z.string().trim().toLowerCase().email("Enter the email you applied with"),
});

export type PublicApplicationStatus = {
  reference: string;
  applied_at: string;
  position_title: string | null;
  organization_name: string | null;
  candidate_first_name: string | null;
  withdrawn: boolean;
  /** Ordered journey; exactly one entry is `current`. */
  steps: Array<{
    key: string;
    label: string;
    detail: string;
    state: "done" | "current" | "upcoming" | "closed";
  }>;
  headline: string;
  next_note: string;
};

const JOURNEY = [
  { key: "received", label: "Received", detail: "We have your application and CV." },
  { key: "review", label: "Under review", detail: "Our team is reading your CV and answers." },
  {
    key: "shared",
    label: "Shared with the employer",
    detail: "Your profile has been sent to the hiring team.",
  },
  {
    key: "interview",
    label: "Interview stage",
    detail: "The employer is speaking with you about the role.",
  },
] as const;

type JourneyKey = (typeof JOURNEY)[number]["key"];

function reachedFor(stage: string | null, appStatus: string): JourneyKey {
  if (stage === "interview_process" || stage === "offer" || stage === "hired") return "interview";
  if (stage === "delivered" || stage === "shortlisted") return "shared";
  if (appStatus === "processing" || appStatus === "ready_for_review" || stage === "reviewing")
    return "review";
  return "received";
}

export const lookupApplicationStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => statusLookupSchema.parse(input))
  .handler(async ({ data }): Promise<PublicApplicationStatus | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The reference is the first 6 hex chars of the application uuid.
    const prefix = data.reference.toLowerCase();
    const { data: rows, error } = await supabaseAdmin
      .from("applications")
      .select(
        "id,applied_at,status,withdrawn_at,positions(title,organizations(name)),candidate_profiles(full_name,email),candidate_matches(stage,client_visibility)",
      )
      .limit(200);
    if (error || !rows) return null;

    const app = rows.find((r) => {
      const ref = String(r.id).replace(/-/g, "").slice(0, 6).toLowerCase();
      if (ref !== prefix) return false;
      const cp = r.candidate_profiles as unknown as { email?: string } | null;
      return (cp?.email ?? "").trim().toLowerCase() === data.email;
    });
    if (!app) return null;

    const pos = app.positions as unknown as {
      title: string;
      organizations: { name: string } | null;
    } | null;
    const cp = app.candidate_profiles as unknown as { full_name?: string } | null;
    const matches = (app.candidate_matches ?? []) as unknown as Array<{
      stage: string | null;
      client_visibility: string | null;
    }>;
    const stage = matches[0]?.stage ?? null;
    const visible = matches[0]?.client_visibility === "visible";

    const closed =
      Boolean(app.withdrawn_at) ||
      app.status === "rejected" ||
      app.status === "archived" ||
      stage === "not_moving_forward" ||
      stage === "archived";

    const reached = reachedFor(visible ? stage : stage === "interview_process" || stage === "offer" || stage === "hired" ? stage : null, app.status);
    const reachedIndex = JOURNEY.findIndex((s) => s.key === reached);

    const steps = JOURNEY.map((s, i) => ({
      key: s.key,
      label: s.label,
      detail: s.detail,
      state: closed
        ? i <= reachedIndex
          ? ("done" as const)
          : ("closed" as const)
        : i < reachedIndex
          ? ("done" as const)
          : i === reachedIndex
            ? ("current" as const)
            : ("upcoming" as const),
    }));

    const headline = closed
      ? app.withdrawn_at
        ? "Application withdrawn"
        : "This application is now closed"
      : JOURNEY[reachedIndex].label;

    const next_note = closed
      ? app.withdrawn_at
        ? "You withdrew this application. You're welcome to apply to other roles any time."
        : "The team is not moving forward with this application. Other roles on our board are still open to you."
      : reached === "received"
        ? "Nothing needed from you. We'll email you when the review is done."
        : reached === "review"
          ? "Nothing needed from you yet. We'll email you if we're sharing your profile with the employer."
          : reached === "shared"
            ? "The employer is reviewing your profile. We'll email you as soon as they respond."
            : "Watch your inbox for interview details. Reply to that email if timings don't work.";

    return {
      reference: data.reference,
      applied_at: app.applied_at,
      position_title: pos?.title ?? null,
      organization_name: pos?.organizations?.name ?? null,
      candidate_first_name: (cp?.full_name ?? "").trim().split(" ")[0] || null,
      withdrawn: Boolean(app.withdrawn_at),
      steps,
      headline,
      next_note,
    };
  });
