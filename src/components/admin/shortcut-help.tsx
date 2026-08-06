import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type Shortcut = { keys: string[]; label: string };

/** Small keycap. Use it inline on the control the shortcut drives. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border bg-muted px-1 text-[10px] font-medium leading-4 text-muted-foreground">
      {children}
    </kbd>
  );
}

/**
 * "?" opens a shortcut overlay. Shortcuts are only discoverable if they are
 * visible, so this pairs with inline <Kbd> hints on the controls themselves.
 */
export function useShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}

export function ShortcutHelpButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs"
      onClick={onOpen}
      aria-label="Keyboard shortcuts"
      title="Keyboard shortcuts (?)"
    >
      <Keyboard className="h-3.5 w-3.5" />
      <Kbd>?</Kbd>
    </Button>
  );
}

export function ShortcutHelpDialog({
  open,
  onOpenChange,
  shortcuts,
  title = "Keyboard shortcuts",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Shortcut[];
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Shortcuts are ignored while you are typing in a field. Press ? again to close.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y text-sm">
          {shortcuts.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 py-2">
              <span>{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
