import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

/** Sign-out with correct ordering: cancel queries → clear cache → signOut → replace to /login. */
export function SignOutButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
    } finally {
      navigate({ to: "/login", replace: true });
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      }
      title="Sign out"
    >
      <LogOut className="h-3.5 w-3.5" />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
