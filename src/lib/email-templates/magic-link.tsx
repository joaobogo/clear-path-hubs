import * as React from 'react'

import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Shell preview="Your TaaSFlow login link" heading="Your login link">
    <Text style={text}>
      Use the button below to sign in to your TaaSFlow dashboard. The link
      expires shortly for your security.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Log in to TaaSFlow
    </Button>
    <Text style={footer}>
      If you didn't request this link, you can safely ignore this email.
    </Text>
  </Shell>
)

export default MagicLinkEmail
