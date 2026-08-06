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
  offer_drafted: "border-slate-300 bg-slate-50 dark:bg-slate-900/40",
  offer_sent: "border-blue-300/60 bg-blue-50/60 dark:bg-blue-950/30",
  offer_negotiating: "border-violet-300/60 bg-violet-50/60 dark:bg-violet-950/30",
  offer_accepted: "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/30",
  offer_declined: "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/30",
  hire_confirmed: "border-primary/40 bg-primary/5",
  closed_lost: "border-rose-300/60 bg-rose-50/60 dark:bg-rose-950/30",
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
