import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface ProfileIncompleteProps {
  candidateFirstName?: string
  positionTitle?: string
  /** Plain-language list of what is missing, e.g. ['a CV', 'your location']. */
  missing?: string[]
  profileUrl?: string
  /** Second and final nudge — say so plainly. */
  finalNudge?: boolean
}

const ProfileIncomplete = ({
  candidateFirstName,
  positionTitle,
  missing,
  profileUrl,
  finalNudge,
}: ProfileIncompleteProps) => {
  const items = (missing ?? []).filter(Boolean)
  return (
    <Shell
      preview="One or two things are missing from your application"
      heading="Your application is missing something"
    >
      <Text style={text}>{candidateFirstName ? `Hi ${candidateFirstName},` : 'Hi,'}</Text>
      <Text style={text}>
        You applied{positionTitle ? ` for ${positionTitle}` : ''} and we can read your application —
        but a reviewer will get a much fairer picture with {items.length > 1 ? 'these' : 'this'}:
      </Text>
      {items.length > 0 ? (
        <Text style={text}>{items.map((m) => `• ${m}`).join('\n')}</Text>
      ) : (
        <Text style={text}>• a complete profile and an up-to-date CV</Text>
      )}
      <Text style={text}>It takes a couple of minutes and you keep it for future roles.</Text>
      {profileUrl ? (
        <Button style={button} href={profileUrl}>
          Finish your profile
        </Button>
      ) : null}
      <Text style={footer}>
        {finalNudge
          ? 'This is the last reminder we send about this — we will not chase you again.'
          : 'We send at most two reminders about this.'}{' '}
        You can turn reminders off in your candidate settings.
      </Text>
    </Shell>
  )
}

export const template = {
  component: ProfileIncomplete,
  subject: 'One or two things are missing from your application',
  displayName: 'Candidate — profile incomplete nudge',
  previewData: {
    candidateFirstName: 'Ana',
    positionTitle: 'Social Media & Design Specialist',
    missing: ['a CV in PDF form', 'your location'],
    profileUrl: 'https://taasflow.com/me/profile',
    finalNudge: false,
  },
} satisfies TemplateEntry
