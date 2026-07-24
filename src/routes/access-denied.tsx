import { createFileRoute, Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/access-denied")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Access denied — TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const navigate = useNavigate();
  useEffect(() => {
    // Sign out silently so the user isn't stuck in a half-authenticated state.
    supabase.auth.signOut().catch(() => {});
  }, []);
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account has no active memberships. Contact your administrator, or
          sign in with a different account.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/login"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => setTimeout(() => navigate({ to: "/login" }), 0)}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
