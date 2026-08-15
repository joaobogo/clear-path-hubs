import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GlobalSignOutCard() {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    if (!confirm("This will sign you out of all devices. Continue?")) return;
    
    setLoading(true);
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Signed out everywhere.");
      // The auth listener will handle redirection to /login
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold text-destructive">Danger zone</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Signed in on multiple devices? You can sign out of every active session across all browsers and apps.
      </p>
      <div className="mt-4">
        <Button 
          variant="destructive" 
          onClick={handleSignOut} 
          disabled={loading}
        >
          {loading ? "Signing out..." : "Sign out everywhere"}
        </Button>
      </div>
    </section>
  );
}
