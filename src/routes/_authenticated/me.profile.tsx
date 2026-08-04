import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
 getMyContext,
 updateMyProfile,
 type ProfilePatch,
} from "@/lib/candidate.functions";
import { profileCompleteness } from "@/lib/candidate/profile-completeness";
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
 errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.profile.tsx"),
 notFoundComponent: () => <main className="p-8">Not found.</main>,
 component: ProfilePage,
});

function ProfilePage() {
 const ctxInit = Route.useLoaderData();
 const ctxFn = useServerFn(getMyContext);
 const saveFn = useServerFn(updateMyProfile);
 const qc = useQueryClient();
 const { data: ctx = ctxInit } = useQuery({
 queryKey: ["me-context"],
 queryFn: () => ctxFn(),
 initialData: ctxInit,
 });

 const p = ctx?.profile as Record<string, unknown> | null | undefined;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const [form, setForm] = useState<any>(null);
 const [baseline, setBaseline] = useState<string | null>(null);

 useEffect(() => {
 if (!p) return;
 const next = {
 full_name: (p.full_name as string) ?? "",
 phone: (p.phone as string) ?? "",
 location: (p.location as string) ?? "",
 headline: (p.headline as string) ?? "",
 summary: (p.summary as string) ?? "",
 years_experience:
 p.years_experience == null ? "" : String(p.years_experience),
 timezone: (p.timezone as string) ?? "",
 linkedin_url: (p.linkedin_url as string) ?? "",
 portfolio_url: (p.portfolio_url as string) ?? "",
 skills: Array.isArray(p.skills) ? (p.skills as string[]).join(", ") : "",
 certifications_text: JSON.stringify(p.certifications ?? [], null, 2),
 experience_text: JSON.stringify(p.experience ?? [], null, 2),
 education_text: JSON.stringify(p.education ?? [], null, 2),
 languages_text: JSON.stringify(p.languages ?? [], null, 2),
 work_auth:
 ((p.work_authorization as { note?: string } | null)?.note) ?? "",
 availability:
 ((p.availability as { note?: string } | null)?.note) ?? "",
 comp:
 ((p.compensation_preferences as { note?: string } | null)?.note) ?? "",
 };
 setForm(next);
 setBaseline(JSON.stringify(next));
 }, [p]);
 const pct = profileCompleteness(p);



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

 const dirty = !!form && !!baseline && JSON.stringify(form) !== baseline;

 useEffect(() => {
 if (!dirty) return;
 const onBeforeUnload = (e: BeforeUnloadEvent) => {
 e.preventDefault();
 e.returnValue = "";
 };
 window.addEventListener("beforeunload", onBeforeUnload);
 return () => window.removeEventListener("beforeunload", onBeforeUnload);
 }, [dirty]);

 if (!form)
 return (
 <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4" aria-hidden>
 <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
 <div className="h-40 animate-pulse rounded-lg bg-muted" />
 <div className="h-40 animate-pulse rounded-lg bg-muted" />
 </main>
 );


 function submit(e: React.FormEvent) {
 e.preventDefault();
 let experience: unknown[] = [];
 let education: unknown[] = [];
 let languages: unknown[] = [];
 let certifications: unknown[] = [];
 try {
 experience = JSON.parse(form.experience_text || "[]");
 education = JSON.parse(form.education_text || "[]");
 languages = JSON.parse(form.languages_text || "[]");
 certifications = JSON.parse(form.certifications_text || "[]");
 } catch {
 toast.error("Experience/education/languages/certifications must be valid JSON arrays.");
 return;
 }
 save.mutate({
 full_name: form.full_name,
 phone: form.phone,
 location: form.location,
 headline: form.headline,
 summary: form.summary,
 years_experience:
 form.years_experience === "" ? null : Number(form.years_experience),
 timezone: form.timezone,
 linkedin_url: form.linkedin_url,
 portfolio_url: form.portfolio_url,
 skills: form.skills
 .split(",")
 .map((s: string) => s.trim())
 .filter(Boolean),
 certifications: certifications as never[],
 experience: experience as never[],
 education: education as never[],
 languages: languages as never[],
 work_authorization: form.work_auth ? { note: form.work_auth } : null,
 availability: form.availability ? { note: form.availability } : null,
 compensation_preferences: form.comp ? { note: form.comp } : null,
 });
 }

 return (
 <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
 <header className="mb-6">
 <h1 className="text-2xl font-semibold">Your profile</h1>
 <p className="text-sm text-muted-foreground">
 Keep this up to date so we can match you to the right roles. Manage
 your CV in the{" "}
 <Link to="/me/cv" className="underline">
 CV tab
 </Link>
 .
 </p>
 <div className="mt-4 rounded-lg border bg-card p-4">
 <div className="flex items-center justify-between text-sm">
 <span className="font-medium">Profile completeness</span>
 <span className="text-muted-foreground">{pct}%</span>
 </div>
 <div
 className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
 role="progressbar"
 aria-valuenow={pct}
 aria-valuemin={0}
 aria-valuemax={100}
 aria-label="Profile completeness"
 >
 <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
 </div>
 </div>
 </header>


      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Contact &amp; basics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-full-name">Full name</Label>
              <Input
                id="p-full-name"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="p-phone">Phone</Label>
              <Input
                id="p-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="p-location">Location</Label>
              <Input
                id="p-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="p-timezone">Timezone</Label>
              <Input
                id="p-timezone"
                placeholder="Europe/Lisbon"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-headline">Headline</Label>
              <Input
                id="p-headline"
                placeholder="Senior backend engineer"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="p-years">Years of experience</Label>
              <Input
                id="p-years"
                type="number"
                min={0}
                max={80}
                value={form.years_experience}
                onChange={(e) =>
                  setForm({ ...form, years_experience: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="p-linkedin">LinkedIn URL</Label>
              <Input
                id="p-linkedin"
                type="url"
                inputMode="url"
                placeholder="https://linkedin.com/in/…"
                value={form.linkedin_url}
                onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-portfolio">Portfolio / website URL</Label>
              <Input
                id="p-portfolio"
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={form.portfolio_url}
                onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="p-summary">Summary</Label>
              <Textarea
                id="p-summary"
                rows={4}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="A short paragraph about what you do best."
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Skills</h2>
          <Label htmlFor="p-skills" className="text-xs text-muted-foreground">
            Comma-separated
          </Label>
          <Input
            id="p-skills"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="TypeScript, PostgreSQL, GraphQL"
          />
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Experience, education, languages, certifications</h2>
          <p className="text-xs text-muted-foreground">
            Enter JSON arrays. A friendlier editor is coming — this keeps parsing exact.
          </p>
          <div>
            <Label htmlFor="p-experience">Experience</Label>
            <Textarea
              id="p-experience"
              rows={5}
              value={form.experience_text}
              onChange={(e) => setForm({ ...form, experience_text: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p-education">Education</Label>
            <Textarea
              id="p-education"
              rows={4}
              value={form.education_text}
              onChange={(e) => setForm({ ...form, education_text: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p-languages">Languages</Label>
            <Textarea
              id="p-languages"
              rows={3}
              value={form.languages_text}
              onChange={(e) => setForm({ ...form, languages_text: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p-certifications">Certifications</Label>
            <Textarea
              id="p-certifications"
              rows={3}
              value={form.certifications_text}
              onChange={(e) => setForm({ ...form, certifications_text: e.target.value })}
              placeholder='[{"name":"AWS Solutions Architect","year":2024}]'
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">Work preferences</h2>
          <div>
            <Label htmlFor="p-work-auth">Work authorization</Label>
            <Input
              id="p-work-auth"
              value={form.work_auth}
              onChange={(e) => setForm({ ...form, work_auth: e.target.value })}
              placeholder="EU citizen, US work permit, etc."
            />
          </div>
          <div>
            <Label htmlFor="p-availability">Availability</Label>
            <Input
              id="p-availability"
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              placeholder="Available in 4 weeks, immediate, etc."
            />
          </div>
          <div>
            <Label htmlFor="p-comp">Compensation preferences</Label>
            <Input
              id="p-comp"
              value={form.comp}
              onChange={(e) => setForm({ ...form, comp: e.target.value })}
              placeholder="Range or expectations"
            />
          </div>
        </section>


 <div className="flex flex-wrap items-center gap-3">
 <Button type="submit" className="min-h-11" disabled={save.isPending}>
 {save.isPending ? "Saving…" : "Save profile"}
 </Button>
 {dirty && !save.isPending && (
 <span className="text-xs text-muted-foreground">
 You have unsaved changes.
 </span>
 )}
 </div>

 </form>
 </main>
 );
}
