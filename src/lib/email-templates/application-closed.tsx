import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'
import { candidateStatusEmailLine } from '@/lib/candidate/status-vocabulary'

interface ApplicationClosedProps {
  candidateFirstName?: string
  positionTitle?: string
  organizationName?: string
  reference?: string
  jobsUrl?: string
  /** True when the candidate opted into the talent network. */
  inTalentNetwork?: boolean
}

const ApplicationClosed = ({
  candidateFirstName,
  positionTitle,
  organizationName,
  reference,
  jobsUrl,
  inTalentNetwork,
}: ApplicationClosedProps) => (
  <Shell
    preview={`An update on your application${positionTitle ? ` — ${positionTitle}` : ''}`}
    heading="An update on your application"
  >
    <Text style={text}>{candidateFirstName ? `Hi ${candidateFirstName},` : 'Hi,'}</Text>
    <Text style={text}>
      Thank you for the time you put into applying for{' '}
      <strong>{positionTitle ?? 'this role'}</strong>
      {organizationName ? ` at ${organizationName}` : ''}. After review, the hiring team has decided
      not to take your application further this time.
    </Text>
    <Text style={text}>
      That is a decision about one role and one shortlist on one day — not a verdict on your work.
      We would rather tell you plainly than leave you waiting.
    </Text>
    {inTalentNetwork ? (
      <Text style={text}>
        You asked to stay in our talent network, so we will keep your details on file and get in
        touch when a closer match opens up.
      </Text>
    ) : null}
    <Text style={text}>{candidateStatusEmailLine('Closed')}</Text>
    {jobsUrl && (
      <Button style={button} href={jobsUrl}>
        See open roles
      </Button>
    )}
    <Text style={footer}>
      Reference {reference ?? '—'}. You can ask us to delete your data at any time by replying to
      this email or from your status page.
    </Text>
  </Shell>
)

export const template = {
  component: ApplicationClosed,
  subject: (d: Record<string, any>) =>
    `An update on your application${d?.positionTitle ? ` — ${d.positionTitle}` : ''}`,
  displayName: 'Candidate — application closed',
  previewData: {
    candidateFirstName: 'Ana',
    positionTitle: 'Social Media & Design Specialist',
    organizationName: 'Flow Group Ventures',
    reference: 'A1B2C3',
    jobsUrl: 'https://taasflow.com/jobs',
    inTalentNetwork: true,
  },
} satisfies TemplateEntry
