import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MIN_ACCOUNT_PASSWORD } from "@/lib/express-intake-schema";

/**
 * Inline account creation for the intake flow. The visitor never leaves the
 * page: we create (or recognise) the account here, then the browser signs in
 * with the password it already holds and the draft is persisted server-side.
 */

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("check"),
    email: z.string().trim().toLowerCase().email("Enter a valid work email").max(255),
  }),
  z.object({
    mode: z.literal("create"),
    email: z.string().trim().toLowerCase().email("Enter a valid work email").max(255),
    password: z.string().min(MIN_ACCOUNT_PASSWORD, `Use at least ${MIN_ACCOUNT_PASSWORD} characters`).max(128),
    firstName: z.string().trim().max(80).optional().default(""),
    lastName: z.string().trim().max(80).optional().default(""),
  }),
]);

async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return null;
  const match = (data?.users ?? []).find(
    (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

export const Route = createFileRoute("/api/public/intake-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch (e: any) {
          const message = e?.issues?.[0]?.message ?? "Check the details you entered.";
          return Response.json({ ok: false, error: "invalid_input", message }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const existingId = await findUserIdByEmail(supabaseAdmin, parsed.email);

        if (parsed.mode === "check") {
          if (!existingId) return Response.json({ ok: true, exists: false });
          // Recognise the person and point them at sign-in. We never create a
          // second account, and never say which organisation it belongs to.
          return Response.json({
            ok: true,
            exists: true,
            message:
              "That email already has a TaaSFlow account. Sign in and we'll add this role to your existing workspace — nothing you've typed is lost.",
          });
        }

        if (existingId) {
          return Response.json(
            {
              ok: false,
              error: "account_exists",
              message:
                "That email already has a TaaSFlow account. Sign in below and we'll attach this role to your existing organisation.",
            },
            { status: 409 },
          );
        }

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email: parsed.email,
          password: parsed.password,
          email_confirm: true,
          user_metadata: {
            full_name: `${parsed.firstName} ${parsed.lastName}`.trim(),
          },
        });
        if (error || !created?.user?.id) {
          return Response.json(
            {
              ok: false,
              error: "create_failed",
              message: error?.message ?? "We couldn't create your account. Please try again.",
            },
            { status: 500 },
          );
        }

        return Response.json({ ok: true, created: true, userId: created.user.id });
      },
    },
  },
});
