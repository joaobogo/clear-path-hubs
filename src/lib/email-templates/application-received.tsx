import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'
import { candidateStatusEmailLine } from '@/lib/candidate/status-vocabulary'
import {
  APPLICATION_NEXT_STEPS,
  CONTACT_METHOD_SENTENCE,
  REVIEW_WINDOW_EMAIL_LINE,
} from '@/lib/candidate/response-commitment'

interface ApplicationReceivedProps {
  candidateFirstName?: string
  positionTitle?: string
  organizationName?: string
  reference?: string
  statusUrl?: string
  /** Honest, plain-language line about when they will hear back. */
  responseWindow?: string
}

const ApplicationReceived = ({
  candidateFirstName,
  positionTitle,
  organizationName,
  reference,
  statusUrl,
  responseWindow,
}: ApplicationReceivedProps) => (
  <Shell
    preview={`Application received — ${positionTitle ?? 'your role'} (${reference ?? ''})`}
    heading="We have your application"
  >
    <Text style={text}>
      {candidateFirstName ? `Hi ${candidateFirstName},` : 'Hi,'}
    </Text>
    <Text style={text}>
      Thanks for applying for <strong>{positionTitle ?? 'the role'}</strong>
      {organizationName ? ` at ${organizationName}` : ''}. Your CV and answers are safely with our
      review team.
    </Text>
    <Text style={text}>
      Your reference is <strong>{reference ?? '—'}</strong>. Keep it — you can check where your
      application stands at any time with that reference and this email address. No account needed.
    </Text>
    <Text style={text}>{candidateStatusEmailLine('Received')}</Text>
    <Text style={{ ...text, fontWeight: 600 }}>What happens next</Text>
    {APPLICATION_NEXT_STEPS.map((step, i) => (
      <Text key={step.title} style={text}>
        <strong>
          {i + 1}. {step.title}.
        </strong>{' '}
        {step.detail}
      </Text>
    ))}
    <Text style={text}>
      <strong>When you&apos;ll hear back:</strong> {responseWindow ?? REVIEW_WINDOW_EMAIL_LINE}
    </Text>
    <Text style={text}>{CONTACT_METHOD_SENTENCE}</Text>
    {statusUrl && (
      <Button style={button} href={statusUrl}>
        Track your application
      </Button>
    )}
    <Text style={footer}>
      We store your CV, answers and contact details to review this application. Only the TaaSFlow
      review team and the employer for this role can see them. You can ask us to correct or delete
      your data at any time from your status page, or by replying to this email.
    </Text>
  </Shell>
)

export const template = {
  component: ApplicationReceived,
  subject: (d: Record<string, any>) =>
    `Application received${d?.positionTitle ? ` — ${d.positionTitle}` : ''}${
      d?.reference ? ` (${d.reference})` : ''
    }`,
  displayName: 'Candidate — application received',
  previewData: {
    candidateFirstName: 'Ana',
    positionTitle: 'Social Media & Design Specialist',
    organizationName: 'Flow Group Ventures',
    reference: 'A1B2C3',
    statusUrl: 'https://taasflow.com/apply/status?ref=A1B2C3',
  },
} satisfies TemplateEntry
