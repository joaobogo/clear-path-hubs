import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SectionHeader({
  id,
  icon,
  title,
  action,
  size = "md",
}: {
  id?: string;
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        id={id}
        className={`flex items-center gap-2 font-semibold tracking-tight ${
          size === "sm" ? "text-sm" : "text-base sm:text-lg"
        }`}
      >
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/40 p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function EmptyWelcome({ canSubmit }: { canSubmit: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight">Welcome to your workspace</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Submit your first role and this page becomes a single list of decisions waiting on you —
        candidates to review, interviews to confirm, offers to close.
      </p>
      {canSubmit && (
        <Link to="/intake" className="mt-4 inline-block">
          <Button size="sm" className="min-h-11">
            Submit a role <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      )}
    </section>
  );
}
