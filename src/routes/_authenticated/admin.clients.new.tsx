import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { SectionTabs } from "@/components/workspace/section-tabs";
import { Building2, Briefcase, UserCheck, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { createClientWorkspace } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { collectErrors, emailText, requiredText } from "@/lib/form-validation";

export const Route = createFileRoute("/_authenticated/admin/clients/new")({
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
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  const sectionGroups = [
    {
      id: "command",
      label: "Command",
      tabs: [{ to: "/admin" as any, label: "Overview", exact: true }],
    },
    {
      id: "delivery",
      label: "Delivery",
      tabs: [
        { to: "/admin/intake" as any, label: "Intake" },
        { to: "/admin/clients" as any, label: "Clients" },
        { to: "/admin/positions" as any, label: "Positions" },
        { to: "/admin/candidates" as any, label: "Candidates" },
        { to: "/admin/publish" as any, label: "Publish desk" },
        { to: "/admin/decision-backlog" as any, label: "Decision backlog" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/admin/clients" className="hover:underline">Clients</Link>
          <span>/</span>
          <span className="text-foreground font-medium">New</span>
        </div>
      </div>

      <div className="px-6">
        <SectionTabs groups={sectionGroups} />
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-8 space-y-6">
        <NewClientPageContent
          result={result}
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          mut={mut}
          navigate={navigate}
        />
      </div>
    </div>
  );
}

function NewClientPageContent({ 
  result, 
  form, 
  setForm, 
  errors, 
  setErrors, 
  mut, 
  navigate 
}: any) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Create a client workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Creates the organization, primary contact user, and gives them admin access to their workspace. 
          Duplicate organizations and users are matched, not re-created.
        </p>
      </header>


      <Card className="p-5">
        <form
          noValidate
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = collectErrors({
              company_name: requiredText(form.company_name),
              primary_contact_name: requiredText(form.primary_contact_name),
              primary_contact_email: emailText(form.primary_contact_email),
            });
            setErrors(next);
            if (Object.keys(next).length > 0) return;
            mut.mutate();
          }}
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="company_name">Company name *</Label>
            <Input
              id="company_name"
              aria-invalid={!!errors.company_name}
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
            <FieldError message={errors.company_name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="primary_contact_name">Primary contact name *</Label>
            <Input
              id="primary_contact_name"
              aria-invalid={!!errors.primary_contact_name}
              value={form.primary_contact_name}
              onChange={(e) => setForm({ ...form, primary_contact_name: e.target.value })}
            />
            <FieldError message={errors.primary_contact_name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="primary_contact_email">Primary contact email *</Label>
            <Input
              id="primary_contact_email"
              type="email"
              aria-invalid={!!errors.primary_contact_email}
              value={form.primary_contact_email}
              onChange={(e) => setForm({ ...form, primary_contact_email: e.target.value })}
            />
            <FieldError message={errors.primary_contact_email} />
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
    </div>
  );
}
