/**
 * Attaching a candidate's Loom introduction.
 *
 * The recruiting team attaches the video from the admin workspace; clients only
 * ever watch it. That is enforced twice — this write path is staff-only, and the
 * column itself is staff-controlled at the database level.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateLoomLink } from "@/lib/media/loom-link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export const setCandidateIntroVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        match_id: z.string().uuid(),
        /** Empty text removes the video. */
        url: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as AnyRow;
    const { data: staff } = await admin.rpc("is_platform_staff", { _user: context.userId });
    if (!staff) throw new Error("forbidden");

    const checked = validateLoomLink(data.url ?? null);
    if (checked.error) throw new Error(checked.error);

    const link = checked.link;
    const { error } = await admin
      .from("candidate_matches")
      .update({
        intro_video_url: link?.url ?? null,
        intro_video_added_by: link ? context.userId : null,
        intro_video_added_at: link ? new Date().toISOString() : null,
      })
      .eq("id", data.match_id);
    if (error) throw new Error(error.message);

    return { intro_video: link ? { url: link.url, embed_url: link.embedUrl } : null };
  });
