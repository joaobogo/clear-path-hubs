import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  getMyContext,
  updateMyProfileSection,
} from "@/lib/candidate.functions";
import { profileCompleteness } from "@/lib/candidate/profile-completeness";
import { PROFILE_GAP_FIELD_IDS } from "@/lib/candidate/profile-gaps";
import {
  PROFILE_SECTIONS,
  contactValues,
  experienceValues,
  linksValues,
  locationValues,
  sectionForField,
  skillsValues,
  workAuthValues,
  type ProfileSectionId,
  type ProfileSectionMeta,
} from "@/lib/candidate/profile-sections";
import { ProfileSectionCard } from "@/components/candidate/profile-section-card";
import { EmailChangeCard } from "@/components/account/email-change-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmployerPreviewSheet } from "@/components/candidate/employer-preview-sheet";

export const Route = createFileRoute("/_authenticated/me/profile")({
  head: () => ({
    meta: [
      { title: "My profile · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    const field = typeof search.field === "string" ? search.field : "";
    return PROFILE_GAP_FIELD_IDS.includes(field) ? { field } : {};
  },
  loader: async ({ context }) => {
    const ctx = await context.queryClient.ensureQueryData({
      queryKey: ["me-context"],
      queryFn: () => getMyContext(),
    });
    return ctx;
  },
  errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.profile.tsx"),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: ProfilePage,
});

function meta(id: ProfileSectionId): ProfileSectionMeta {
  return PROFILE_SECTIONS.find((s) => s.id === id)!;
}

function jsonText(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function parseJsonArray(text: string): unknown[] {
  const parsed = JSON.parse(text || "[]");
  if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
  return parsed;
}

function ProfilePage() {
  const ctxInit = Route.useLoaderData();
  const ctxFn = useServerFn(getMyContext);
  const saveSection = useServerFn(updateMyProfileSection);
  const qc = useQueryClient();
  const { data: ctx = ctxInit, isFetching } = useQuery({
    queryKey: ["me-context"],
    queryFn: () => ctxFn(),
    initialData: ctxInit,
  });

  const { field } = Route.useSearch() as { field?: string };
  const openSection = field ? sectionForField(field) : null;
  const p = (ctx?.profile ?? null) as Record<string, unknown> | null;
  const pct = profileCompleteness(p);

  const authNote = (p?.work_authorization as { note?: string } | null)?.note ?? "";
  const availNote = (p?.availability as { note?: string } | null)?.note ?? "";
  const compNote =
    (p?.compensation_preferences as { note?: string } | null)?.note ?? "";

  const initial = useMemo(
    () => ({
      contact: {
        full_name: (p?.full_name as string) ?? "",
        phone: (p?.phone as string) ?? "",
      },
      location: {
        location: (p?.location as string) ?? "",
        timezone: (p?.timezone as string) ?? "",
      },
      work_auth: {
        work_authorization_note: authNote,
        availability_note: availNote,
        compensation_note: compNote,
      },
      experience: {
        headline: (p?.headline as string) ?? "",
        summary: (p?.summary as string) ?? "",
        years_experience:
          p?.years_experience == null ? "" : String(p.years_experience),
        experience_text: jsonText(p?.experience),
        education_text: jsonText(p?.education),
        languages_text: jsonText(p?.languages),
        certifications_text: jsonText(p?.certifications),
      },
      skills: {
        skills: Array.isArray(p?.skills) ? (p!.skills as string[]).join(", ") : "",
      },
      links: {
        linkedin_url: (p?.linkedin_url as string) ?? "",
        portfolio_url: (p?.portfolio_url as string) ?? "",
      },
    }),
    [p, authNote, availNote, compNote],
  );

  async function commit(section: ProfileSectionId, values: unknown) {
    const r = (await saveSection({ data: { section, values } as never })) as {
      ok: boolean;
      message?: string;
    };
    if (r.ok) await qc.invalidateQueries({ queryKey: ["me-context"] });
    return r;
  }

  if (!p && isFetching)
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4" aria-hidden>
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Your profile</h1>
        <p className="text-sm text-muted-foreground">
          Edit one section at a time — each saves on its own.
          {ctx?.seat === "candidate" && (
            <>
              {" "}
              Manage your CV in the{" "}
              <Link to="/me/cv" className="underline">
                CV tab
              </Link>
              .
            </>
          )}
        </p>
        {ctx?.seat === "candidate" && (
          <div className="mt-4">
            <EmployerPreviewSheet />
          </div>
        )}

        {ctx?.seat === "candidate" && (
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
        )}
      </header>

      <div className="space-y-5">
        {/* Contact */}
        <ProfileSectionCard
          meta={meta("contact")}
          initial={initial.contact}
          autoOpen={openSection === "contact"}
          focusField={field ?? null}
          summary={(v) =>
            v.full_name || v.phone ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Full name</dt>
                  <dd>{v.full_name || "Not added yet."}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Phone</dt>
                  <dd>{v.phone || "Not added yet."}</dd>
                </div>
              </dl>
            ) : null
          }
          fields={({ values, set }) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-full-name">Full name</Label>
                <Input
                  id="p-full-name"
                  value={values.full_name}
                  onChange={(e) => set({ full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-phone">Phone</Label>
                <Input
                  id="p-phone"
                  inputMode="tel"
                  value={values.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </div>
            </div>
          )}
          save={async (v) => {
            const parsed = contactValues.safeParse(v);
            if (!parsed.success)
              return {
                ok: false,
                message: parsed.error.issues[0]?.message ?? "Check these fields.",
              };
            return commit("contact", parsed.data);
          }}
        />

        {/* Email — confirmation flow, never a direct write */}
        <EmailChangeCard />

        {/* Location and time zone */}
        {ctx?.seat === "candidate" && (
          <ProfileSectionCard
            meta={meta("location")}
            initial={initial.location}
            autoOpen={openSection === "location"}
            focusField={field ?? null}
            summary={(v) =>
              v.location || v.timezone ? (
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Based in</dt>
                    <dd>{v.location || "Not added yet."}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Time zone</dt>
                    <dd>{v.timezone || "Not added yet."}</dd>
                  </div>
                </dl>
              ) : null
            }
            fields={({ values, set }) => (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-location">Location</Label>
                  <Input
                    id="p-location"
                    value={values.location}
                    onChange={(e) => set({ location: e.target.value })}
                    placeholder="Lisbon, Portugal"
                  />
                </div>
                <div>
                  <Label htmlFor="p-timezone">Time zone</Label>
                  <Input
                    id="p-timezone"
                    value={values.timezone}
                    onChange={(e) => set({ timezone: e.target.value })}
                    placeholder="Europe/Lisbon"
                  />
                </div>
              </div>
            )}
            save={async (v) => {
              const parsed = locationValues.safeParse(v);
              if (!parsed.success)
                return {
                  ok: false,
                  message: parsed.error.issues[0]?.message ?? "Check these fields.",
                };
              return commit("location", parsed.data);
            }}
          />
        )}
        <ProfileSectionCard
          meta={meta("location")}
          initial={initial.location}
          autoOpen={openSection === "location"}
          focusField={field ?? null}
          summary={(v) =>
            v.location || v.timezone ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Based in</dt>
                  <dd>{v.location || "Not added yet."}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Time zone</dt>
                  <dd>{v.timezone || "Not added yet."}</dd>
                </div>
              </dl>
            ) : null
          }
          fields={({ values, set }) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-location">Location</Label>
                <Input
                  id="p-location"
                  value={values.location}
                  onChange={(e) => set({ location: e.target.value })}
                  placeholder="Lisbon, Portugal"
                />
              </div>
              <div>
                <Label htmlFor="p-timezone">Time zone</Label>
                <Input
                  id="p-timezone"
                  value={values.timezone}
                  onChange={(e) => set({ timezone: e.target.value })}
                  placeholder="Europe/Lisbon"
                />
              </div>
            </div>
          )}
          save={async (v) => {
            const parsed = locationValues.safeParse(v);
            if (!parsed.success)
              return {
                ok: false,
                message: parsed.error.issues[0]?.message ?? "Check these fields.",
              };
            return commit("location", parsed.data);
          }}
        />

        {/* Work authorisation and availability */}
        <ProfileSectionCard
          meta={meta("work_auth")}
          initial={initial.work_auth}
          autoOpen={openSection === "work_auth"}
          focusField={field ?? null}
          summary={(v) =>
            v.work_authorization_note || v.availability_note || v.compensation_note ? (
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Work authorisation</dt>
                  <dd>{v.work_authorization_note || "Not added yet."}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Availability</dt>
                  <dd>{v.availability_note || "Not added yet."}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Compensation</dt>
                  <dd>{v.compensation_note || "Not added yet."}</dd>
                </div>
              </dl>
            ) : null
          }
          fields={({ values, set }) => (
            <div className="space-y-3">
              <div>
                <Label htmlFor="p-work-auth">Work authorisation</Label>
                <Input
                  id="p-work-auth"
                  value={values.work_authorization_note}
                  onChange={(e) => set({ work_authorization_note: e.target.value })}
                  placeholder="EU citizen, US work permit, etc."
                />
              </div>
              <div>
                <Label htmlFor="p-availability">Availability</Label>
                <Input
                  id="p-availability"
                  value={values.availability_note}
                  onChange={(e) => set({ availability_note: e.target.value })}
                  placeholder="Available in 4 weeks, immediate, etc."
                />
              </div>
              <div>
                <Label htmlFor="p-comp">Compensation preferences</Label>
                <Input
                  id="p-comp"
                  value={values.compensation_note}
                  onChange={(e) => set({ compensation_note: e.target.value })}
                  placeholder="Range or expectations"
                />
              </div>
            </div>
          )}
          save={async (v) => {
            const parsed = workAuthValues.safeParse(v);
            if (!parsed.success)
              return {
                ok: false,
                message: parsed.error.issues[0]?.message ?? "Check these fields.",
              };
            return commit("work_auth", parsed.data);
          }}
        />

        {/* Experience */}
        <ProfileSectionCard
          meta={meta("experience")}
          initial={initial.experience}
          autoOpen={openSection === "experience"}
          focusField={field ?? null}
          summary={(v) => {
            const roles = (() => {
              try {
                return parseJsonArray(v.experience_text).length;
              } catch {
                return 0;
              }
            })();
            if (!v.headline && !v.summary && !v.years_experience && roles === 0)
              return null;
            return (
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Headline</dt>
                  <dd>{v.headline || "Not added yet."}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Years of experience</dt>
                  <dd>{v.years_experience || "Not added yet."}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Roles listed</dt>
                  <dd>{roles === 0 ? "Not added yet." : `${roles}`}</dd>
                </div>
                {v.summary && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Summary</dt>
                    <dd className="whitespace-pre-wrap">{v.summary}</dd>
                  </div>
                )}
              </dl>
            );
          }}
          fields={({ values, set }) => (
            <div className="space-y-3">
              <div>
                <Label htmlFor="p-headline">Headline</Label>
                <Input
                  id="p-headline"
                  value={values.headline}
                  onChange={(e) => set({ headline: e.target.value })}
                  placeholder="Senior backend engineer"
                />
              </div>
              <div>
                <Label htmlFor="p-years">Years of experience</Label>
                <Input
                  id="p-years"
                  type="number"
                  min={0}
                  max={80}
                  value={values.years_experience}
                  onChange={(e) => set({ years_experience: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-summary">Summary</Label>
                <Textarea
                  id="p-summary"
                  rows={4}
                  value={values.summary}
                  onChange={(e) => set({ summary: e.target.value })}
                  placeholder="A short paragraph about what you do best."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Roles, education, languages and certifications are JSON arrays for
                now — this keeps parsing exact.
              </p>
              <div>
                <Label htmlFor="p-experience">Experience</Label>
                <Textarea
                  id="p-experience"
                  rows={5}
                  value={values.experience_text}
                  onChange={(e) => set({ experience_text: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-education">Education</Label>
                <Textarea
                  id="p-education"
                  rows={4}
                  value={values.education_text}
                  onChange={(e) => set({ education_text: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-languages">Languages</Label>
                <Textarea
                  id="p-languages"
                  rows={3}
                  value={values.languages_text}
                  onChange={(e) => set({ languages_text: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="p-certifications">Certifications</Label>
                <Textarea
                  id="p-certifications"
                  rows={3}
                  value={values.certifications_text}
                  onChange={(e) => set({ certifications_text: e.target.value })}
                  placeholder='[{"name":"AWS Solutions Architect","year":2024}]'
                />
              </div>
            </div>
          )}
          save={async (v) => {
            let payload;
            try {
              payload = {
                headline: v.headline,
                summary: v.summary,
                years_experience:
                  v.years_experience === "" ? null : Number(v.years_experience),
                experience: parseJsonArray(v.experience_text),
                education: parseJsonArray(v.education_text),
                languages: parseJsonArray(v.languages_text),
                certifications: parseJsonArray(v.certifications_text),
              };
            } catch {
              return {
                ok: false,
                message:
                  "Experience, education, languages and certifications must be valid JSON arrays.",
              };
            }
            const parsed = experienceValues.safeParse(payload);
            if (!parsed.success)
              return {
                ok: false,
                message: parsed.error.issues[0]?.message ?? "Check these fields.",
              };
            return commit("experience", parsed.data);
          }}
        />

        {/* Skills */}
        <ProfileSectionCard
          meta={meta("skills")}
          initial={initial.skills}
          autoOpen={openSection === "skills"}
          focusField={field ?? null}
          summary={(v) =>
            v.skills.trim() ? (
              <ul className="flex flex-wrap gap-2">
                {v.skills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((s) => (
                    <li
                      key={s}
                      className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
                    >
                      {s}
                    </li>
                  ))}
              </ul>
            ) : null
          }
          fields={({ values, set }) => (
            <div>
              <Label htmlFor="p-skills">Skills</Label>
              <Input
                id="p-skills"
                value={values.skills}
                onChange={(e) => set({ skills: e.target.value })}
                placeholder="TypeScript, PostgreSQL, GraphQL"
              />
              <p className="mt-1 text-xs text-muted-foreground">Comma-separated.</p>
            </div>
          )}
          save={async (v) => {
            const parsed = skillsValues.safeParse({
              skills: v.skills
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
            if (!parsed.success)
              return {
                ok: false,
                message: parsed.error.issues[0]?.message ?? "Check these skills.",
              };
            return commit("skills", parsed.data);
          }}
        />

        {/* Links */}
        <ProfileSectionCard
          meta={meta("links")}
          initial={initial.links}
          autoOpen={openSection === "links"}
          focusField={field ?? null}
          summary={(v) =>
            v.linkedin_url || v.portfolio_url ? (
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-muted-foreground">LinkedIn</dt>
                  <dd className="break-all">{v.linkedin_url || "Not added yet."}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Portfolio or website</dt>
                  <dd className="break-all">{v.portfolio_url || "Not added yet."}</dd>
                </div>
              </dl>
            ) : null
          }
          fields={({ values, set }) => (
            <div className="space-y-3">
              <div>
                <Label htmlFor="p-linkedin">LinkedIn URL</Label>
                <Input
                  id="p-linkedin"
                  inputMode="url"
                  value={values.linkedin_url}
                  onChange={(e) => set({ linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/…"
                />
              </div>
              <div>
                <Label htmlFor="p-portfolio">Portfolio / website URL</Label>
                <Input
                  id="p-portfolio"
                  inputMode="url"
                  value={values.portfolio_url}
                  onChange={(e) => set({ portfolio_url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </div>
          )}
          save={async (v) => {
            const parsed = linksValues.safeParse(v);
            if (!parsed.success)
              return {
                ok: false,
                message: parsed.error.issues[0]?.message ?? "Check these links.",
              };
            return commit("links", parsed.data);
          }}
        />
      </div>
    </div>
  );
}
