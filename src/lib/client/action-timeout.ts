/**
 * A client action must always resolve into a visible outcome.
 *
 * If a write hangs — a dropped connection, a sleeping edge worker — the button
 * spinner would otherwise spin forever and the client would be left guessing.
 * Every client-facing write is wrapped so the wait has a hard ceiling and ends
 * in a readable error with a retry, never in silence.
 */
export const ACTION_TIMEOUT_MS = 20_000;

export const ACTION_TIMEOUT_MESSAGE =
  "That is taking longer than it should. Nothing was lost — try again.";

export class ActionTimeoutError extends Error {
  constructor(message = ACTION_TIMEOUT_MESSAGE) {
    super(message);
    this.name = "ActionTimeoutError";
  }
}

export function isActionTimeout(error: unknown): boolean {
  return error instanceof ActionTimeoutError || (error as Error | null)?.name === "ActionTimeoutError";
}

/** Resolve with the action, or reject with a readable timeout. */
export async function withActionTimeout<T>(
  run: () => Promise<T>,
  ms: number = ACTION_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ActionTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
