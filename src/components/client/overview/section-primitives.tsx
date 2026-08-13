import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveFirstRunState } from "@/lib/empty-states/empty-state-catalogue";

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
    <SurfaceState
      content={{
        ...resolveFirstRunState(),
        action: canSubmit ? resolveFirstRunState().action : undefined,
        secondaryAction: canSubmit ? resolveFirstRunState().secondaryAction : undefined,
      }}
    />
  );
}

