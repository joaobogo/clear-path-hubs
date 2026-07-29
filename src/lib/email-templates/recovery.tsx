import * as React from 'react'

import { Button, Text } from '@react-email/components'
import { Shell, button, footer, text } from './brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Shell preview="Reset your TaaSFlow password" heading="Reset your password">
    <Text style={text}>
      We received a request to reset the password for your TaaSFlow account.
      Choose a new one using the button below.
    </Text>
    <Button style={button} href={confirmationUrl}>
      Reset password
    </Button>
    <Text style={footer}>
      If you didn't request a password reset, you can safely ignore this email —
      your password will not change.
    </Text>
  </Shell>
)

export default RecoveryEmail
