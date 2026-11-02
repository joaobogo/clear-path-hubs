import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface ScreeningQuestionsProps {
  candidateFirstName?: string
  positionTitle?: string
  organizationName?: string
  reference?: string
  /** How many of the role's questions are waiting. */
  questionCount?: number
  statusUrl?: string
}

const ScreeningQuestions = ({
  candidateFirstName,
  positionTitle,
  organizationName,
  reference,
  questionCount,
  statusUrl,
}: ScreeningQuestionsProps) => {
  const n = Number(questionCount ?? 0)
  const few = n === 1 ? 'one short question' : n > 1 ? `${n} short questions` : 'a few short questions'
  return (
    <Shell
      preview={`A few questions about your application${positionTitle ? ` — ${positionTitle}` : ''}`}
      heading="A few questions about your application"
    >
      <Text style={text}>{candidateFirstName ? `Hi ${candidateFirstName},` : 'Hi,'}</Text>
      <Text style={text}>
        Thank you for sending us your CV for <strong>{positionTitle ?? 'the role'}</strong>
        {organizationName ? ` at ${organizationName}` : ''}. People who apply through our job page
        answer {few} about the role. Your application reached us without them, so we are asking
        now.
      </Text>
      <Text style={text}>
        Answering takes a couple of minutes and helps the review team read your application fairly.
        Your CV is already with us, so there is nothing to send again.
      </Text>
      <Text style={text}>
        Your reference is <strong>{reference ?? '—'}</strong>. Open the link below, enter it with
        this email address, and the questions are on that page.
      </Text>
      {statusUrl && (
        <Button style={button} href={statusUrl}>
          Answer the questions
        </Button>
      )}
      <Text style={footer}>
        Your application stays with the review team either way. We hold your CV and contact details
        to review this application; you can ask us to correct or delete them at any time from the
        same page, or by replying to this email.
      </Text>
    </Shell>
  )
}

export const template = {
  component: ScreeningQuestions,
  subject: (d: Record<string, unknown>) =>
    `A few questions about your application${d?.positionTitle ? ` — ${d.positionTitle}` : ''}`,
  displayName: 'Candidate — screening questions for an emailed CV',
  previewData: {
    candidateFirstName: 'Ana',
    positionTitle: 'Social Media & Design Specialist',
    organizationName: 'Example Client Co (preview)',
    reference: 'A1B2C3',
    questionCount: 3,
    statusUrl: 'https://taasflow.com/apply/status?ref=A1B2C3',
  },
} satisfies TemplateEntry
