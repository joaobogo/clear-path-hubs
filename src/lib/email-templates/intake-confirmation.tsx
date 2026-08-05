import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  contactName?: string
  companyName?: string
  roleTitle?: string
  nextStep?: string
  dueDate?: string
  workspaceUrl?: string
}

const IntakeConfirmation = ({
  contactName,
  companyName,
  roleTitle,
  nextStep,
  dueDate,
  workspaceUrl,
}: Props) => (
  <Shell
    preview={`We have your brief for ${roleTitle ?? 'your role'}`}
    heading={`We have your brief for ${roleTitle ?? 'your role'}`}
  >
    <Text style={text}>{contactName ? `Hi ${contactName},` : 'Hi,'}</Text>
    <Text style={text}>
      Your TaaSFlow workspace for <strong>{companyName ?? 'your company'}</strong> is live and{' '}
      <strong>{roleTitle ?? 'your role'}</strong> has been saved as a draft. Nothing has been
      charged.
    </Text>
    <Text style={text}>
      <strong>Next step:</strong> {nextStep ?? 'Complete payment to publish the role.'}
      <br />
      <strong>Due by:</strong> {dueDate ?? 'within 7 days'}
    </Text>
    <Text style={text}>
      Until that step is done the role stays private, so no candidates see it and no search
      begins.
    </Text>
    {workspaceUrl && (
      <Button style={button} href={workspaceUrl}>
        Open my workspace
      </Button>
    )}
    <Text style={footer}>
      You're receiving this because you submitted a role brief to TaaSFlow.
    </Text>
  </Shell>
)

export const template = {
  component: IntakeConfirmation,
  subject: (data: Record<string, any>) =>
    `We have your brief for ${data?.roleTitle ?? 'your role'}`,
  displayName: 'Intake confirmation',
  previewData: {
    contactName: 'Jane',
    companyName: 'Northwind Health',
    roleTitle: 'Clinical Operations Manager',
    nextStep: 'Complete payment to publish the role and start the pilot.',
    dueDate: '12 August 2026',
    workspaceUrl: 'https://taasflow.com/client',
  },
} satisfies TemplateEntry
