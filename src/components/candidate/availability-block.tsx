import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { updateMyAvailabilityPreference } from "@/lib/candidate.functions";
import {
  AVAILABILITY_BANDS,
  AVAILABILITY_DAYS,
  EMPTY_PREFERENCE_LINE,
  availabilityPreferenceSchema,
  browserTimezone,
  emptyPreference,
  isPreferenceSet,
  isValidZone,
  isoDateInZone,
  parseStoredPreference,
  type AvailabilityBand,
  type AvailabilityPreference,
} from "@/lib/candidate/availability-preference";

type Errors = { timezone?: string; dates?: string; note?: string; form?: string };

/**
 * Prompt 1 — general availability, given once.
 *
 * Everything is optional and framed as a preference: we still propose times and
 * the candidate still chooses. Days and bands are 44px toggle chips so no date
 * picker is needed, and the time zone defaults from the browser but stays
 * editable.
 */
export function AvailabilityBlock({
  availability,
  loading,
  profileTimezone,
  onSaved,
}: {
  availability: unknown;
  loading?: boolean;
  profileTimezone?: string | null;
  onSaved?: () => void;
}) {
  const saveFn = useServerFn(updateMyAvailabilityPreference);
  const stored = parseStoredPreference(availability);
  const fallbackZone = profileTimezone || browserTimezone();

  const [pref, setPref] = useState<AvailabilityPreference>(
    () => stored ?? emptyPreference(fallbackZone),
  );
  const [newDate, setNewDate] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  // Adopt the saved values when they arrive, without discarding an edit.
  const storedKey = JSON.stringify(stored ?? null);
  useEffect(() => {
    if (stored) setPref(stored.timezone ? stored : { ...stored, timezone: fallbackZone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  const save = useMutation({
    mutationFn: (value: AvailabilityPreference) => saveFn({ data: { preference: value } }),
    onSuccess: (r) => {
      if (r.ok) {
        setErrors({});
        toast.success("Availability saved. We'll use it as a starting point.");
        onSaved?.();
      } else {
        // Values stay exactly as typed.
        setErrors({ form: r.message ?? "Could not save. Your entries are still here." });
      }
    },
    onError: () =>
      setErrors({ form: "Could not save. Your entries are still here — try again." }),
  });

  if (loading) {
    return (
      <section className="rounded-lg border bg-card p-5 space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-16 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-28 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-xs" />
      </section>
    );
  }

  const toggleDay = (day: number) =>
    setPref((p) => ({
      ...p,
      days: p.days.includes(day) ? p.days.filter((d) => d !== day) : [...p.days, day],
    }));

  const toggleBand = (band: AvailabilityBand) =>
    setPref((p) => ({
      ...p,
      bands: p.bands.includes(band) ? p.bands.filter((b) => b !== band) : [...p.bands, band],
    }));

  const addDate = () => {
    const value = newDate.trim();
    if (!value) {
      setErrors((e) => ({ ...e, dates: "Pick a date first." }));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setErrors((e) => ({ ...e, dates: "Use a date like 2026-08-24." }));
      return;
    }
    if (value < isoDateInZone(new Date(), "UTC")) {
      setErrors((e) => ({ ...e, dates: "That date has already passed." }));
      return;
    }
    if (pref.unavailable_dates.includes(value)) {
      setErrors((e) => ({ ...e, dates: "That date is already listed." }));
      return;
    }
    if (pref.unavailable_dates.length >= 30) {
      setErrors((e) => ({ ...e, dates: "You can list up to 30 dates." }));
      return;
    }
    setErrors((e) => ({ ...e, dates: undefined }));
    setPref((p) => ({ ...p, unavailable_dates: [...p.unavailable_dates, value].sort() }));
    setNewDate("");
  };

  const submit = () => {
    const next: Errors = {};
    if (pref.timezone && !isValidZone(pref.timezone)) {
      next.timezone = "We don't recognise that time zone. Try Europe/London.";
    }
    const parsed = availabilityPreferenceSchema.safeParse(pref);
    if (!parsed.success) {
      next.form = "Please check the highlighted fields.";
    }
    if (pref.note.length > 300) next.note = "Keep this under 300 characters.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;
    save.mutate(parsed.data);
  };

  const isSet = isPreferenceSet(pref);

  return (
    <section className="rounded-lg border bg-card p-5 space-y-5">
      <div>
        <h2 className="text-sm font-medium">General availability</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Tell us when interviews usually suit you and we'll start there instead of asking
          every time. This is a preference, not a commitment — you can always accept a time
          outside it, or decline one inside it.
        </p>
      </div>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">Preferred days</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">Optional. Leave blank for any day.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVAILABILITY_DAYS.map((d) => {
            const on = pref.days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${d.full}${on ? " — preferred" : ""}`}
                onClick={() => toggleDay(d.value)}
                className={`min-h-11 min-w-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:bg-muted"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">Preferred times of day</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Optional. Leave blank for any time.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVAILABILITY_BANDS.map((b) => {
            const on = pref.bands.includes(b.value);
            return (
              <button
                key={b.value}
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${b.label}, ${b.hint}${on ? " — preferred" : ""}`}
                onClick={() => toggleBand(b.value)}
                className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:bg-muted"
                }`}
              >
                {b.label}
                <span className="ml-1 hidden text-xs font-normal opacity-80 sm:inline">
                  {b.hint}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="max-w-sm">
        <Label htmlFor="availability-timezone" className="text-sm font-medium">
          Your time zone
        </Label>
        <Input
          id="availability-timezone"
          className="mt-1 min-h-11"
          value={pref.timezone}
          aria-invalid={errors.timezone ? true : undefined}
          aria-describedby={errors.timezone ? "availability-timezone-error" : undefined}
          placeholder="Europe/London"
          onChange={(e) => setPref((p) => ({ ...p, timezone: e.target.value }))}
        />
        {errors.timezone ? (
          <p id="availability-timezone-error" className="mt-1 text-xs text-destructive">
            {errors.timezone}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Detected from your browser. Change it whenever you like.
          </p>
        )}
      </div>

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">Dates you're not available</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Optional. Holidays or days you know won't work.
        </p>
        {pref.unavailable_dates.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {pref.unavailable_dates.map((d) => (
              <li key={d}>
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">
                  {d}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    aria-label={`Remove ${d}`}
                    onClick={() =>
                      setPref((p) => ({
                        ...p,
                        unavailable_dates: p.unavailable_dates.filter((v) => v !== d),
                      }))
                    }
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <Input
            type="date"
            className="min-h-11 w-auto"
            aria-label="Date you're not available"
            aria-invalid={errors.dates ? true : undefined}
            aria-describedby={errors.dates ? "availability-dates-error" : undefined}
            value={newDate}
            min={isoDateInZone(new Date(), "UTC")}
            onChange={(e) => setNewDate(e.target.value)}
          />
          <Button type="button" variant="outline" className="min-h-11" onClick={addDate}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Add date
          </Button>
        </div>
        {errors.dates ? (
          <p id="availability-dates-error" className="mt-1 text-xs text-destructive">
            {errors.dates}
          </p>
        ) : null}
      </fieldset>

      <div>
        <Label htmlFor="availability-note" className="text-sm font-medium">
          Anything else worth knowing
        </Label>
        <Input
          id="availability-note"
          className="mt-1 min-h-11"
          maxLength={300}
          value={pref.note}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? "availability-note-error" : undefined}
          placeholder="Two hours' notice is usually enough."
          onChange={(e) => setPref((p) => ({ ...p, note: e.target.value }))}
        />
        {errors.note ? (
          <p id="availability-note-error" className="mt-1 text-xs text-destructive">
            {errors.note}
          </p>
        ) : null}
      </div>

      {!isSet ? (
        <p className="text-xs text-muted-foreground">{EMPTY_PREFERENCE_LINE}</p>
      ) : null}
      {errors.form ? (
        <p className="text-sm text-destructive" role="alert">
          {errors.form}
        </p>
      ) : null}

      <Button
        type="button"
        className="min-h-11"
        onClick={submit}
        disabled={save.isPending}
        aria-busy={save.isPending || undefined}
      >
        {save.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Saving…
          </>
        ) : (
          "Save availability"
        )}
      </Button>
    </section>
  );
}
