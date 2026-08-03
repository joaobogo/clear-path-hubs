import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  contactName?: string
  companyName?: string
  roleTitle?: string
  workspaceUrl?: string
}

const ExpressWelcome = ({ contactName, companyName, roleTitle, workspaceUrl }: Props) => (
  <Shell
    preview={`Your ${roleTitle ?? 'new'} role is being built`}
    heading={`Your ${roleTitle ?? 'new'} role is being built`}
  >
    <Text style={text}>
      {contactName ? `Hi ${contactName},` : 'Hi,'}
    </Text>
    <Text style={text}>
      Your TaaSFlow account for <strong>{companyName ?? 'your company'}</strong> is live, and{' '}
      <strong>{roleTitle ?? 'your role'}</strong> has been created in your workspace.
    </Text>
    <Text style={text}>
      TaaSFlow is currently completing the role blueprint, calibrating the screening criteria,
      building the sourcing and outreach plan, and preparing the search channels. You'll be able
      to review or edit every detail inside your workspace.
    </Text>
    <Text style={text}>
      First candidate activity usually begins within 3–5 days after the search goes live. Your
      one-time pilot runs for 14 days and covers one role.
    </Text>
    {workspaceUrl && (
      <Button style={button} href={workspaceUrl}>
        Open my workspace
      </Button>
    )}
    <Text style={footer}>
      You're receiving this because you created a TaaSFlow account.
    </Text>
  </Shell>
)

export const template = {
  component: ExpressWelcome,
  subject: (data: Record<string, any>) =>
    `Your ${data.roleTitle ?? 'new'} role is being built`,
  displayName: 'Express onboarding welcome',
  previewData: {
    contactName: 'Marina',
    companyName: 'Northwind Health',
    roleTitle: 'Clinical Operations Manager',
    workspaceUrl: 'https://taasflow.com/client',
  },
} satisfies TemplateEntry

export default ExpressWelcome
