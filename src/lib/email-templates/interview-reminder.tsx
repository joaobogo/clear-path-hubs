import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface InterviewReminderProps {
  candidateFirstName?: string
  positionTitle?: string
  organizationName?: string
  /** Already formatted in the candidate's timezone by the sender. */
  whenLabel?: string
  timezone?: string
  /** UTC offset in force on that date, e.g. "GMT+1". */
  offsetLabel?: string | null
  meetingUrl?: string | null
  location?: string | null
  manageUrl?: string
  window?: '24h' | '1h'
}

const InterviewReminder = ({
  candidateFirstName,
  positionTitle,
  organizationName,
  whenLabel,
  timezone,
  offsetLabel,
  meetingUrl,
  location,
  manageUrl,
  window: reminderWindow,
}: InterviewReminderProps) => {
  const soon = reminderWindow === '1h'
  return (
    <Shell
      preview={soon ? 'Your interview starts within the hour' : 'Your interview is tomorrow'}
      heading={soon ? 'Your interview starts soon' : 'Your interview is tomorrow'}
    >
      <Text style={text}>{candidateFirstName ? `Hi ${candidateFirstName},` : 'Hi,'}</Text>
      <Text style={text}>
        A reminder about your interview for <strong>{positionTitle ?? 'the role'}</strong>
        {organizationName ? ` at ${organizationName}` : ''}.
      </Text>
      <Text style={text}>
        <strong>{whenLabel ?? 'See your status page for the time'}</strong>
        {timezone ? ` (${timezone}${offsetLabel ? `, ${offsetLabel}` : ''})` : ''}
      </Text>
      {timezone ? (
        <Text style={text}>
          Times are shown in {timezone}
          {offsetLabel ? ` (${offsetLabel})` : ''} — your timezone on record. Tell us if that is
          wrong.
        </Text>
      ) : null}
      {location ? <Text style={text}>Where: {location}</Text> : null}
      {meetingUrl ? (
        <Button style={button} href={meetingUrl}>
          Join the interview
        </Button>
      ) : manageUrl ? (
        <Button style={button} href={manageUrl}>
          View the details
        </Button>
      ) : null}
      <Text style={text}>
        If something has come up, tell us now rather than later — rescheduling is normal and costs
        you nothing.
      </Text>
      <Text style={footer}>
        You receive interview reminders because you have an interview booked. You can turn other
        emails off in your candidate settings.
      </Text>
    </Shell>
  )
}

export const template = {
  component: InterviewReminder,
  subject: (d: Record<string, any>) =>
    d?.window === '1h'
      ? `Starting soon: your interview${d?.positionTitle ? ` — ${d.positionTitle}` : ''}`
      : `Tomorrow: your interview${d?.positionTitle ? ` — ${d.positionTitle}` : ''}`,
  displayName: 'Candidate — interview reminder',
  previewData: {
    candidateFirstName: 'Ana',
    positionTitle: 'Social Media & Design Specialist',
    organizationName: 'Example Client Co (preview)',
    whenLabel: 'Tuesday 14 May, 10:00',
    timezone: 'Europe/Lisbon',
    offsetLabel: 'GMT+1',
    meetingUrl: 'https://meet.example.com/abc',
    manageUrl: 'https://taasflow.com/me/interviews',
    window: '24h',
  },
} satisfies TemplateEntry
