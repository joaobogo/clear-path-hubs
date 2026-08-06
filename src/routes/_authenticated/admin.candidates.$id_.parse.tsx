import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, FileText, RotateCcw, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BAND_CLASS,
  BAND_DEFINITION,
  BAND_LABEL,
  type ConfidenceBand,
} from "@/lib/parse-review/confidence-bands";
import { getParseReview, saveFieldReview } from "@/lib/parse-review/parse-review.functions";

export const Route = createFileRoute("/_authenticated/admin/candidates/$id_/parse")({
  head: () => ({
    meta: [
      { title: "Parse review · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Review what was read from a CV beside the original document, with field-level confidence and reversible corrections.",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Match not found.</div>
  ),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.candidates.$id_.parse.tsx",
  ),
  component: ParseReview,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function BandChip({ band }: { band: ConfidenceBand }) {
  return (
    <span
      title={BAND_DEFINITION[band]}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${BAND_CLASS[band]}`}
    >
      {BAND_LABEL[band]}
    </span>
  );
}

function ParseReview() {
  const { id } = Route.useParams();
  const fetchReview = useServerFn(getParseReview);
  const save = useServerFn(saveFieldReview);

  const query = useQuery({
    queryKey: ["parse-review", id],
    queryFn: () => fetchReview({ data: { matchId: id } }),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const docRef = useRef<HTMLDivElement | null>(null);

  const data = query.data as Any;
  const fields: Any[] = data?.fields ?? [];
  const items: Any[] = data?.items ?? [];
  const cvText: string = data?.cv?.text ?? "";

  const selectedField = useMemo(
    () => fields.find((f) => f.path === selected) ?? null,
    [fields, selected],
  );
  const activeOffset: number | null = selectedField?.offset ?? null;
  const activeLength: number = (selectedField?.machineValue ?? "").replace(/\s+/g, " ").length;

  // Highlight the located passage inside the rendered document text.
  const docParts = useMemo(() => {
    const normalized = cvText.replace(/\s+/g, " ");
    if (activeOffset === null || activeLength < 3) return [{ text: normalized, hit: false }];
    return [
      { text: normalized.slice(0, activeOffset), hit: false },
      { text: normalized.slice(activeOffset, activeOffset + activeLength), hit: true },
      { text: normalized.slice(activeOffset + activeLength), hit: false },
    ];
  }, [cvText, activeOffset, activeLength]);

  useEffect(() => {
    if (activeOffset === null) return;
    const el = docRef.current?.querySelector("[data-hit='true']");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeOffset]);

  async function persist(field: Any, patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await save({
        data: {
          matchId: id,
          fieldPath: field.path,
          fieldLabel: field.label,
          machineValue: field.machineValue,
          located: field.located,
          ...patch,
        } as Any,
      });
      await query.refetch();
    } catch (e: Any) {
      toast.error(e?.message ?? "Could not save the review");
    } finally {
      setSaving(false);
    }
  }

  if (query.isLoading) {
    return <div className="p-10 text-sm text-muted-foreground">Loading the parse…</div>;
  }
  if (query.isError) {
    return (
      <Alert variant="destructive" className="m-6">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>We could not load this parse</AlertTitle>
        <AlertDescription>
          {(query.error as Any)?.message ?? "Unexpected error"}{" "}
          <button className="underline" onClick={() => query.refetch()} type="button">
            Try again
          </button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!data) throw notFound();

  const s = data.summary;
  const groups: { key: string; label: string }[] = [
    { key: "identity", label: "Identity" },
    { key: "experience", label: "Experience" },
    { key: "skills", label: "Skills" },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/candidates/$id"
            params={{ id }}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to candidate
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">
            Parse review — {data.match.candidate_name ?? "Candidate"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.match.position_title ?? "—"} · {s.filled} of {s.total} fields read
            {s.unlocated > 0 && ` · ${s.unlocated} not found in the document`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.cv?.signed_url && (
            <Button asChild variant="outline" size="sm">
              <a href={data.cv.signed_url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open original PDF
              </a>
            </Button>
          )}
          <Link
            to="/admin/candidates/$id/evidence"
            params={{ id }}
            className="text-sm underline underline-offset-2"
          >
            Evidence record
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        {(["confirmed", "probable", "needs_review"] as ConfidenceBand[]).map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <BandChip band={b} />
            <span className="text-muted-foreground">{s[b === "needs_review" ? "needs_review" : b]}</span>
          </span>
        ))}
        {s.excluded_from_scoring > 0 && (
          <span className="text-muted-foreground">
            · {s.excluded_from_scoring} excluded from scoring until confirmed
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* The original document */}
        <section className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-medium">
            <FileText className="h-4 w-4" />
            {data.cv?.filename ?? "No CV on file"}
            {data.cv?.ocr_used && (
              <Badge variant="outline" className="ml-auto text-[11px]">
                OCR — offsets approximate
              </Badge>
            )}
          </div>
          <div
            ref={docRef}
            className="max-h-[70vh] overflow-y-auto px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          >
            {cvText ? (
              docParts.map((p, i) => (
                <span
                  key={i}
                  data-hit={p.hit ? "true" : undefined}
                  className={p.hit ? "rounded bg-primary/20 px-0.5 ring-1 ring-primary/40" : undefined}
                >
                  {p.text}
                </span>
              ))
            ) : (
              <p className="text-muted-foreground">
                No document text is stored for this application, so no field can be located here.
              </p>
            )}
          </div>
        </section>

        {/* The parsed fields */}
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2.5 text-sm font-medium">What we read</div>
          <div className="max-h-[70vh] divide-y overflow-y-auto">
            {groups.map((g) => {
              const rows = fields.filter((f) => f.group === g.key);
              if (!rows.length) return null;
              return (
                <div key={g.key}>
                  <div className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </div>
                  {rows.map((f) => {
                    const isEditing = editing === f.path;
                    return (
                      <div
                        key={f.path}
                        className={`px-4 py-2.5 ${selected === f.path ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setSelected(f.path)}
                          >
                            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                              {f.label}
                            </div>
                            <div className="text-sm">
                              {f.effectiveValue ?? (
                                <span className="text-muted-foreground">Empty</span>
                              )}
                            </div>
                            {f.humanValue && (
                              <div className="mt-0.5 text-[11px] text-muted-foreground">
                                Machine read: {f.machineValue ?? "empty"}
                              </div>
                            )}
                            {f.effectiveValue && !f.located && (
                              <div className="mt-0.5 text-[11px] text-destructive">
                                Location unknown — not found in the document
                              </div>
                            )}
                          </button>
                          <BandChip band={f.band} />
                        </div>

                        {selected === f.path && (
                          <div className="mt-2 space-y-2">
                            {f.passage && (
                              <p className="rounded border-l-2 border-primary/40 bg-muted/40 px-2 py-1 text-[12px] text-muted-foreground">
                                “{f.passage}”
                              </p>
                            )}
                            {isEditing ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={draft}
                                  onChange={(e) => setDraft(e.target.value)}
                                  className="h-8 max-w-sm text-sm"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  disabled={saving}
                                  onClick={async () => {
                                    await persist(f, {
                                      humanValue: draft.trim() || null,
                                      reviewState: draft.trim() ? "corrected" : "unreviewed",
                                    });
                                    setEditing(null);
                                  }}
                                >
                                  Save correction
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={saving}
                                  onClick={() => persist(f, { reviewState: "confirmed" })}
                                >
                                  <Check className="mr-1.5 h-3.5 w-3.5" /> Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditing(f.path);
                                    setDraft(f.effectiveValue ?? "");
                                  }}
                                >
                                  Correct
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={saving}
                                  onClick={() =>
                                    persist(f, { reviewState: "passage_mismatch", humanValue: f.humanValue ?? null })
                                  }
                                >
                                  Passage does not match
                                </Button>
                                {(f.humanValue || f.reviewState !== "unreviewed") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={saving}
                                    onClick={() =>
                                      persist(f, { humanValue: null, reviewState: "unreviewed" })
                                    }
                                  >
                                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to machine value
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {items.length > 0 && (
              <div>
                <div className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Evidence passages
                </div>
                {items.map((it) => (
                  <div key={it.id} className="px-4 py-2.5">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {it.dimension} · {it.criterion}
                    </div>
                    <div className="text-sm">{it.meaning}</div>
                    {it.located ? (
                      <button
                        type="button"
                        className="mt-1 text-[12px] underline underline-offset-2"
                        onClick={() => {
                          setSelected(null);
                          const el = docRef.current;
                          if (el) el.scrollTop = 0;
                          toast.message("Passage stored", { description: it.passage ?? "" });
                        }}
                      >
                        View stored passage
                      </button>
                    ) : (
                      <div className="mt-1 text-[12px] text-destructive">Location unknown</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
