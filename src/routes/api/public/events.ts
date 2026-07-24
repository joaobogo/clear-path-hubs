import { createFileRoute } from "@tanstack/react-router";

/**
 * Public analytics beacon sink. Accepts `navigator.sendBeacon` payloads from
 * the browser tracker in src/lib/analytics.ts. Best-effort: swallows all
 * errors, never returns anything meaningful, never touches the database.
 *
 * The endpoint is intentionally noop-until-wired. When a real analytics
 * backend is chosen, forward the parsed payload from here.
 */
export const Route = createFileRoute("/api/public/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Cap payload at 8 KB. Anything larger is dropped silently.
          const text = await request.text();
          if (text.length > 8_192) return new Response(null, { status: 204 });
          // Validate JSON shape without persisting.
          JSON.parse(text);
        } catch {
          // Ignore — beacons are fire-and-forget.
        }
        return new Response(null, { status: 204 });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "content-type",
          },
        }),
    },
  },
});
