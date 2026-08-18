import * as React from "react";
import { Lock, ShieldCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const RULES: { title: string; body: string }[] = [
  {
    title: "You can see",
    body:
      "Role fit, evidence behind every claim, experience, location, availability, notice period, compensation expectations, full name, email, phone, and CV file — for candidates your recruiter has approved and published to this role.",
  },
  {
    title: "You cannot see yet",
    body:
      "Only candidates that have not yet been published to you. Once a candidate is published, their full contact details and CV are available here immediately.",
  },
  {
    title: "Need anything else?",
    body:
      "Use the actions on each candidate to request an interview, leave feedback, or ask our team a question.",
  },
];

/**
 * Small, honest line stating exactly what a client can and cannot see,
 * and at which stage candidate contact details are released.
 */
export function VisibilityNote({
  className = "",
  variant = "line",
}: {
  className?: string;
  variant?: "line" | "card";
}) {
  const trigger = (
    <button
      type="button"
      className="whitespace-nowrap underline underline-offset-2 decoration-dotted hover:text-foreground transition-colors"
    >
      What you can see
    </button>
  );

  const details = (
    <PopoverContent align="start" className="w-80 text-xs space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        Candidate visibility rules
      </div>
      {RULES.map((r) => (
        <div key={r.title} className="space-y-1">
          <div className="font-medium text-foreground">{r.title}</div>
          <p className="text-muted-foreground leading-relaxed">{r.body}</p>
        </div>
      ))}
    </PopoverContent>
  );

  if (variant === "card") {
    return (
      <div
        className={`rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2 ${className}`}
      >
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          Contact details (email, phone, CV file) are released when you advance a
          candidate to interview and they consent to the introduction.{" "}
          <Popover>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            {details}
          </Popover>
        </p>
      </div>
    );
  }

  return (
    <p
      className={`text-xs text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className}`}
    >
      <Lock className="h-3 w-3 shrink-0" />
      <span>
        Contact details are released at interview stage, with candidate consent.
      </span>
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        {details}
      </Popover>
    </p>
  );
}
