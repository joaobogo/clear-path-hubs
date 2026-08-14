import { useEffect, useRef, useState } from "react";

/**
 * Tracks browser connectivity. SSR-safe: assumes online on the server so the
 * first paint never flashes an offline warning.
 *
 * `navigator.onLine` is noisy — it can read false for a moment during heavy
 * page loads or a transient interface switch, which used to flash a false
 * "You're offline" banner. So an offline reading is only trusted after a short
 * debounce AND a real network probe; going back online is immediate.
 */
const PROBE_PATH = "/favicon.ico";
const DEBOUNCE_MS = 2500;

async function probe(): Promise<boolean> {
  try {
    const res = await fetch(`${PROBE_PATH}?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };

    const confirmOffline = () => {
      clear();
      timer.current = setTimeout(async () => {
        // Re-check both signals: only a sustained, verified loss counts.
        if (navigator.onLine && (await probe())) {
          setOnline(true);
          return;
        }
        if (!(await probe())) setOnline(false);
      }, DEBOUNCE_MS);
    };

    const up = () => {
      clear();
      setOnline(true);
    };
    const down = () => confirmOffline();

    if (!navigator.onLine) confirmOffline();

    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      clear();
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
