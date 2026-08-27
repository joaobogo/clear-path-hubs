/**
 * The candidate's introduction video on the client-facing profile.
 *
 * Renders nothing at all when no video is attached — no empty player, no
 * placeholder, no dead control. When one exists it plays in a panel over the
 * page so the client never leaves the profile.
 */
import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function IntroVideoPanel({
  video,
  candidateName,
}: {
  video: { url: string; embed_url: string } | null | undefined;
  candidateName: string;
}) {
  const [open, setOpen] = useState(false);
  if (!video) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40"
      >
        <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <PlayCircle className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Watch the introduction</span>
          <span className="block text-xs text-muted-foreground">
            A short video introducing {candidateName}
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Introduction — {candidateName}</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            {open && (
              <iframe
                src={video.embed_url}
                title={`Introduction video for ${candidateName}`}
                allow="fullscreen; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
