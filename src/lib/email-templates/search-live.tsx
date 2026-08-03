import * as React from 'react'
import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'
import type { TemplateEntry } from './registry'

interface Props {
  contactName?: string
  companyName?: string
  roleTitle?: string
  channels?: string[]
  roleUrl?: string
}

const SearchLive = ({ contactName, companyName, roleTitle, channels = [], roleUrl }: Props) => (
  <Shell
    preview={`Your search is live — ${roleTitle ?? 'your role'}`}
    heading="Your search is live"
  >
    <Text style={text}>{contactName ? `Hi ${contactName},` : 'Hi,'}</Text>
    <Text style={text}>
      Sourcing has started for <strong>{roleTitle ?? 'your role'}</strong>
      {companyName ? ` at ${companyName}` : ''}. Candidates are screened against the blueprint
      you approved, and only the ones worth your time reach your shortlist.
    </Text>
    {channels.length > 0 && (
      <Text style={text}>
        <strong>Where we're searching</strong>
        <br />
        {channels.join(' · ')}
      </Text>
    )}
    {roleUrl && (
      <Button style={button} href={roleUrl}>
        Follow the search
      </Button>
    )}
    <Text style={footer}>
      You'll get a note the moment your first shortlisted candidate is ready.
    </Text>
  </Shell>
)

export const template = {
  component: SearchLive,
  subject: (data: Record<string, any>) => `Your search is live — ${data.roleTitle ?? 'your role'}`,
  displayName: 'Search live',
  previewData: {
    contactName: 'Marina',
    companyName: 'Northwind Health',
    roleTitle: 'Clinical Operations Manager',
    channels: ['Direct outreach', 'TaaSFlow talent network', 'Job board syndication'],
    roleUrl: 'https://taasflow.com/client/positions',
  },
} satisfies TemplateEntry

export default SearchLive
