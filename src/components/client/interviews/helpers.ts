import { formatZonedTime } from "@/lib/time/zone-label";
import type { InterviewStatus, InterviewType } from "@/lib/interviews.functions";

export const TYPE_OPTIONS: { value: InterviewType; label: string }[] = [
  { value: "phone_screen", label: "Phone screen" },
  { value: "video_call", label: "Video call" },
  { value: "onsite", label: "Onsite" },
  { value: "technical", label: "Technical" },
  { value: "panel", label: "Panel" },
  { value: "final", label: "Final round" },
  { value: "other", label: "Other" },
];

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatWhen(iso: string | null, tz: string | null): string {
  if (!iso) return "—";
  // Never show a bare clock time: the zone and its offset on that date are part
  // of the answer, not decoration.
  const zoned = formatZonedTime(iso, tz || detectTimezone());
  if (!zoned) return new Date(iso).toLocaleString();
  return `${zoned.timeLabel} (${zoned.zoneLabel})`;
}

export function statusBadgeClass(status: InterviewStatus): string {
  switch (status) {
    case "requested":
      return "taas-bg-warning-soft taas-fg-warning border taas-bd-warning";
    case "scheduling":
      return "taas-bg-info-soft taas-fg-info border taas-bd-info";
    case "scheduled":
      return "taas-bg-success-soft taas-fg-success border taas-bd-success";
    case "completed":
      return "taas-bg-neutral-soft taas-fg-neutral border taas-bd-neutral";
    case "cancelled":
      return "taas-bg-danger-soft taas-fg-danger border taas-bd-danger";
  }
}
