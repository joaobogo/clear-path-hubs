import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Copy } from "lucide-react";

/**
 * Collapsed disclosure for raw provider payloads, stack text and trace IDs.
 * The human sentence stays in the row; this holds the machine detail so a page
 * never renders the bug next to its own explanation.
 */
export function TechnicalDetail({
  payload,
  label = "Show technical detail",
  className,
}: {
  payload: string | null | undefined;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = (payload ?? "").trim();
  if (!text) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide technical detail" : label}
      </button>
      {open ? (
        <div className="mt-1 rounded-md border bg-muted/40 p-2">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
            {text}
          </pre>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 h-6 gap-1 px-1.5 text-[10px]"
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy for support"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
