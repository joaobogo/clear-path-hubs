import * as React from "react";
import { Bold, Italic, Underline } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeInlineMarkup } from "@/lib/marketing/inline-format";

function toEditorHtml(value: string): string {
  return sanitizeInlineMarkup(value).replace(/\n/g, "<br>");
}

/**
 * A deliberately small rich-text field: bold, italic and underline only.
 * Everything typed or pasted is reduced to plain text plus those three styles
 * before it leaves the component, so the stored value never carries markup the
 * public listing could not render.
 */
export function RichTextInput({
  value,
  onChange,
  placeholder,
  rows = 6,
  className,
  ariaLabel,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  ariaLabel?: string;
  id?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const emitted = React.useRef<string>("");

  // Only write into the DOM when the incoming value is not what we last
  // emitted; otherwise every keystroke would reset the caret.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === emitted.current) return;
    emitted.current = value;
    el.innerHTML = toEditorHtml(value ?? "");
  }, [value]);

  const emit = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = sanitizeInlineMarkup(el.innerHTML);
    emitted.current = next;
    onChange(next);
  }, [onChange]);

  const apply = (command: "bold" | "italic" | "underline") => {
    ref.current?.focus();
    document.execCommand(command);
    emit();
  };

  const isEmpty = !(value ?? "").trim();

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      <div className="flex items-center gap-1 border-b border-input px-1.5 py-1">
        {(
          [
            ["bold", Bold, "Bold"],
            ["italic", Italic, "Italic"],
            ["underline", Underline, "Underline"],
          ] as const
        ).map(([command, Icon, label]) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(command)}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="relative">
        {isEmpty && placeholder ? (
          <p className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </p>
        ) : null}
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            // Paste is always reduced to plain text; the toolbar is the only
            // way to add a style.
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
            emit();
          }}
          style={{ minHeight: `${Math.max(rows, 3) * 1.5}rem` }}
          className="w-full whitespace-pre-wrap break-words px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
    </div>
  );
}
