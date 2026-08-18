import { useEffect, useState } from "react";
import { degradedNotice, type DegradedNotice, type PlatformStatus } from "./platform-status";

/**
 * Stop the client-facing status alarm from flapping.
 *
 * Platform status is measured per request, so one slow probe used to raise
 * "Degraded" on one load and clear it on the next, with no change in behaviour.
 * A client only sees an alarm once the degraded reading has persisted: two
 * consecutive resolved checks, or one reading older than the time threshold.
 * A single clean reading clears it immediately. "Not measured yet" is never an
 * alarm — `degradedNotice` already excludes unknown from the disrupted set.
 */

const STORAGE_KEY = "taas:status:degraded-streak";
export const REQUIRED_CONSECUTIVE_CHECKS = 2;
export const PERSIST_THRESHOLD_MS = 120_000;

type Streak = { signature: string; count: number; firstSeenAt: number };

function readStreak(): Streak | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Streak) : null;
  } catch {
    return null;
  }
}

function writeStreak(streak: Streak | null) {
  try {
    if (!streak) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(streak));
  } catch {
    /* storage unavailable — fall back to in-session state only */
  }
}

/** Signature of what is being claimed, so a different disruption starts fresh. */
function signatureOf(notice: DegradedNotice): string {
  return `${notice.status}|${notice.title}|${notice.affected.slice().sort().join(",")}`;
}

export function useStableDegradedNotice(
  status: PlatformStatus | undefined | null,
): DegradedNotice {
  const notice = degradedNotice(status);
  const [confirmed, setConfirmed] = useState(false);

  const resolved = Boolean(status);
  const signature = notice.show ? signatureOf(notice) : "";

  useEffect(() => {
    if (!resolved) return;
    if (!notice.show) {
      writeStreak(null);
      setConfirmed(false);
      return;
    }
    const prev = readStreak();
    const next: Streak =
      prev && prev.signature === signature
        ? { ...prev, count: prev.count + 1 }
        : { signature, count: 1, firstSeenAt: Date.now() };
    writeStreak(next);
    setConfirmed(
      next.count >= REQUIRED_CONSECUTIVE_CHECKS ||
        Date.now() - next.firstSeenAt >= PERSIST_THRESHOLD_MS,
    );
    // Only re-evaluate when a new reading arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, notice.show, signature]);

  if (!notice.show) return notice;
  return confirmed ? notice : { ...notice, show: false };
}
