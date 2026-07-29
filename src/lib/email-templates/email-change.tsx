import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'
import { Shell, button, footer, link, text } from './brand'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Shell
    preview="Confirm your email change for TaaSFlow"
    heading="Confirm your email change"
  >
    <Text style={text}>
      You asked to change the email on your TaaSFlow account from{' '}
      <Link href={`mailto:${oldEmail}`} style={link}>
        {oldEmail}
      </Link>{' '}
      to{' '}
      <Link href={`mailto:${newEmail}`} style={link}>
        {newEmail}
      </Link>
      .
    </Text>
    <Button style={button} href={confirmationUrl}>
      Confirm email change
    </Button>
    <Text style={footer}>
      If you didn't request this change, secure your account immediately.
    </Text>
  </Shell>
)

export default EmailChangeEmail
