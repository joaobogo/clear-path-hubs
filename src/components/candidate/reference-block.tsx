import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The reference is the one thing a candidate must be able to keep. On a phone it
 * must be selectable and copyable in one tap, and it must survive printing and
 * email forwarding — so the value itself is always plain, selectable text.
 */
export function ReferenceBlock({
  reference,
  className,
}: {
  reference: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (older mobile browsers, insecure context) — the text
      // stays selectable, which is the fallback that always works.
      setCopied(false);
    }
  }

  return (
    <div className={`rounded-md border bg-muted px-4 py-3 text-left ${className ?? ""}`}>
      <span className="block text-xs uppercase tracking-wide text-muted-foreground">
        Your reference
      </span>
      <div className="mt-1 flex items-center gap-3">
        <span
          className="select-all font-mono text-xl font-semibold tracking-[0.2em]"
          data-testid="application-reference"
        >
          {reference}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-background print:hidden"
          aria-label={copied ? "Reference copied" : `Copy reference ${reference}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? "Reference copied to clipboard" : ""}
      </span>
    </div>
  );
}
