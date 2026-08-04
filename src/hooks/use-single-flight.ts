import { useCallback, useRef, useState } from "react";

/**
 * Prevents duplicate submissions and accidental repeated runs.
 *
 * A ref guard (not state) blocks the second call synchronously, so a double
 * click, an Enter keypress landing on a submit button, or an impatient retry
 * cannot start a second run. An optional cooldown keeps the trigger disabled for
 * a moment after success so "run again" is always deliberate.
 */
export function useSingleFlight<Args extends unknown[], R>(
  action: (...args: Args) => Promise<R>,
  options?: { cooldownMs?: number },
) {
  const inFlight = useRef(false);
  const cooling = useRef(false);
  const [running, setRunning] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const run = useCallback(
    async (...args: Args): Promise<R | undefined> => {
      if (inFlight.current || cooling.current) return undefined;
      inFlight.current = true;
      setRunning(true);
      try {
        return await action(...args);
      } finally {
        inFlight.current = false;
        setRunning(false);
        const cooldown = options?.cooldownMs ?? 0;
        if (cooldown > 0) {
          cooling.current = true;
          setBlocked(true);
          setTimeout(() => {
            cooling.current = false;
            setBlocked(false);
          }, cooldown);
        }
      }
    },
    [action, options?.cooldownMs],
  );

  return { run, running, blocked, disabled: running || blocked };
}
