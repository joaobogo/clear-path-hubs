/**
 * Admin-side attachment of a candidate's Loom introduction.
 *
 * The recruiting team attaches the link here; the client only watches it on the
 * candidate's client-facing profile. A non-Loom link is refused inline with a
 * plain sentence, and clearing the field removes the video.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCandidateIntroVideo } from "@/lib/candidate-video.functions";
import { LOOM_LINK_HINT, parseLoomLink, validateLoomLink } from "@/lib/media/loom-link";

export function IntroVideoCard({
  matchId,
  currentUrl,
}: {
  matchId: string;
  currentUrl: string | null;
}) {
  const qc = useQueryClient();
  const saved = parseLoomLink(currentUrl);
  const [draft, setDraft] = useState(saved?.url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (value: string) => {
    const checked = validateLoomLink(value);
    if (checked.error) {
      setError(checked.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await setCandidateIntroVideo({ data: { match_id: matchId, url: checked.link?.url ?? null } });
      toast.success(checked.link ? "Introduction video attached" : "Introduction video removed");
      await qc.invalidateQueries({ queryKey: ["admin-candidate", matchId] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold">Introduction video</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Shown to the client on this candidate&apos;s profile. {LOOM_LINK_HINT}
      </p>
      <form
        noValidate
        className="mt-3 flex flex-wrap items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save(draft);
        }}
      >
        <div className="min-w-[16rem] flex-1">
          <Input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder="https://www.loom.com/share/…"
            aria-invalid={error ? true : undefined}
            aria-label="Loom share link"
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setDraft("");
              void save("");
            }}
          >
            Remove
          </Button>
        )}
      </form>
      {saved && (
        <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-md bg-muted">
          <iframe
            src={saved.embedUrl}
            title="Candidate video introduction"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )}
      {saved && (
        <a
          href={saved.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-primary hover:underline"
        >
          Open attached video ↗
        </a>
      )}
    </div>
  );
}
