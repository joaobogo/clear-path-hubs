import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";
// Pure formatter shared by the tasks route and its row component.
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const min = 60_000,
    hr = 60 * min,
    day = 24 * hr;
  if (abs < hr) return rt.format(Math.round(diff / min), "minute");
  if (abs < day) return rt.format(Math.round(diff / hr), "hour");
  if (abs < 30 * day) return rt.format(Math.round(diff / day), "day");
  return formatDate((iso));
}
