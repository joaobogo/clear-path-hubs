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
 const qc = useQueryClient();
 const { data: ctx = ctxInit } = useQuery({
 queryKey: ["me-context"],
 queryFn: () => ctxFn(),
 initialData: ctxInit,
 });

 const p = ctx?.profile as Record<string, unknown> | null | undefined;
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const [form, setForm] = useState<any>(null);

 useEffect(() => {
 if (!p) return;
 setForm({
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

 if (!form) return <main className="p-8">Loading…</main>;

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
 <main className="mx-auto max-w-3xl px-6 py-8">
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
 </header>

 <form onSubmit={submit} className="space-y-6">
 <section className="rounded-lg border bg-card p-5 space-y-3">
 <h2 className="text-sm font-medium">Contact & basics</h2>
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
 <Label>Timezone</Label>
 <Input
 placeholder="Europe/Lisbon"
 value={form.timezone}
 onChange={(e) => setForm({ ...form, timezone: e.target.value })}
 />
 </div>
 <div className="sm:col-span-2">
 <Label>Headline</Label>
 <Input
 placeholder="Senior backend engineer"
 value={form.headline}
 onChange={(e) => setForm({ ...form, headline: e.target.value })}
 />
 </div>
 <div>
 <Label>Years of experience</Label>
 <Input
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
 <Label>LinkedIn URL</Label>
 <Input
 value={form.linkedin_url}
 onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
 />
 </div>
 <div className="sm:col-span-2">
 <Label>Portfolio / website URL</Label>
 <Input
 value={form.portfolio_url}
 onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })}
 />
 </div>
 <div className="sm:col-span-2">
 <Label>Summary</Label>
 <Textarea
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
 <Label className="text-xs text-muted-foreground">Comma-separated</Label>
 <Input
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
 <div>
 <Label>Certifications</Label>
 <Textarea
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
 </main>
 );
}
