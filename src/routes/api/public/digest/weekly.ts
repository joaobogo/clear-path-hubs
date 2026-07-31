import { createFileRoute } from "@tanstack/react-router";

/**
 * Weekly client digest trigger. Called by the scheduler (pg_cron) with the
 * project's publishable key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/digest/weekly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { runWeeklyDigest } = await import("@/lib/digest/weekly-digest.server");
          const result = await runWeeklyDigest();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[digest/weekly] failed", (err as Error)?.message);
          return new Response(JSON.stringify({ ok: false, error: "digest_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
