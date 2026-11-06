/**
 * The hiring team's question for the introduction video, as candidates see it
 * on the job page and above the apply form's video link field. One component,
 * so the two places cannot word it differently.
 *
 * Callers render it only when the role has a prompt (see
 * normalizeVideoPrompt); the video stays optional either way.
 */
import { VIDEO_PROMPT_LEAD } from "@/lib/jobs/video-prompt";

export function VideoPromptQuote({
  prompt,
  id,
  lead = "heading",
}: {
  prompt: string;
  id?: string;
  /** "heading" on the apply form, where the line leads the field; "note" under another title. */
  lead?: "heading" | "note";
}) {
  return (
    <div id={id}>
      <p
        className={
          lead === "heading"
            ? "text-sm font-medium text-foreground"
            : "text-xs text-muted-foreground"
        }
      >
        {VIDEO_PROMPT_LEAD}
      </p>
      <blockquote className="mt-1 border-l-2 border-primary/40 pl-3 text-sm text-foreground/90">
        &ldquo;{prompt}&rdquo;
      </blockquote>
    </div>
  );
}
