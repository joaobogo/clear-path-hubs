import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PublicLoading } from "@/components/marketing/site-shell";
import { getSessionContext } from "@/lib/auth.functions";
import { landingPathForRole } from "@/lib/roles";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const ctx = useServerFn(getSessionContext);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        navigate({ to: "/login", replace: true });
        return;
      }

      try {
        const session = await ctx({ data: {} });
        if (!mounted) return;
        navigate({ to: landingPathForRole(session.primary_role), replace: true });
      } catch {
        if (!mounted) return;
        navigate({ to: "/login", replace: true });
      }
    }

    resolve().finally(() => {
      if (mounted) setChecking(false);
    });

    return () => {
      mounted = false;
    };
  }, [navigate, ctx]);

  if (checking) return <PublicLoading label="Redirecting" />;
  return null;
}
