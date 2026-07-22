import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getMyContext,
  updateMyProfile,
  replaceMyCv,
  type ProfilePatch,
} from "@/lib/candidate.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/me/profile")({
  head: () => ({
    meta: [
      { title: "My profile · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["me-context"],
      queryFn: () => getMyContext(),
    }),
  errorComponent: ({ error }) => (
    <main className="p-8 text-destructive">Failed to load: {error.message}</main>
  ),
  notFoundComponent: () => <main className="p-8">Not found.</main>,
  component: ProfilePage,
});

function ProfilePage() {
  const ctxInit = Route.useLoaderData();
  const ctxFn = useServerFn(getMyContext);
  const saveFn = useServerFn(updateMyProfile);
  const cvFn = useServerFn(replaceMyCv);
  const qc = useQueryClient();
  const { data: ctx = ctxInit } = useQuery({
    queryKey: ["me-context"],
    queryFn: () => ctxFn(),
    initialData: ctxInit,
  });

  const p = ctx?.profile;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (!p) return;
    setForm({
      full_name: p.full_name ?? "",
      phone: p.phone ?? "",
      location: p.location ?? "",
      headline: p.headline ?? "",
      skills: Array.isArray(p.skills) ? (p.skills as string[]).join(", ") : "",
      experience_text: JSON.stringify(p.experience ?? [], null, 2),
      education_text: JSON.stringify(p.education ?? [], null, 2),
      languages_text: JSON.stringify(p.languages ?? [], null, 2),
      work_auth: (p.work_authorization as { note?: string } | null)?.note ?? "",
      availability: (p.availability as { note?: string } | null)?.note ?? "",
      comp: (p.compensation_preferences as { note?: string } | null)?.note ?? "",
    });
  }, [p]);

  const save = useMutation({
    mutationFn: (patch: ProfilePatch) => saveFn({ data: patch }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Profile saved.");
        qc.invalidateQueries({ queryKey: ["me-context"] });
      } else toast.error(r.message);
    },
    onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
  });

  const cv = useMutation({
    mutationFn: (file: File) =>
      new Promise<{ ok: boolean; message?: string }>((resolve) => {
        const r = new FileReader();
        r.onload = async () => {
          const base64 = String(r.result).split(",")[1] ?? "";
          const res = await cvFn({
            data: { filename: file.name, mime: file.type || "application/pdf", base64 },
          });
          resolve(res);
        };
        r.readAsDataURL(file);
      }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("CV updated.");
        qc.invalidateQueries({ queryKey: ["me-context"] });
      } else toast.error(r.message ?? "Upload failed");
    },
  });

  if (!form) return <main className="p-8">Loading…</main>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let experience: unknown[] = [];
    let education: unknown[] = [];
    let languages: unknown[] = [];
    try {
      experience = JSON.parse(form.experience_text || "[]");
      education = JSON.parse(form.education_text || "[]");
      languages = JSON.parse(form.languages_text || "[]");
    } catch {
      toast.error("Experience/Education/Languages must be valid JSON arrays.");
      return;
    }
    save.mutate({
      full_name: form.full_name,
      phone: form.phone,
      location: form.location,
      headline: form.headline,
      skills: form.skills
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean),
      experience: experience as never[],
      education: education as never[],
      languages: languages as never[],
      work_authorization: form.work_auth ? { note: form.work_auth } : null,
      availability: form.availability ? { note: form.availability } : null,
      compensation_preferences: form.comp ? { note: form.comp } : null,
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Keep this up to date so we can match you to the right roles. Changes
          save all at once.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Full name</Label>
              <Input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label>Headline</Label>
              <Input
                placeholder="Senior backend engineer"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Skills</h2>
          <Label className="text-xs text-muted-foreground">
            Comma-separated
          </Label>
          <Input
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="TypeScript, PostgreSQL, GraphQL"
          />
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Experience, education, languages</h2>
          <p className="text-xs text-muted-foreground">
            Enter JSON arrays. A friendlier editor is coming — this keeps parsing exact.
          </p>
          <div>
            <Label>Experience</Label>
            <Textarea
              rows={5}
              value={form.experience_text}
              onChange={(e) => setForm({ ...form, experience_text: e.target.value })}
            />
          </div>
          <div>
            <Label>Education</Label>
            <Textarea
              rows={4}
              value={form.education_text}
              onChange={(e) => setForm({ ...form, education_text: e.target.value })}
            />
          </div>
          <div>
            <Label>Languages</Label>
            <Textarea
              rows={3}
              value={form.languages_text}
              onChange={(e) => setForm({ ...form, languages_text: e.target.value })}
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Work preferences</h2>
          <div>
            <Label>Work authorization</Label>
            <Input
              value={form.work_auth}
              onChange={(e) => setForm({ ...form, work_auth: e.target.value })}
              placeholder="EU citizen, US work permit, etc."
            />
          </div>
          <div>
            <Label>Availability</Label>
            <Input
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              placeholder="Available in 4 weeks, immediate, etc."
            />
          </div>
          <div>
            <Label>Compensation preferences</Label>
            <Input
              value={form.comp}
              onChange={(e) => setForm({ ...form, comp: e.target.value })}
              placeholder="Range or expectations"
            />
          </div>
        </section>

        <div className="flex gap-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>

      <section className="rounded-lg border bg-card p-5 mt-8">
        <h2 className="text-sm font-medium mb-2">CV</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Uploading a new CV replaces your current one. PDF, DOCX up to 10MB.
        </p>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) cv.mutate(f);
          }}
          disabled={cv.isPending}
        />
        {cv.isPending && (
          <div className="text-xs text-muted-foreground mt-2">Uploading…</div>
        )}
      </section>
    </main>
  );
}
