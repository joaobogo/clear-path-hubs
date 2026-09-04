/**
 * The candidate's introduction video, playing in place on their profile.
 *
 * Renders nothing at all when no video is attached — no empty player, no
 * placeholder, no dead control, no line explaining an absence. When one exists
 * it plays inline, high on the page, so the client sees and hears the person
 * without leaving the profile. A link that no longer resolves degrades to one
 * plain line and leaves the rest of the page untouched.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { resolveIntroVideo } from "@/lib/candidate-video.functions";

/** "2 min 40 sec" reads as a couple of minutes, not a commitment. */
export function formatVideoLength(seconds: number | null | undefined): string | null {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return null;
  const rounded = Math.round(total);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (mins === 0) return `${secs} sec`;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} sec`;
}

export function IntroVideoPanel({
  matchId,
  video,
  candidateName,
  className,
}: {
  matchId: string;
  video: { url: string; embed_url: string } | null | undefined;
  candidateName: string;
  className?: string;
}) {
  const resolve = useServerFn(resolveIntroVideo);
  const probe = useQuery({
    queryKey: ["intro-video", matchId],
    queryFn: () => resolve({ data: { match_id: matchId } }),
    enabled: Boolean(video && matchId),
    staleTime: 5 * 60 * 1000,
  });

  if (!video) return null;

  const dead = probe.data && probe.data.available === false;
  if (dead) {
    return (
      <p className={className ? `${className} text-sm text-muted-foreground` : "text-sm text-muted-foreground"}>
        This candidate&apos;s video introduction is no longer available.
      </p>
    );
  }

  const length = formatVideoLength(probe.data?.duration_seconds);

  return (
    <section
      aria-label={`Video introduction from ${candidateName}`}
      className={
        className
          ? `${className} overflow-hidden rounded-xl border bg-card`
          : "overflow-hidden rounded-xl border bg-card"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
        <h2 className="text-sm font-semibold">
          {candidateName.split(" ")[0] ?? candidateName} introduces themselves
        </h2>
        {length && <span className="text-xs text-muted-foreground">{length}</span>}
      </div>
      {/* Warm the connection before the iframe asks for anything: the DNS
          lookup, TCP handshake and TLS negotiation to Loom all happen while
          the rest of the page is still rendering, so the player has a live
          connection waiting rather than starting from cold. */}
      <link rel="preconnect" href="https://www.loom.com" />
      <link rel="preconnect" href="https://cdn.loom.com" crossOrigin="" />
      <link rel="dns-prefetch" href="https://www.loom.com" />
      <div className="relative mt-3 aspect-video w-full bg-muted">
        <iframe
          src={video.embed_url}
          title={`Video introduction from ${candidateName}`}
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          // Eager, not lazy. This panel only renders when a candidate HAS an
          // introduction, and it is one of the first things a client wants to
          // watch — deferring it until it scrolls into view meant waiting for
          // the player at the exact moment of clicking.
          loading="eager"
          // The player is the point of this panel, so it gets priority over
          // the images further down the page.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ fetchpriority: "high" } as any)}
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </section>
  );
}
