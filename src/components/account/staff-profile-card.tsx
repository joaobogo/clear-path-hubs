import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { updateStaffProfile } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function StaffProfileCard({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);

  // Sync state if initialName changes (e.g. after a background query refresh)
  if (initialName !== "" && name === "" && initialName !== name) {
    setName(initialName);
  }

  const [saving, setSaving] = useState(false);
  const updateProfile = useServerFn(updateStaffProfile);
  const qc = useQueryClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = requiredText(name);
    setError(message);
    if (message) return;

    setSaving(true);
    try {
      const result = await updateProfile({ data: { full_name: name.trim() } });
      if (result.ok) {
        toast.success("Name updated successfully.");
        await qc.invalidateQueries({ queryKey: ["me-context"] });
      }
    } catch (error) {
      toast.error("Failed to update name.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Display Name</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        How you appear in internal logs and communications.
      </p>
      <form noValidate onSubmit={handleSave} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="staff-name">Full name</Label>
          <Input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-invalid={!!error}
          />
          <FieldError message={error} />
        </div>
        <Button type="submit" disabled={saving || name.trim() === initialName}>
          {saving ? "Saving..." : "Save name"}
        </Button>
      </form>
    </section>
  );
}
