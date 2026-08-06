import { createFileRoute } from "@tanstack/react-router";

/**
 * Bounded profile-completion nudges (max two per candidate, ever). Called by the
 * scheduler with the project's publishable key in the `apikey` header.
 */
export const Route = createFileRoute("/api/public/candidate/profile-nudges")({
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
          const { runProfileNudges } = await import("@/lib/candidate/profile-nudges.server");
          const result = await runProfileNudges();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[profile-nudges] failed", (err as Error)?.message);
          return new Response(JSON.stringify({ ok: false, error: "profile_nudges_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
