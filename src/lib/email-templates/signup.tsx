import * as React from 'react'

import { Button, Link, Text } from '@react-email/components'
import { Shell, button, footer, link, text } from './brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Shell preview="Confirm your email for TaaSFlow" heading="Confirm your email">
    <Text style={text}>
      Thanks for signing up for{' '}
      <Link href={siteUrl} style={link}>
        <strong>TaaSFlow</strong>
      </Link>
      . Confirm{' '}
      <Link href={`mailto:${recipient}`} style={link}>
        {recipient}
      </Link>{' '}
      to activate your workspace.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Verify email
    </Button>
    <Text style={footer}>
      If you didn't create an account, you can safely ignore this email.
    </Text>
  </Shell>
)

export default SignupEmail
