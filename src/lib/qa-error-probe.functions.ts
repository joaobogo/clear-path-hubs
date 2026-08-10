import { createServerFn } from "@tanstack/react-start";

/**
 * TEMPORARY QA probe. Throws unconditionally so we can observe what the UI
 * renders when a server function 500s. Delete after the check.
 */
export const qaBoomLoader = createServerFn({ method: "GET" }).handler(async () => {
  throw new Error("QA_PROBE_LOADER_BOOM: secret-looking detail sk_live_abc123");
});

export const qaBoomAction = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error("QA_PROBE_ACTION_BOOM: secret-looking detail sk_live_abc123");
});
