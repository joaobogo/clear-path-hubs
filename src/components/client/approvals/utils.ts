import { calendarDayDiff, formatDate, formatRelativeSigned } from "@/lib/format/datetime";
export function relTime(iso: string | null | undefined): string {
  return formatRelativeSigned(iso);
}
