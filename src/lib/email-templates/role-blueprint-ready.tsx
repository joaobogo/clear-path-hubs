import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  contactName?: string
  companyName?: string
  roleTitle?: string
  mustHaves?: string[]
  openQuestions?: string[]
  reviewUrl?: string
}

const RoleBlueprintReady = ({
  contactName,
  companyName,
  roleTitle,
  mustHaves = [],
  openQuestions = [],
  reviewUrl,
}: Props) => (
  <Shell
    preview={`Role blueprint ready — ${roleTitle ?? 'your role'}`}
    heading="Your role blueprint is ready"
  >
    <Text style={text}>{contactName ? `Hi ${contactName},` : 'Hi,'}</Text>
    <Text style={text}>
      We've turned your job description for <strong>{roleTitle ?? 'your role'}</strong>
      {companyName ? ` at ${companyName}` : ''} into a full hiring brief: requirements,
      scoring rubric, screening questions and a sourcing plan. Every answer is editable.
    </Text>
    {mustHaves.length > 0 && (
      <Text style={text}>
        <strong>Must-haves we captured</strong>
        <br />
        {mustHaves.join(' · ')}
      </Text>
    )}
    {openQuestions.length > 0 && (
      <Text style={text}>
        <strong>Worth confirming before we start sourcing</strong>
        <br />
        {openQuestions.map((q, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {`• ${q}`}
          </React.Fragment>
        ))}
      </Text>
    )}
    {reviewUrl && (
      <Button style={button} href={reviewUrl}>
        Review the blueprint
      </Button>
    )}
    <Text style={footer}>
      Approving the blueprint tells our team the role is ready to source.
    </Text>
  </Shell>
)

export const template = {
  component: RoleBlueprintReady,
  subject: (data: Record<string, any>) =>
    `Role blueprint ready — ${data.roleTitle ?? 'your role'}`,
  displayName: 'Role blueprint ready',
  previewData: {
    contactName: 'Marina',
    companyName: 'Northwind Health',
    roleTitle: 'Clinical Operations Manager',
    mustHaves: ['Clinical ops leadership', 'Joint Commission readiness', 'Epic'],
    openQuestions: ['Confirm the salary band', 'Confirm the interview panel'],
    reviewUrl: 'https://www.taasflow.com/client/positions',
  },
} satisfies TemplateEntry

export default RoleBlueprintReady
