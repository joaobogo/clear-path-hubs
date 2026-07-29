import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'
import { Shell, button, footer, link, text } from './brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Shell
    preview="You've been invited to TaaSFlow"
    heading="You've been invited"
  >
    <Text style={text}>
      You've been invited to join{' '}
      <Link href={siteUrl} style={link}>
        <strong>TaaSFlow</strong>
      </Link>
      . Accept the invitation to set up your account and access your hiring
      workspace.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Accept invitation
    </Button>
    <Text style={footer}>
      If you weren't expecting this invitation, you can safely ignore this
      email.
    </Text>
  </Shell>
)

export default InviteEmail
