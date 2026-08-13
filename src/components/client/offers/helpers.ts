import {
  ClipboardList,
  Send,
  Handshake,
  Check,
  X,
  Trophy,
  BadgeAlert,
} from "lucide-react";
import type { HireStatus } from "@/lib/hires.functions";

// Pure, board-shape data shared by the offers route and its row/column
// components. Kept here (rather than duplicated per-component) so the
// column order and status→style mapping stay in one place.

export const COLUMN_ORDER: HireStatus[] = [
  "offer_drafted",
  "offer_sent",
  "offer_negotiating",
  "offer_accepted",
  "hire_confirmed",
  "offer_declined",
  "closed_lost",
];

export const COLUMN_ICON: Record<HireStatus, React.ComponentType<{ className?: string }>> = {
  offer_drafted: ClipboardList,
  offer_sent: Send,
  offer_negotiating: Handshake,
  offer_accepted: Check,
  offer_declined: X,
  hire_confirmed: Trophy,
  closed_lost: BadgeAlert,
};

export const COLUMN_TONE: Record<HireStatus, string> = {
  offer_drafted: "border-muted-foreground/30 bg-muted/10",
  offer_sent: "border-info/60 bg-info/60",
  offer_negotiating: "border-primary/60 bg-primary/60",
  offer_accepted: "border-success/60 bg-success/60",
  offer_declined: "border-warning/60 bg-warning/60",
  hire_confirmed: "border-primary/40 bg-primary/5",
  closed_lost: "border-destructive/60 bg-destructive/60",
};

export const NEXT_STEPS: Record<HireStatus, HireStatus[]> = {
  offer_drafted: ["offer_sent", "closed_lost"],
  offer_sent: ["offer_negotiating", "offer_accepted", "offer_declined", "closed_lost"],
  offer_negotiating: ["offer_accepted", "offer_sent", "offer_declined", "closed_lost"],
  offer_accepted: ["hire_confirmed", "closed_lost"],
  offer_declined: ["offer_drafted", "closed_lost"],
  hire_confirmed: ["closed_lost"],
  closed_lost: ["offer_drafted"],
};

export function nextStepLabel(to: HireStatus): string {
  switch (to) {
    case "hire_confirmed":
      return "Confirm hire";
    case "offer_sent":
      return "Send offer";
    case "offer_accepted":
      return "Accepted";
    case "offer_declined":
      return "Declined";
    case "closed_lost":
      return "Close lost";
    default:
      return "Redraft";
  }
}

export function formatSalary(hire: {
  salary_amount: number | null;
  salary_currency: string | null;
  salary_period: string | null;
}): string | null {
  if (hire.salary_amount == null) return null;
  return `${hire.salary_currency ?? ""} ${new Intl.NumberFormat().format(
    hire.salary_amount,
  )}${hire.salary_period ? `/${hire.salary_period}` : ""}`.trim();
}
