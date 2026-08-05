import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { DeliveryCommitment } from "@/lib/delivery-commitment";

/**
 * The delivery commitment block: what the client gets, by when, what we need
 * back, and who to ask. Used on the intake confirmation and on the role page so
 * both read from the same stored commitment and can never disagree.
 */
export function DeliveryCommitmentBlock({
  commitment,
  reference,
  loading = false,
  datesFollowByEmail = false,
  heading = "What TaaSFlow will deliver",
}: {
  commitment: DeliveryCommitment | null;
  /** Submission reference, shown and copyable where one exists. */
  reference?: string | null;
  loading?: boolean;
  /** Set when the commitment could not be read — never guess dates instead. */
  datesFollowByEmail?: boolean;
  heading?: string;
}) {
  if (loading) {
    return (
      <section aria-label={heading} aria-busy className="rounded-lg border p-4">
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label={heading} className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{heading}</h2>

      {datesFollowByEmail ? (
        <p className="text-sm text-muted-foreground">
          We could not load your delivery dates just now. Nothing is lost — your role is saved and
          the dates follow by email.
        </p>
      ) : commitment?.hasCommitment ? (
        <dl className="divide-y text-sm">
          {commitment.rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="text-right font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">{commitment?.pendingMessage}</p>
      )}

      {commitment?.clientTurnaround && (
        <div className="text-sm">
          <p className="font-medium">What we need from you</p>
          <p className="text-muted-foreground">{commitment.clientTurnaround}</p>
        </div>
      )}

      {commitment && (
        <div className="text-sm">
          <p className="font-medium">Your point of contact</p>
          <p className="text-muted-foreground">{commitment.contactLine}</p>
        </div>
      )}

      {reference && <ReferenceLine reference={reference} />}
    </section>
  );
}

function ReferenceLine({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
      <span className="text-muted-foreground">Submission reference</span>
      <span className="font-mono" data-testid="submission-reference">
        {reference}
      </span>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(reference)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => setCopied(false));
        }}
        aria-live="polite"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" aria-hidden /> Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" aria-hidden /> Copy
          </>
        )}
      </button>
    </div>
  );
}
