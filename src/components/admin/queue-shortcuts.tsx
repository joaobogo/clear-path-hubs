/**
 * The shortcut legend every admin queue shows, so the keyboard path is
 * discoverable rather than folklore.
 */
import { Keyboard } from "lucide-react";
import { QUEUE_SHORTCUTS } from "@/lib/admin/queue-keyboard";
import { cn } from "@/lib/utils";

export function QueueShortcuts({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 font-medium">
        <Keyboard className="h-3.5 w-3.5" aria-hidden />
        Keyboard
      </span>
      {QUEUE_SHORTCUTS.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1">
          {s.keys.map((k) => (
            <kbd
              key={k}
              className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px] leading-none"
            >
              {k}
            </kbd>
          ))}
          <span>{s.label}</span>
        </span>
      ))}
    </p>
  );
}
