import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PasswordChangeCard() {
  const [sending, setSending] = useState(false);

  const handleReset = async () => {
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.email) {
      toast.error("User email not found.");
      setSending(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/me/settings`,
    });

    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent. Please check your inbox.");
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Security</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Change your password. For security, we'll send a reset link to your email address.
      </p>
      <div className="mt-4">
        <Button 
          variant="outline" 
          onClick={handleReset} 
          disabled={sending}
        >
          {sending ? "Sending reset email..." : "Send password reset email"}
        </Button>
      </div>
    </section>
  );
}
