import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { createClientWorkspace } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/clients_new")({
  ssr: false,
  head: () => ({
    meta: [{ title: "New client — Admin · TaaSFlow" }, { name: "robots", content: "noindex" }],
  }),
  component: NewClientPage,
});

function NewClientPage() {
  const navigate = useNavigate();
  const run = useServerFn(createClientWorkspace);
  const [form, setForm] = useState({
    company_name: "",
    primary_contact_name: "",
    primary_contact_email: "",
    website: "",
    industry: "",
    headquarters: "",
    phone: "",
    notes: "",
  });
  const [result, setResult] = useState<{
    organization_id: string;
    email: string;
    temporary_password: string | null;
  } | null>(null);

  const mut = useMutation({
    mutationFn: () => run({ data: form }),
    onSuccess: (r) => {
      setResult({
        organization_id: r.organization_id,
        email: r.primary_user.email,
        temporary_password: r.primary_user.temporary_password,
      });
      toast.success("Client workspace created.");
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Create a client workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates the organization, primary contact user, and client_admin
          membership. Duplicate organizations and users are matched, not
          re-created.
        </p>
      </header>

      <Card className="p-5">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label>Company name *</Label>
            <Input
              required
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Primary contact name *</Label>
            <Input
              required
              value={form.primary_contact_name}
              onChange={(e) => setForm({ ...form, primary_contact_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Primary contact email *</Label>
            <Input
              required
              type="email"
              value={form.primary_contact_email}
              onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input
              placeholder="https://…"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Headquarters</Label>
            <Input
              value={form.headquarters}
              onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Creating…" : "Create client"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate({ to: "/admin/clients" })}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {result && (
        <Card className="p-5 border-success/40 bg-success/5">
          <h2 className="text-lg font-medium">Client ready</h2>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Primary contact email</dt>
              <dd className="font-mono">{result.email}</dd>
            </div>
            {result.temporary_password && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Temporary password</dt>
                <dd className="font-mono">{result.temporary_password}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Login URL</dt>
              <dd className="font-mono text-xs">
                {typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                navigate({
                  to: "/admin/clients/$id",
                  params: { id: result.organization_id },
                })
              }
            >
              Open client record
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate({ to: "/client", search: { org: result.organization_id } })
              }
            >
              View client dashboard
            </Button>
            {result.temporary_password && (
              <Button
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(
                    `Email: ${result.email}\nPassword: ${result.temporary_password}\nLogin: ${window.location.origin}/login`,
                  )
                }
              >
                Copy credentials
              </Button>
            )}
          </div>
        </Card>
      )}
    </main>
  );
}
