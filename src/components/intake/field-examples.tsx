import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, X } from "lucide-react";
import { intakeExamples, type IntakeExampleField } from "@/content/intake-examples";

/**
 * A collapsed "See an example" link for the fields clients stall on.
 *
 * The panel floats above the form rather than pushing it down, so opening it
 * never moves the field you were about to answer. Nothing is inserted unless the
 * client presses "Use this" — and what lands in the field is plain editable text
 * that goes through exactly the same validation as anything they typed.
 */
export function FieldExamples({
  field,
  roleTitle,
  onUse,
  label = "See an example",
}: {
  field: IntakeExampleField;
  roleTitle: string;
  onUse: (text: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const examples = intakeExamples(field, roleTitle);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--brand-teal)] underline-offset-2 hover:underline"
      >
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
        {label}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-20 mt-2 w-full max-w-xl space-y-3 rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-4 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
              How other hiring managers answer this
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close examples"
              className="text-[color:var(--brand-navy)]/50 hover:text-[color:var(--brand-navy)]"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <ul className="space-y-3">
            {examples.map((text) => (
              <li key={text} className="space-y-1.5">
                <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/85">{text}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onUse(text);
                    setOpen(false);
                  }}
                >
                  Use this
                </Button>
              </li>
            ))}
          </ul>

          <p className="text-xs text-[color:var(--brand-navy)]/60">
            Examples are here to show what good looks like. Nothing is added to your brief until you
            press "Use this", and you can edit it afterwards.
          </p>
        </div>
      )}
    </div>
  );
}
