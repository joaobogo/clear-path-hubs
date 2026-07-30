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
  <Shell preview="Your TaaSFlow workspace is ready" heading="Your workspace is ready">
    <Text style={text}>
      {contactName ? `Hi ${contactName},` : 'Hi,'}
    </Text>
    <Text style={text}>
      Your TaaSFlow account for <strong>{companyName ?? 'your company'}</strong> is live, and{' '}
      <strong>{roleTitle ?? 'your role'}</strong> has been created in your workspace.
    </Text>
    <Text style={text}>
      We're now reading your job description and building the role blueprint — the brief,
      scoring rubric, screening questions and sourcing plan. You'll get a second email the
      moment it's ready to review. Nothing is needed from you in the meantime.
    </Text>
    {workspaceUrl && (
      <Button style={button} href={workspaceUrl}>
        Open your workspace
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
    `Your TaaSFlow workspace is ready — ${data.roleTitle ?? 'your first role'}`,
  displayName: 'Express onboarding welcome',
  previewData: {
    contactName: 'Marina',
    companyName: 'Northwind Health',
    roleTitle: 'Clinical Operations Manager',
    workspaceUrl: 'https://www.taasflow.com/client',
  },
} satisfies TemplateEntry

export default ExpressWelcome
