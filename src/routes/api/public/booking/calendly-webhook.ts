/**
 * Retired: scheduling was removed from TaaSFlow. The route stays registered so
 * a webhook subscription that still points here gets a 200 and stops retrying.
 * Nothing is read, verified, stored or sent.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/booking/calendly-webhook")({
  server: {
    handlers: {
      POST: async () =>
        Response.json({ ok: true, disabled: true, reason: "scheduling removed" }),
    },
  },
});
