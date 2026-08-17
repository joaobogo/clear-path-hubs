import { createFileRoute, Link } from "@tanstack/react-router";
import { FormShell } from "@/components/marketing/form-shell";
import { Button } from "@/components/ui/button";
import { Info, AlertTriangle } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/candidate/candidate-transparency";

export const Route = createFileRoute("/apply/eligibility-outcome")({
  head: () => ({
    meta: [
      { title: "Application Status — TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EligibilityOutcome,
});

function EligibilityOutcome() {
  return (
    <FormShell exitTo="/jobs" exitLabel="Browse more roles" width="md">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <div className="h-12 w-12 rounded-full bg-warning/10 text-warning flex items-center justify-center text-2xl">
          <Info className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Application status</h1>
        <div className="mt-4 space-y-4 text-muted-foreground">
          <p>
            Thank you for your interest. Based on your answers to the mandatory screening questions, we are unable to move forward with your application for this specific role at this time.
          </p>
          <div className="rounded-md border border-warning/30 bg-warning/5 p-4 flex gap-3 text-sm text-foreground">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            <p>
              Your details have been recorded, but you do not meet the minimum eligibility requirements defined for this position (e.g. work authorization or specific certifications).
            </p>
          </div>
          <p>
            We'll keep your profile on file and may contact you if a role better suited to your profile becomes available.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link to="/jobs">Browse other roles</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/me/index">View your profile</Link>
          </Button>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Questions? Contact our team at <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
      </p>
    </FormShell>
  );
}
