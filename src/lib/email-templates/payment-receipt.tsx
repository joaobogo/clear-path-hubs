import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  contactName?: string
  roleTitle?: string
  amount?: string
  paidOn?: string
  reference?: string
  nextStep?: string
  dueDate?: string
  workspaceUrl?: string
}

const PaymentReceipt = ({
  contactName,
  roleTitle,
  amount,
  paidOn,
  reference,
  nextStep,
  dueDate,
  workspaceUrl,
}: Props) => (
  <Shell preview="Your TaaSFlow receipt" heading="Payment received">
    <Text style={text}>{contactName ? `Hi ${contactName},` : 'Hi,'}</Text>
    <Text style={text}>
      We've received your payment for <strong>{roleTitle ?? 'your role'}</strong>. The role is now
      published and the search is being set up.
    </Text>
    <Text style={text}>
      <strong>Amount:</strong> {amount ?? '—'}
      <br />
      <strong>Paid on:</strong> {paidOn ?? '—'}
      <br />
      <strong>Reference:</strong> {reference ?? '—'}
    </Text>
    <Text style={text}>
      <strong>Next step:</strong>{' '}
      {nextStep ?? 'We confirm the search plan and start sourcing candidates.'}
      <br />
      <strong>Due by:</strong> {dueDate ?? 'within 3 working days'}
    </Text>
    {workspaceUrl && (
      <Button style={button} href={workspaceUrl}>
        View the role
      </Button>
    )}
    <Text style={footer}>
      You're receiving this because you paid for a role on TaaSFlow. Keep this email as your
      receipt.
    </Text>
  </Shell>
)

export const template = {
  component: PaymentReceipt,
  subject: 'Your TaaSFlow receipt',
  displayName: 'Payment receipt',
  previewData: {
    contactName: 'Jane',
    roleTitle: 'Clinical Operations Manager',
    amount: 'USD 1,200.00',
    paidOn: '5 August 2026',
    reference: 'cs_test_123456',
    nextStep: 'We confirm the search plan and start sourcing candidates.',
    dueDate: '8 August 2026',
    workspaceUrl: 'https://taasflow.com/client',
  },
} satisfies TemplateEntry
