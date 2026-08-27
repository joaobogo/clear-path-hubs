/**
 * Formatting controls for a markdown textarea.
 *
 * The job description field has always stored markdown — the parser and every
 * surface that renders a description expect it — but the client was left to
 * type the syntax by hand, so briefs arrived with literal "**" and "##" in
 * them, or with no structure at all.
 *
 * This writes the same markdown into the same textarea rather than swapping in
 * a rich-text editor: no new dependency, no second content format to migrate,
 * and pasting a description from a document still works exactly as before.
 */
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react";

type Selection = { start: number; end: number };

/** Wrap the selection in a marker, or unwrap it when already wrapped. */
export function toggleWrap(value: string, sel: Selection, marker: string) {
  const { start, end } = sel;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const len = marker.length;

  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      next: before.slice(0, -len) + selected + after.slice(len),
      selection: { start: start - len, end: end - len },
    };
  }
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= len * 2) {
    const inner = selected.slice(len, -len);
    return { next: before + inner + after, selection: { start, end: start + inner.length } };
  }
  return {
    next: `${before}${marker}${selected}${marker}${after}`,
    selection: { start: start + len, end: end + len },
  };
}

/** Apply a prefix to every line the selection touches, or remove it. */
export function togglePrefix(
  value: string,
  sel: Selection,
  prefix: (index: number) => string,
  matcher: RegExp,
) {
  const lineStart = value.lastIndexOf("\n", sel.start - 1) + 1;
  const lineEndRaw = value.indexOf("\n", sel.end);
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const allPrefixed = lines.every((l) => l.trim() === "" || matcher.test(l));

  const rebuilt = lines
    .map((line, i) => {
      if (line.trim() === "") return line;
      return allPrefixed ? line.replace(matcher, "") : `${prefix(i)}${line}`;
    })
    .join("\n");

  return {
    next: value.slice(0, lineStart) + rebuilt + value.slice(lineEnd),
    selection: { start: lineStart, end: lineStart + rebuilt.length },
  };
}

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  // The textarea is controlled, so the caret has to be restored after React
  // has re-rendered with the new value — not in the click handler.
  const pending = useRef<Selection | null>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !pending.current) return;
    const { start, end } = pending.current;
    pending.current = null;
    el.focus();
    el.setSelectionRange(start, end);
  }, [value, textareaRef]);

  const apply = useCallback(
    (fn: (v: string, sel: Selection) => { next: string; selection: Selection }) => {
      const el = textareaRef.current;
      if (!el) return;
      const sel = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
      const { next, selection } = fn(value, sel);
      pending.current = selection;
      onChange(next);
    },
    [onChange, textareaRef, value],
  );

  const actions = [
    {
      key: "bold",
      label: "Bold",
      hint: "Bold (Ctrl+B)",
      icon: <Bold className="h-3.5 w-3.5" aria-hidden />,
      run: () => apply((v, s) => toggleWrap(v, s, "**")),
    },
    {
      key: "italic",
      label: "Italic",
      hint: "Italic (Ctrl+I)",
      icon: <Italic className="h-3.5 w-3.5" aria-hidden />,
      run: () => apply((v, s) => toggleWrap(v, s, "*")),
    },
    {
      key: "heading",
      label: "Heading",
      hint: "Heading",
      icon: <Heading2 className="h-3.5 w-3.5" aria-hidden />,
      run: () => apply((v, s) => togglePrefix(v, s, () => "## ", /^#{1,6}\s+/)),
    },
    {
      key: "bullet",
      label: "Bulleted list",
      hint: "Bulleted list",
      icon: <List className="h-3.5 w-3.5" aria-hidden />,
      run: () => apply((v, s) => togglePrefix(v, s, () => "- ", /^[-*]\s+/)),
    },
    {
      key: "numbered",
      label: "Numbered list",
      hint: "Numbered list",
      icon: <ListOrdered className="h-3.5 w-3.5" aria-hidden />,
      run: () => apply((v, s) => togglePrefix(v, s, (i) => `${i + 1}. `, /^\d+\.\s+/)),
    },
  ];

  return (
    <div
      className={`flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 px-1.5 py-1 ${className}`}
      role="toolbar"
      aria-label="Job description formatting"
    >
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          disabled={disabled}
          onClick={a.run}
          title={a.hint}
          aria-label={a.label}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {a.icon}
        </button>
      ))}
      <span className="ml-1 text-[11px] text-muted-foreground">Markdown</span>
    </div>
  );
}

/** Ctrl/Cmd+B and Ctrl/Cmd+I on the textarea itself. */
export function useMarkdownShortcuts(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (next: string) => void,
) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "b" && key !== "i") return;
      const el = textareaRef.current;
      if (!el) return;
      e.preventDefault();
      const sel = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
      const { next, selection } = toggleWrap(value, sel, key === "b" ? "**" : "*");
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(selection.start, selection.end);
      });
    },
    [onChange, textareaRef, value],
  );
}
