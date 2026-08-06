import { Input } from "@/components/ui/input";

export function ConfirmForm({
  scheduledAt,
  setScheduledAt,
  tz,
  setTz,
  duration,
  setDuration,
  meetingUrl,
  setMeetingUrl,
  location,
  setLocation,
}: {
  scheduledAt: string;
  setScheduledAt: (v: string) => void;
  tz: string;
  setTz: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  meetingUrl: string;
  setMeetingUrl: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className="text-sm font-medium">Date & time</label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Timezone</label>
          <Input value={tz} onChange={(e) => setTz(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Duration (min)</label>
          <Input
            type="number"
            min={15}
            max={480}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 45)}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Meeting link (optional)</label>
        <Input
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          className="mt-1"
          placeholder="https://…"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Location (optional)</label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-1"
          placeholder="Office address or room"
        />
      </div>
    </div>
  );
}
