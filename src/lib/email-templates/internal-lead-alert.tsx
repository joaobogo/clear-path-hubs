import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Fact {
  label: string
  value: string
}

interface Props {
  leadTypeLabel?: string
  priority?: 'urgent' | 'high' | 'standard'
  fullName?: string | null
  email?: string | null
  company?: string | null
  phone?: string | null
  message?: string | null
  facts?: Fact[]
  source?: string | null
  sourcePage?: string | null
  ownerEmail?: string | null
  reference?: string | null
  receivedAt?: string
  actionUrl?: string
}

const PRIORITY_LABEL = {
  urgent: 'Respond today',
  high: 'Respond within 24 hours',
  standard: 'Standard follow-up',
} as const

const InternalLeadAlert = ({
  leadTypeLabel = 'New lead',
  priority = 'standard',
  fullName,
  email,
  company,
  phone,
  message,
  facts = [],
  source,
  sourcePage,
  ownerEmail,
  reference,
  receivedAt,
  actionUrl,
}: Props) => {
  const rows: Fact[] = [
    ...(fullName ? [{ label: 'Name', value: fullName }] : []),
    ...(email ? [{ label: 'Email', value: email }] : []),
    ...(phone ? [{ label: 'Phone', value: phone }] : []),
    ...(company ? [{ label: 'Company', value: company }] : []),
    ...facts,
    ...(source ? [{ label: 'Source', value: source }] : []),
    ...(sourcePage ? [{ label: 'Page', value: sourcePage }] : []),
    ...(ownerEmail ? [{ label: 'Owner', value: ownerEmail }] : []),
    ...(reference ? [{ label: 'Reference', value: reference }] : []),
    ...(receivedAt ? [{ label: 'Received', value: receivedAt }] : []),
  ]

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${leadTypeLabel}: ${fullName ?? email ?? 'new enquiry'}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={kicker}>{PRIORITY_LABEL[priority]}</Text>
          <Heading style={heading}>{leadTypeLabel}</Heading>
          <Text style={lede}>
            {[fullName, company].filter(Boolean).join(' · ') || 'New enquiry received'}
          </Text>

          <Section style={card}>
            {rows.map((row) => (
              <Text key={`${row.label}-${row.value}`} style={rowStyle}>
                <span style={label}>{row.label}</span>
                <span style={value}>{row.value}</span>
              </Text>
            ))}
          </Section>

          {message ? (
            <Section style={quote}>
              <Text style={quoteText}>{message}</Text>
            </Section>
          ) : null}

          {actionUrl ? (
            <Text style={{ margin: '24px 0 0' }}>
              <Link href={actionUrl} style={button}>
                Open in TaaSFlow
              </Link>
            </Text>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>
            Internal lead alert. Reply directly to reach the sender.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InternalLeadAlert,
  subject: (data: Record<string, any>) => {
    const who = data.fullName || data.company || data.email || 'New enquiry'
    const flag = data.priority === 'urgent' ? '[Urgent] ' : ''
    return `${flag}${data.leadTypeLabel ?? 'New lead'} — ${who}`
  },
  displayName: 'Internal lead alert',
  previewData: {
    leadTypeLabel: 'Employer intake',
    priority: 'urgent',
    fullName: 'Alex Moreau',
    email: 'alex@northwind.example',
    company: 'Northwind Logistics',
    phone: '+44 20 7946 0000',
    message: 'We need three warehouse supervisors in Rotterdam before the end of next month.',
    facts: [{ label: 'Role', value: 'Warehouse Supervisor' }, { label: 'Volume', value: '3 hires' }],
    source: 'employer_intake',
    sourcePage: '/intake',
    ownerEmail: 'john.kasprzak@taasflow.com',
    reference: 'INT-4821',
    receivedAt: new Date().toISOString(),
    actionUrl: 'https://taasflow.com/admin/intake',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '28px 26px', maxWidth: '600px' }
const kicker = {
  margin: '0 0 6px',
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#b4531a',
  fontWeight: 700,
}
const heading = { margin: '0 0 4px', fontSize: '22px', color: '#111827' }
const lede = { margin: '0 0 20px', fontSize: '15px', color: '#4b5563' }
const card = {
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  padding: '8px 16px',
  backgroundColor: '#f9fafb',
}
const rowStyle = { margin: '10px 0', fontSize: '14px', lineHeight: '20px' }
const label = { display: 'block', color: '#6b7280', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
const value = { display: 'block', color: '#111827', fontWeight: 600 }
const quote = { margin: '18px 0 0', borderLeft: '3px solid #d1d5db', padding: '4px 0 4px 14px' }
const quoteText = { margin: 0, fontSize: '14px', color: '#374151', lineHeight: '22px' }
const button = {
  backgroundColor: '#111827',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
}
const hr = { borderColor: '#e5e7eb', margin: '28px 0 12px' }
const footer = { margin: 0, fontSize: '12px', color: '#6b7280' }

export default InternalLeadAlert
