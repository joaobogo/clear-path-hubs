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

/**
 * Does this candidate's introduction still resolve, and how long is it?
 *
 * Read through the caller's own session, so row-level security decides who may
 * ask: platform staff and members of the hiring organisation see the video, and
 * no other candidate ever can.
 */
export const resolveIntroVideo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ match_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { parseLoomLink } = await import("@/lib/media/loom-link");
    const { data: row, error } = await (context.supabase as AnyRow)
      .from("candidate_matches")
      .select("id, intro_video_url")
      .eq("id", data.match_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const link = parseLoomLink(row?.intro_video_url);
    if (!link) return { available: false as boolean, url: null, embed_url: null, duration_seconds: null };

    const { probeLoomVideo } = await import("@/lib/media/loom-oembed.server");
    const probe = await probeLoomVideo(link.url);
    return {
      available: probe.ok,
      url: link.url,
      embed_url: link.embedUrl,
      duration_seconds: probe.duration_seconds,
    };
  });
