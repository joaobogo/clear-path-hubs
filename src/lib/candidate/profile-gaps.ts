/**
 * Outcome-tied profile gaps for the candidate home page.
 *
 * Rules:
 * - Only fields that genuinely change matching or scheduling qualify.
 * - Never demographic fields.
 * - At most three items surfaced at a time.
 * - Each item states why it matters and links straight to that field.
 */

export type ProfileGap = {
  /** Stable key used for 30-day dismissal storage. */
  key: string;
  /** Short label for the row. */
  label: string;
  /** The consequence of leaving it blank. */
  reason: string;
  /** DOM id of the exact field on /me/profile. */
  fieldId: string;
};

/** Ordered by how much the missing value blocks a real outcome. */
const GAP_RULES: Array<{
  key: string;
  label: string;
  reason: string;
  fieldId: string;
  missing: (p: Record<string, unknown>) => boolean;
}> = [
  {
    key: "work_authorization",
    label: "Add your work authorisation",
    reason: "Employers filter by work authorisation before they read anything else.",
    fieldId: "p-work-auth",
    missing: (p) =>
      !((p.work_authorization as { note?: string } | null)?.note ?? "").trim(),
  },
  {
    key: "timezone",
    label: "Set your time zone",
    reason: "We cannot schedule an interview without knowing your time zone.",
    fieldId: "p-timezone",
    missing: (p) => !String(p.timezone ?? "").trim(),
  },
  {
    key: "skills",
    label: "List your core skills",
    reason: "Skills are what we match roles against — without them you are invisible to searches.",
    fieldId: "p-skills",
    missing: (p) => !(Array.isArray(p.skills) && (p.skills as unknown[]).length > 0),
  },
  {
    key: "experience",
    label: "Add your recent experience",
    reason: "Hiring teams shortlist on relevant experience, not on a CV file alone.",
    fieldId: "p-experience",
    missing: (p) =>
      !(Array.isArray(p.experience) && (p.experience as unknown[]).length > 0),
  },
  {
    key: "location",
    label: "Add where you are based",
    reason: "Most roles are filtered by location or hybrid distance.",
    fieldId: "p-location",
    missing: (p) => !String(p.location ?? "").trim(),
  },
  {
    key: "availability",
    label: "Say when you could start",
    reason: "Availability decides whether you are considered for roles starting soon.",
    fieldId: "p-availability",
    missing: (p) => !((p.availability as { note?: string } | null)?.note ?? "").trim(),
  },
  {
    key: "phone",
    label: "Add a phone number",
    reason: "We use it to confirm interview times when email goes quiet.",
    fieldId: "p-phone",
    missing: (p) => !String(p.phone ?? "").trim(),
  },
];

export const MAX_PROFILE_GAPS = 3;

export function profileGaps(
  profile: Record<string, unknown> | null | undefined,
  dismissedKeys: readonly string[] = [],
): ProfileGap[] {
  if (!profile) return [];
  const dismissed = new Set(dismissedKeys);
  return GAP_RULES.filter((r) => !dismissed.has(r.key) && r.missing(profile))
    .slice(0, MAX_PROFILE_GAPS)
    .map(({ key, label, reason, fieldId }) => ({ key, label, reason, fieldId }));
}

/** All gap field ids, used to validate deep links into the profile form. */
export const PROFILE_GAP_FIELD_IDS = GAP_RULES.map((r) => r.fieldId);

/* ---------- 30-day dismissal (client-side, per browser) ---------- */

const STORAGE_KEY = "taas.me.profile-gaps.dismissed";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type DismissMap = Record<string, number>;

function readMap(): DismissMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DismissMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readDismissedGapKeys(now: number = Date.now()): string[] {
  const map = readMap();
  return Object.entries(map)
    .filter(([, at]) => typeof at === "number" && now - at < THIRTY_DAYS_MS)
    .map(([key]) => key);
}

export function dismissGapKey(key: string, now: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    const map = readMap();
    map[key] = now;
    for (const [k, at] of Object.entries(map)) {
      if (typeof at !== "number" || now - at >= THIRTY_DAYS_MS) delete map[k];
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — prompt simply reappears */
  }
}
