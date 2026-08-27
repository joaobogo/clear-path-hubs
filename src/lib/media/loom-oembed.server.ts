/**
 * Asking Loom whether a share link still resolves, and how long it runs.
 *
 * Loom's public oEmbed endpoint answers for links that are still shared, and
 * refuses for links that were deleted or unshared. That is exactly the signal
 * the profile needs: a live video plays in place, a dead one degrades to one
 * plain line instead of a broken frame.
 */

export type LoomProbe = {
  ok: boolean;
  /** Recording length in seconds when Loom reports it. */
  duration_seconds: number | null;
  title: string | null;
};

export async function probeLoomVideo(shareUrl: string): Promise<LoomProbe> {
  const endpoint = `https://www.loom.com/v1/oembed?url=${encodeURIComponent(shareUrl)}`;
  try {
    const res = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { ok: false, duration_seconds: null, title: null };
    const body = (await res.json()) as Record<string, unknown>;
    const raw = Number(body["duration"]);
    const title = typeof body["title"] === "string" ? (body["title"] as string) : null;
    return {
      ok: true,
      duration_seconds: Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null,
      title,
    };
  } catch {
    // A network failure is not proof the video is gone, so treat it as live and
    // let the player itself be the judge.
    return { ok: true, duration_seconds: null, title: null };
  }
}
