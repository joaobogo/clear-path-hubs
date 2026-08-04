import { createServerFn } from "@tanstack/react-start";

import type { PlatformStatus } from "./platform-status";

/**
 * Public: returns measured platform status. Safe to call unauthenticated —
 * the payload contains only service names, statuses, counts and published
 * notices.
 */
export const getPlatformStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformStatus> => {
    const { measurePlatformStatus } = await import("./platform-status.server");
    return measurePlatformStatus();
  },
);
