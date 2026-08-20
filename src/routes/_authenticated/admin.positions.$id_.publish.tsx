import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobPostStep, type JobPostFields } from "@/components/positions/JobPostStep";
import {
  getPositionForEdit,
  publishPosition,
} from "@/lib/position-edit.functions";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";

export const Route = createFileRoute("/_authenticated/admin/positions/$id_/publish")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["position-edit", params.id],
      queryFn: () => getPositionForEdit({ data: { id: params.id } }),
    });
    if (!d) throw notFound();
    return d;
  },
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Position not found.</div>
  ),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.positions.$id_.publish.tsx"),
  head: () => ({ meta: [{ title: "Publish role · TaaSFlow admin" }] }),
  component: PublishPage,
});

function PublishPage() {
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const publish = useServerFn(publishPosition);

  const [fields, setFields] = useState<JobPostFields>(() => ({
    title: initial.title,
    department: initial.department,
    location: initial.location,
    work_model: initial.work_model,
    employment_type: initial.employment_type,
    seniority: initial.seniority,
    description: initial.description,
    responsibilities: initial.responsibilities,
    must_have_skills: initial.must_have_skills,
    nice_to_have_skills: initial.nice_to_have_skills,
    education: initial.education,
    experience: initial.experience,
    currency: initial.currency,
    budget_min: initial.budget_min,
    budget_max: initial.budget_max,
    company_intro: initial.company_intro,
    benefits: initial.benefits,
    languages: initial.languages,
    travel: initial.travel,
    work_authorization_note: initial.work_authorization_note,
    accessibility_note: initial.accessibility_note,
    eeo_statement: initial.eeo_statement,
    brand_tone: initial.brand_tone,
    application_deadline: initial.application_deadline,
    confidentiality: initial.confidentiality,
    screening_questions: initial.screening_questions.map((q) => ({
      question: q.question,
      required: q.required,
      answer_type: q.answer_type,
    })),
  }));

  const [busy, setBusy] = useState(false);
  const isPublic = initial.visibility === "public";

  const update = <K extends keyof JobPostFields>(k: K, v: JobPostFields[K]) =>
    setFields((f) => ({ ...f, [k]: v }));

  const save = async (visibility?: "public" | "private") => {
    setBusy(true);
    try {
      await publish({
        data: {
          id: initial.id,
          company_intro: fields.company_intro,
          benefits: fields.benefits,
          languages: fields.languages,
          travel: fields.travel,
          work_authorization_note: fields.work_authorization_note,
          accessibility_note: fields.accessibility_note,
          eeo_statement: fields.eeo_statement,
          brand_tone: fields.brand_tone,
          application_deadline: fields.application_deadline,
          confidentiality: fields.confidentiality || "public",
          visibility,
        },
      });
      toast.success(visibility ? "Role is now live" : "Post saved");
      navigate({ to: "/admin/positions/$id", params: { id: initial.id } });
    } catch (e) {
      toastError(e, { fallback: "Could not save post" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin · Publish</p>
          <h1 className="text-xl font-semibold sm:text-2xl">{initial.title || "Untitled role"}</h1>
          <p className="text-sm text-muted-foreground">Edit the public-facing post before going live.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate({ to: "/admin/positions/$id", params: { id: initial.id } })}>
          Back to role
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Job post & preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <JobPostStep value={fields} onChange={update} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/admin/positions/$id", params: { id: initial.id } })}
          disabled={busy}
        >
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => save()} disabled={busy}>
            Save draft
          </Button>
          {!isPublic && (
            <Button onClick={() => save("public")} disabled={busy}>
              Publish now
            </Button>
          )}
          {isPublic && (
            <Button variant="outline" onClick={() => save("private")} disabled={busy}>
              Unpublish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

