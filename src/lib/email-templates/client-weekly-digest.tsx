import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, palette, text } from './brand'
import type { TemplateEntry } from './registry'

/** Mirrors the "This week" card: same counts, same wording, same source object. */
export interface DigestSummary {
  windowLabel: string
  metrics: Array<{ label: string; count: number }>
  awaiting: Array<{ title: string; reason: string; waitingSince: string | null }>
  nextWeek: string[]
  noMovement: boolean
  noMovementReason: string | null
}

export interface DigestRoleLine {
  title: string
  stage: string
  newCandidates: number
  awaitingDecision: number
  interviews: number
  nextStep: string
}

interface Props {
  summary?: DigestSummary
  contactName?: string
  companyName?: string
  weekEnding?: string
  roles?: DigestRoleLine[]
  dashboardUrl?: string
}

const cell: React.CSSProperties = {
  fontSize: '14px',
  color: palette.body,
  padding: '10px 0',
  borderTop: `1px solid ${palette.border}`,
}

const ClientWeeklyDigest = ({
  summary,
  contactName,
  companyName,
  weekEnding,
  roles = [],
  dashboardUrl,
}: Props) => (
  <Shell
    preview={`Your week in hiring${companyName ? ` at ${companyName}` : ''}`}
    heading="Your week in hiring"
  >
    <Text style={text}>{contactName ? `Hi ${contactName},` : 'Hi,'}</Text>
    <Text style={text}>
      Here is where every live role stands{weekEnding ? ` as of ${weekEnding}` : ''}. Only facts
      from your workspace — nothing estimated.
    </Text>

    {summary && (
      <div style={{ ...cell, borderTop: 'none' }}>
        <Text style={{ ...text, margin: 0, color: palette.ink, fontWeight: 600 }}>
          This week{summary.windowLabel ? ` · ${summary.windowLabel}` : ''}
        </Text>
        {summary.noMovement ? (
          <Text style={{ ...text, margin: '4px 0 0', fontSize: '13px' }}>
            No movement this week
            {summary.noMovementReason ? ` — ${summary.noMovementReason}.` : '.'}
          </Text>
        ) : (
          summary.metrics
            .filter((m) => m.count > 0)
            .map((m) => (
              <Text key={m.label} style={{ ...text, margin: '4px 0 0', fontSize: '13px' }}>
                {m.count} {m.label.toLowerCase()}
              </Text>
            ))
        )}

        {summary.awaiting.length > 0 && (
          <>
            <Text
              style={{ ...text, margin: '12px 0 0', fontSize: '13px', color: palette.ink, fontWeight: 600 }}
            >
              Waiting on you
            </Text>
            {summary.awaiting.map((a) => (
              <Text key={a.title} style={{ ...text, margin: '2px 0 0', fontSize: '13px' }}>
                {a.title} — {a.reason}
                {a.waitingSince ? ` (since ${a.waitingSince})` : ''}
              </Text>
            ))}
          </>
        )}

        {summary.nextWeek.length > 0 && (
          <>
            <Text
              style={{ ...text, margin: '12px 0 0', fontSize: '13px', color: palette.ink, fontWeight: 600 }}
            >
              What we do next week
            </Text>
            {summary.nextWeek.map((n) => (
              <Text key={n} style={{ ...text, margin: '2px 0 0', fontSize: '13px', color: palette.muted }}>
                {n}
              </Text>
            ))}
          </>
        )}
      </div>
    )}

    {roles.length === 0 ? (
      <Text style={text}>
        Nothing moved this week. If that is not what you expected, reply to this email and we will
        look into it.
      </Text>
    ) : (
      roles.map((r) => (
        <div key={r.title} style={cell}>
          <Text style={{ ...text, margin: 0, color: palette.ink, fontWeight: 600 }}>{r.title}</Text>
          <Text style={{ ...text, margin: '2px 0 0', fontSize: '13px' }}>
            {r.stage} · {r.newCandidates} new candidate{r.newCandidates === 1 ? '' : 's'} ·{' '}
            {r.awaitingDecision} awaiting your decision · {r.interviews} interview
            {r.interviews === 1 ? '' : 's'} booked
          </Text>
          <Text style={{ ...text, margin: '2px 0 0', fontSize: '13px', color: palette.muted }}>
            Next: {r.nextStep}
          </Text>
        </div>
      ))
    )}

    {dashboardUrl && (
      <Button style={button} href={dashboardUrl}>
        Open your dashboard
      </Button>
    )}

    <Text style={footer}>
      You receive this because weekly digests are on for your account. Change it in your workspace
      notification settings.
    </Text>
  </Shell>
)

export const template = {
  component: ClientWeeklyDigest,
  subject: (data: Record<string, any>) =>
    `Your week in hiring${data?.companyName ? ` — ${data.companyName}` : ''}`,
  displayName: 'Client weekly digest',
  previewData: {
    summary: {
      windowLabel: '7 Mar – 14 Mar',
      metrics: [
        { label: 'Candidates delivered', count: 3 },
        { label: 'Interviews held', count: 1 },
        { label: 'Decision made', count: 1 },
      ],
      awaiting: [
        {
          title: 'Head of Revenue Operations',
          reason: '2 candidates awaiting your decision',
          waitingSince: '11 Mar',
        },
      ],
      nextWeek: ['1 booked interview to run and write up'],
      noMovement: false,
      noMovementReason: null,
    },
    contactName: 'Alex',
    companyName: 'Northwind Group',
    weekEnding: '14 March 2026',
    roles: [
      {
        title: 'Head of Revenue Operations',
        stage: 'Shortlist under review',
        newCandidates: 3,
        awaitingDecision: 2,
        interviews: 1,
        nextStep: 'Review 2 shortlisted candidates',
      },
    ],
    dashboardUrl: 'https://taasflow.com/client',
  },
} satisfies TemplateEntry

export default ClientWeeklyDigest
