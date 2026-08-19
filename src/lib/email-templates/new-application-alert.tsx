import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface NewApplicationAlertProps {
  candidateName?: string
  positionTitle?: string
  organizationName?: string
  reference?: string
  receivedAt?: string
  reviewUrl?: string
}

const NewApplicationAlert = ({
  candidateName,
  positionTitle,
  organizationName,
  reference,
  receivedAt,
  reviewUrl,
}: NewApplicationAlertProps) => (
  <Shell preview={`New application — ${positionTitle ?? 'open role'}`} heading="New application received">
    <Text style={text}>
      <strong>{candidateName ?? 'A candidate'}</strong> applied for{' '}
      <strong>{positionTitle ?? 'an open role'}</strong>
      {organizationName ? ` at ${organizationName}` : ''}.
    </Text>
    <Text style={text}>
      Reference: <strong>{reference ?? '—'}</strong>
      <br />
      Received: {receivedAt ?? new Date().toISOString()}
    </Text>
    {reviewUrl && (
      <Button style={button} href={reviewUrl}>
        Review in TaaSFlow
      </Button>
    )}
    <Text style={footer}>
      Internal notification. Candidate contact details stay in the workspace.
    </Text>
  </Shell>
)

export const template = {
  component: NewApplicationAlert,
  subject: (data: Record<string, any>) =>
    `New application — ${data.positionTitle ?? 'open role'}`,
  displayName: 'New application alert (internal)',
  to: 'john.kasprzak@taasflow.com',
  previewData: {
    candidateName: 'Ana Souza',
    positionTitle: 'Social Media & Design Specialist',
    organizationName: 'Example Client Co (preview)',
    reference: 'A1B2C3',
    receivedAt: new Date().toISOString(),
    reviewUrl: 'https://taasflow.com/admin/candidates',
  },
} satisfies TemplateEntry

export default NewApplicationAlert
