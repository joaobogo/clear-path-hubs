import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'

interface Props {
  resumeUrl?: string
  roleTitle?: string
  expiresOn?: string
  stepLabel?: string
}

const IntakeResume = ({ resumeUrl, roleTitle, expiresOn, stepLabel }: Props) => (
  <Shell
    preview="Pick your brief up where you left off"
    heading="Your brief is saved"
  >
    <Text style={text}>
      We saved everything you'd entered{roleTitle ? ` for ${roleTitle}` : ''}. Open the link below
      on any device and you'll land exactly where you stopped
      {stepLabel ? `: ${stepLabel}` : ''}.
    </Text>
    {resumeUrl && (
      <Button style={button} href={resumeUrl}>
        Continue my brief
      </Button>
    )}
    <Text style={text}>
      Nothing has been submitted and nothing has been charged. Your saved answers are kept until{' '}
      <strong>{expiresOn ?? 'a month from now'}</strong>.
    </Text>
    <Text style={footer}>
      You're receiving this because you asked us to email you a link back to your brief.
    </Text>
  </Shell>
)

export const template = {
  component: IntakeResume,
  subject: 'Pick your brief up where you left off',
  displayName: 'Intake resume link',
  previewData: {
    resumeUrl: 'https://taasflow.com/api/public/intake-resume?token=example',
    roleTitle: 'Head of Housekeeping',
    expiresOn: '3 September 2026',
    stepLabel: 'Step 3 of 4',
  },
}

export default IntakeResume
