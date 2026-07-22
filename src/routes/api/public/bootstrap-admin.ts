/**
 * Bootstrap route for the very first platform_admin.
 *
 * - No auth (uses /api/public/* which bypasses the auth gate on published sites).
 * - Requires the QA_SEED_TOKEN secret in the request header.
 * - Refuses to run once at least one active platform_admin membership exists.
 *
 * Body: { email, password, full_name? }
 * Header: x-qa-seed-token: <QA_SEED_TOKEN>
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const body = z.object({
  email: z.string().email().transform((s) => s.trim().toLowerCase()),
  password: z.string().min(10).max(128),
  full_name: z.string().min(1).max(120).optional().default("Platform Admin"),
});

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-qa-seed-token") ?? "";
        const expected = process.env.QA_SEED_TOKEN ?? "";
        if (!expected || token.length === 0 || token !== expected) {
          return new Response("Forbidden", { status: 403 });
        }
        const parsed = body.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Refuse if a platform_admin already exists.
        const { count } = await supabaseAdmin
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("role", "platform_admin")
          .eq("status", "active");
        if ((count ?? 0) > 0) {
          return new Response(
            JSON.stringify({ error: "platform_admin already exists; use the admin UI" }),
            { status: 409, headers: { "content-type": "application/json" } },
          );
        }

        // Create or reuse the auth user (email_confirm bypasses verification).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = (supabaseAdmin as any).auth.admin;
        let authUserId: string | null = null;
        const created = await admin.createUser({
          email: parsed.data.email,
          password: parsed.data.password,
          email_confirm: true,
          user_metadata: { full_name: parsed.data.full_name },
        });
        if (created.error) {
          const list = await admin.listUsers({ page: 1, perPage: 200 });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const found = list?.data?.users?.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (u: any) => (u.email ?? "").toLowerCase() === parsed.data.email,
          );
          if (!found) {
            return new Response(
              JSON.stringify({ error: created.error.message }),
              { status: 500, headers: { "content-type": "application/json" } },
            );
          }
          authUserId = found.id;
          // Reset the password for the returning user so the caller can log in.
          await admin.updateUserById(authUserId, { password: parsed.data.password });
        } else {
          authUserId = created.data?.user?.id ?? null;
        }
        if (!authUserId) {
          return new Response("Auth user resolution failed", { status: 500 });
        }

        // Profile.
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("auth_user_id", authUserId)
          .maybeSingle();
        let profileId = existing?.id as string | undefined;
        if (!profileId) {
          const { data: ins, error } = await supabaseAdmin
            .from("profiles")
            .insert({
              auth_user_id: authUserId,
              email: parsed.data.email,
              full_name: parsed.data.full_name,
              status: "active",
            })
            .select("id")
            .single();
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          profileId = ins.id as string;
        }

        // platform_admin membership (organization_id NULL for staff).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: memErr } = await (supabaseAdmin as any).from("memberships").upsert(
          {
            user_id: profileId,
            organization_id: null,
            role: "platform_admin",
            status: "active",
          },
          { onConflict: "user_id,organization_id,role" },
        );
        if (memErr) {
          return new Response(JSON.stringify({ error: memErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        await supabaseAdmin.from("audit_events").insert({
          actor_user_id: authUserId,
          entity_type: "profiles",
          entity_id: profileId,
          action: "bootstrap.platform_admin",
          after_state: { email: parsed.data.email },
        });

        return new Response(
          JSON.stringify({
            ok: true,
            email: parsed.data.email,
            auth_user_id: authUserId,
            profile_id: profileId,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
