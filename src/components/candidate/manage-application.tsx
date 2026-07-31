import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  CandidateEditableDetails,
  CandidateUpdateResult,
} from "@/lib/candidate-self-service.functions";

const MAX_CV_BYTES = 10 * 1024 * 1024;

type Credentials = { reference: string; email: string };

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(bin);
}

export function ManageApplication({
  credentials,
  details,
  onUpdated,
  updateFn,
  deleteFn,
}: {
  credentials: Credentials;
  details: CandidateEditableDetails;
  onUpdated: () => Promise<void> | void;
  updateFn: (args: { data: Record<string, unknown> }) => Promise<CandidateUpdateResult>;
  deleteFn: (args: {
    data: Record<string, unknown>;
  }) => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(details.full_name ?? "");
  const [phone, setPhone] = useState(details.phone ?? "");
  const [location, setLocation] = useState(details.location ?? "");
  const [cv, setCv] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setMessage(null);
    if (cv) {
      if (cv.type !== "application/pdf" && !cv.name.toLowerCase().endsWith(".pdf")) {
        setError("CVs must be PDF files.");
        return;
      }
      if (cv.size > MAX_CV_BYTES) {
        setError("That file is over 10MB. Please upload a smaller PDF.");
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...credentials,
        full_name: fullName.trim() || undefined,
        phone: phone.trim(),
        location: location.trim(),
      };
      if (cv) {
        payload.cv = {
          filename: cv.name,
          mime: cv.type || "application/pdf",
          base64: await fileToBase64(cv),
        };
      }
      const res = await updateFn({ data: payload });
      if (res.ok) {
        setCv(null);
        setMessage(
          res.cv_replaced
            ? "Saved. Your new CV is the one the team will review."
            : "Saved. Your details have been updated.",
        );
        await onUpdated();
      } else {
        setError(res.message);
      }
    } catch {
      setError("Something went wrong on our end. Nothing was lost — try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  const requestDeletion = async () => {
    setDeleting(true);
    try {
      const res = await deleteFn({ data: { ...credentials, note: note.trim() || undefined } });
      setDeleteMessage(res.message);
    } catch {
      setDeleteMessage(
        "We couldn't log that request. Please email privacy@taasflow.com and we'll handle it by hand.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border bg-card p-6">
      <h3 className="text-base font-semibold">Your details</h3>
      {details.editable ? (
        <p className="mt-1 text-sm text-muted-foreground">
          You can correct your details or upload a newer CV until this role closes. Every change is
          recorded with the application.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {details.reason ?? "This application can no longer be changed."}
        </p>
      )}

      {details.editable && !open && (
        <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
          Correct my details
        </Button>
      )}

      {details.editable && open && (
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="m_name">Full name</Label>
            <Input id="m_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="m_phone">Phone</Label>
              <Input
                id="m_phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="m_loc">Location</Label>
              <Input id="m_loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="m_cv">Replace your CV (PDF only, up to 10MB)</Label>
            <Input
              id="m_cv"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setCv(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {cv
                ? `New file: ${cv.name}`
                : details.cv_filename
                  ? `Currently on file: ${details.cv_filename}`
                  : "No CV on file."}
            </p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {message && (
        <Alert className="mt-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <hr className="my-6" />

      <h3 className="text-base font-semibold">Your data</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        We hold your CV, answers and contact details to review this application. Only our review
        team and the employer for this role can see them. You can ask us to delete everything —
        we'll action it within 30 days and confirm by email.
      </p>

      {deleteMessage ? (
        <Alert className="mt-4">
          <AlertDescription>{deleteMessage}</AlertDescription>
        </Alert>
      ) : deleteOpen ? (
        <div className="mt-4 space-y-3">
          <Label htmlFor="m_note">Anything you want us to know (optional)</Label>
          <Textarea
            id="m_note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional context for the team handling your request."
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="destructive" onClick={requestDeletion} disabled={deleting}>
              {deleting ? "Sending…" : "Confirm deletion request"}
            </Button>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="mt-4" onClick={() => setDeleteOpen(true)}>
          Request deletion of my data
        </Button>
      )}
    </section>
  );
}
