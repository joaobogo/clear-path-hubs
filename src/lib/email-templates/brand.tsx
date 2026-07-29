import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

/** TaaSFlow email brand palette (hex mirrors of brand-tokens.css — email clients
 *  cannot resolve CSS variables or oklch()). */
export const palette = {
  navy: '#1e2a4a',
  navyDark: '#16203a',
  ocean: '#2563eb',
  ink: '#141a28',
  body: '#55606f',
  muted: '#8a93a3',
  border: '#e3e8ef',
  paper: '#f7f9fc',
  white: '#ffffff',
}

const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export const main = { backgroundColor: '#ffffff', fontFamily: font, margin: 0 }
export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '0 0 32px',
}
export const header = {
  backgroundColor: palette.navy,
  padding: '22px 28px',
  borderRadius: '12px 12px 0 0',
}
export const wordmark = {
  color: '#ffffff',
  fontSize: '17px',
  fontWeight: 700 as const,
  letterSpacing: '-0.01em',
  margin: 0,
}
export const tagline = {
  color: '#b9c6e0',
  fontSize: '12px',
  margin: '4px 0 0',
}
export const card = {
  border: `1px solid ${palette.border}`,
  borderTop: 'none',
  borderRadius: '0 0 12px 12px',
  padding: '28px',
}
export const h1 = {
  fontSize: '21px',
  fontWeight: 700 as const,
  color: palette.ink,
  margin: '0 0 14px',
  lineHeight: '1.3',
}
export const text = {
  fontSize: '15px',
  color: palette.body,
  lineHeight: '1.6',
  margin: '0 0 20px',
}
export const link = { color: palette.ocean, textDecoration: 'underline' }
export const button = {
  backgroundColor: palette.ocean,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '8px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
export const codeStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Courier, monospace',
  fontSize: '26px',
  letterSpacing: '0.18em',
  fontWeight: 700 as const,
  color: palette.ink,
  backgroundColor: palette.paper,
  border: `1px solid ${palette.border}`,
  borderRadius: '8px',
  padding: '14px 18px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}
export const footer = {
  fontSize: '12px',
  color: palette.muted,
  lineHeight: '1.6',
  margin: '26px 0 0',
}

export const Shell = ({
  preview,
  heading,
  children,
}: {
  preview: string
  heading: string
  children: React.ReactNode
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={wordmark}>TaaSFlow</Text>
          <Text style={tagline}>ATS + recruiting + outreach, all in one</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>{heading}</Heading>
          {children}
        </Section>
      </Container>
    </Body>
  </Html>
)
