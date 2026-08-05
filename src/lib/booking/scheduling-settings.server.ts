/**
 * Resolves the sales-calendar availability rules — server only.
 *
 * Order of truth:
 *   1. org_scheduling_settings + org_availability_windows for the platform org
 *   2. the shipped defaults in src/config/scheduler.ts (Mon–Fri 09:00–17:00)
 *
 * The DB is an override, never a prerequisite: with no rows at all the
 * scheduler still offers a full, correct calendar. A read failure falls back to
 * the defaults rather than showing an empty calendar, because an empty calendar
 * reads to a visitor as "nobody is available" — a lie.
 */
import { SCHEDULER_CONFIG } from "@/config/scheduler";
import { isValidTimezone, type DayWindow, type SlotRules } from "@/lib/booking/slots";

/** The organization whose settings drive the public sales calendar. */
export const PLATFORM_ORG_NAME = "TaaSFlow Platform";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function admin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type ResolvedRules = SlotRules & {
  organizationId: string | null;
  /** True when at least one value came from the database. */
  fromDatabase: boolean;
};

const DEFAULTS: SlotRules = {
  hostTimezone: SCHEDULER_CONFIG.hostTimezone,
  startMinute: SCHEDULER_CONFIG.startMinute,
  endMinute: SCHEDULER_CONFIG.endMinute,
  slotMinutes: SCHEDULER_CONFIG.slotMinutes,
  businessDays: SCHEDULER_CONFIG.businessDays,
  leadMinutes: SCHEDULER_CONFIG.leadMinutes,
};

let cached: { at: number; value: ResolvedRules } | null = null;
const CACHE_MS = 60_000;

export function clearSchedulingSettingsCache(): void {
  cached = null;
}

/** Business hours for the public scheduler, DB-overridable, default-safe. */
export async function resolveSlotRules(): Promise<ResolvedRules> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const fallback: ResolvedRules = { ...DEFAULTS, organizationId: null, fromDatabase: false };
  let resolved = fallback;

  try {
    const db = await admin();
    const { data: org } = await db
      .from("organizations")
      .select("id")
      .eq("name", PLATFORM_ORG_NAME)
      .maybeSingle();

    if (org?.id) {
      const [{ data: settings }, { data: windows }] = await Promise.all([
        db
          .from("org_scheduling_settings")
          .select("default_timezone, availability_window_days")
          .eq("organization_id", org.id)
          .maybeSingle(),
        db
          .from("org_availability_windows")
          .select("weekday, start_minute, end_minute, timezone")
          .eq("organization_id", org.id)
          .order("weekday", { ascending: true }),
      ]);

      const dayWindows: DayWindow[] = (windows ?? []).map((row) => ({
        weekday: row.weekday,
        startMinute: row.start_minute,
        endMinute: row.end_minute,
      }));

      const tz =
        settings?.default_timezone && isValidTimezone(settings.default_timezone)
          ? settings.default_timezone
          : DEFAULTS.hostTimezone;

      // A window's own timezone wins for the host clock when one is set.
      const windowTz = windows?.[0]?.timezone;
      const hostTimezone = windowTz && isValidTimezone(windowTz) ? windowTz : tz;

      const days = settings?.availability_window_days;
      resolved = {
        ...DEFAULTS,
        hostTimezone,
        businessDays:
          typeof days === "number" && days >= 1 && days <= 40 ? days : DEFAULTS.businessDays,
        ...(dayWindows.length > 0 ? { windows: dayWindows } : {}),
        organizationId: org.id,
        fromDatabase: Boolean(settings) || dayWindows.length > 0,
      };
    }
  } catch (err) {
    console.error("[booking] scheduling settings read failed, using defaults", err);
    resolved = fallback;
  }

  cached = { at: Date.now(), value: resolved };
  return resolved;
}
