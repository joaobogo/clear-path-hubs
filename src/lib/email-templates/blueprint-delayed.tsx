import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  contactName?: string
  roleTitle?: string
  workspaceUrl?: string
}

const BlueprintDelayed = ({ contactName, roleTitle, workspaceUrl }: Props) => (
  <Shell
    preview={`We're finishing your brief for ${roleTitle ?? 'your role'}`}
    heading="A TaaSFlow specialist is finishing your brief"
  >
    <Text style={text}>{contactName ? `Hi ${contactName},` : 'Hi,'}</Text>
    <Text style={text}>
      Your role <strong>{roleTitle ?? ''}</strong> is created and safe in your workspace.
      We couldn't finish the automated brief from the job description you provided, so a
      TaaSFlow specialist is picking it up directly. You don't need to do anything.
    </Text>
    <Text style={text}>
      If you'd like to speed it up, you can open the role and fill in the brief yourself —
      every field is editable.
    </Text>
    {workspaceUrl && (
      <Button style={button} href={workspaceUrl}>
        Open the role
      </Button>
    )}
    <Text style={footer}>We'll email you as soon as the brief is ready to review.</Text>
  </Shell>
)

export const template = {
  component: BlueprintDelayed,
  subject: (data: Record<string, any>) =>
    `We're finishing your brief — ${data.roleTitle ?? 'your role'}`,
  displayName: 'Blueprint needs a specialist',
  previewData: {
    contactName: 'Marina',
    roleTitle: 'Clinical Operations Manager',
    workspaceUrl: 'https://www.taasflow.com/client/positions',
  },
} satisfies TemplateEntry

export default BlueprintDelayed
