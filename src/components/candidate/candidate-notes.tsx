/**
 * Two honest notes for candidates: how long reading a CV takes, and what we
 * keep afterwards. Both live here so the wording is identical on the receipt
 * and the public status page.
 */
import { Link } from "@tanstack/react-router";
import { SUPPORT_EMAIL } from "@/lib/candidate/candidate-transparency";

/** Typical time before a CV has been read end to end. */
export const CV_READ_WINDOW_LABEL = "usually a few minutes, occasionally up to an hour";

export function ProcessingWindowNote({ className }: { className?: string }) {
  return (
    <div className={className ?? "mt-6 rounded-lg border bg-muted/30 p-5"}>
      <h2 className="text-sm font-semibold">While we read your CV</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Reading a CV properly takes {CV_READ_WINDOW_LABEL} — longer documents and scans take the
        most time. You do not need to wait on this page or refresh it; nothing is lost while it
        runs.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        If a document defeats us, we ask you for a cleaner copy rather than guessing — and your
        application still goes to a human reviewer either way. Stuck for more than a day? Email{" "}
        {SUPPORT_EMAIL} with your reference and a person will pick it up.
      </p>
    </div>
  );
}

export function RetentionNote({ className }: { className?: string }) {
  return (
    <div className={className ?? "mt-6 rounded-lg border p-5"}>
      <h2 className="text-sm font-semibold">What we stored, and for how long</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        <li>
          Your CV, contact details and answers to this role&apos;s questions — kept for up to 24
          months so we can consider you for later roles.
        </li>
        <li>
          Shared with this employer only, and only once a reviewer has approved it. Never sold, and
          never used to train a public model.
        </li>
        <li>
          You can withdraw your application, replace your CV, or ask us to delete everything at any
          time — reply to any of our emails or write to {SUPPORT_EMAIL}.
        </li>
      </ul>
      <p className="mt-3 text-sm">
        <Link to="/privacy" className="underline underline-offset-2">
          Read the full privacy notice
        </Link>
      </p>
    </div>
  );
}
