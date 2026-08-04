# Lead notifications

Every legitimate lead captured anywhere on the website runs through one path.
There is no per-form notification code any more.

## The single entry point

```ts
import { processLeadEvent } from "@/lib/leads/lead-pipeline.server";
```

`processLeadEvent(event)` is server-only and never throws into the caller. It:

1. Writes a permanent row to `public.lead_notifications`, idempotent on
   `lead_type:sourceId`. A repeat call for the same lead notifies nothing.
2. Posts a Microsoft Teams card to the staff channel.
3. Sends the `internal-lead-alert` email to the configured recipients.
4. Records per-channel status, detail and timestamp so delivery is traceable
   and retryable.

The lead's own primary record (application, intake, contact message, booking
session) and the visitor's confirmation never depend on Teams or email being
healthy.

## Wired surfaces

| Surface | Lead type | Primary record |
| --- | --- | --- |
| `/contact` (`api/public/contact`) | `contact_message` | `contact_messages` |
| Marketing forms (`submitInquiry`) | `marketing_inquiry` | `marketing_inquiries` |
| Full employer intake (`api/public/intake`) | `employer_intake` | `intake_submissions` |
| Express onboarding (`api/public/express-intake`) | `express_intake` | `intake_submissions` |
| Booking step 1 (`submitBookingIntake`) | `discovery_call` | `booking_sessions` |
| Calendly webhook (booked / rescheduled / cancelled) | `discovery_call` | `booking_sessions` |
| Job board application (`submitApplication`) | `candidate_application` | `applications` |

## Configuration

All routing lives in `src/config/lead-notifications.ts`. Nothing is hardcoded
at a call site.

| Variable | Effect |
| --- | --- |
| `LEAD_ALERT_RECIPIENTS` | Comma-separated internal recipients for all lead types |
| `LEAD_ALERT_RECIPIENTS_<LEAD_TYPE>` | Overrides recipients for one lead type, e.g. `LEAD_ALERT_RECIPIENTS_CANDIDATE_APPLICATION` |
| `TEAMS_TEAM_ID` / `TEAMS_CHANNEL_ID` | Teams destination |
| `PUBLIC_APP_URL` | Origin used in Teams and email deep links |

With no variables set, alerts go to `john.kasprzak@taasflow.com` so a lead is
never silently un-notified.

## Monitoring and retry

`/admin/lead-delivery` (platform staff only) lists every lead with its Teams
and email result, failure detail, recipients, attempt count and CRM status. It
offers:

- **Only failures** — the queue that needs attention.
- **Retry** — re-attempts only the channels that failed; a delivered channel is
  never re-sent.
- **Send test lead** — pushes a real event through the real pipeline and reports
  the live per-channel result.

## Adding a new lead surface

1. Persist the lead in its own table first.
2. Confirm to the submitter.
3. Call `processLeadEvent` with a stable `sourceId` (the record id) so retries
   never double-notify.

Add a new `LeadType` to `src/config/lead-notifications.ts` if the surface is a
genuinely new category; otherwise reuse the closest existing one.
