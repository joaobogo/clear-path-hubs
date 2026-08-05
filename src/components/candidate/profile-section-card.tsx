import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { ProfileSectionMeta } from "@/lib/candidate/profile-sections";

type Props<V> = {
  meta: ProfileSectionMeta;
  /** Values derived from the saved profile. */
  initial: V;
  /** Read-only rendering. Return null when nothing has been added yet. */
  summary: (values: V) => ReactNode;
  /** Editable fields for this section only. */
  fields: (args: {
    values: V;
    set: (patch: Partial<V>) => void;
    error: string | null;
  }) => ReactNode;
  /** Saves this section alone. */
  save: (values: V) => Promise<{ ok: boolean; message?: string }>;
  /** Open in edit mode on mount (deep link from /me). */
  autoOpen?: boolean;
  /** Field id to focus once open. */
  focusField?: string | null;
};

/**
 * One profile section that opens for editing in place and saves on its own.
 *
 * A failed save keeps every entered value and shows the message inside this
 * card; no other section is touched. The save control sits in a sticky footer
 * so it stays reachable above a mobile keyboard.
 */
export function ProfileSectionCard<V extends object>({
  meta,
  initial,
  summary,
  fields,
  save,
  autoOpen = false,
  focusField = null,
}: Props<V>) {
  const [editing, setEditing] = useState(autoOpen);
  const [values, setValues] = useState<V>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const focused = useRef(false);

  // Re-seed from the server only while the section is closed, so a failed save
  // never discards what the candidate typed.
  useEffect(() => {
    if (!editing) setValues(initial);
  }, [initial, editing]);

  useEffect(() => {
    if (!editing || !focusField || focused.current) return;
    focused.current = true;
    const el = document.getElementById(focusField);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    (el as HTMLElement).focus({ preventScroll: true });
  }, [editing, focusField]);

  const read = summary(values);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await save(values);
      if (r.ok) {
        setEditing(false);
        setSavedAt(Date.now());
      } else {
        setError(r.message ?? "That didn't save. Your changes are still here.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^Error: /, "")
          : "That didn't save. Your changes are still here.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{meta.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
        </div>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => {
              focused.current = false;
              setEditing(true);
            }}
          >
            {read ? "Edit" : "Add"}
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="border-t px-5 py-4 text-sm">
          {read ?? (
            <p className="text-muted-foreground">Not added yet.</p>
          )}
          {savedAt && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              Saved.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="border-t">
          <div className="space-y-4 px-5 py-4">
            {fields({ values, set: (patch) => setValues({ ...values, ...patch }), error })}
            {error && (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error} Nothing else on this page was changed.
              </p>
            )}
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-card/95 px-5 py-3 backdrop-blur">
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? "Saving…" : `Save ${meta.title.toLowerCase()}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={saving}
              onClick={() => {
                setValues(initial);
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
