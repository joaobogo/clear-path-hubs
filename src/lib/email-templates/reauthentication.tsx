import * as React from 'react'

import { Text } from '@react-email/components'
import { Shell, codeStyle, footer, text } from './brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({
  token,
}: ReauthenticationEmailProps) => (
  <Shell
    preview="Your TaaSFlow verification code"
    heading="Confirm it's you"
  >
    <Text style={text}>Enter this code to confirm your identity:</Text>
    <Text style={codeStyle}>{token}</Text>
    <Text style={footer}>
      This code expires shortly. If you didn't request it, you can safely ignore
      this email.
    </Text>
  </Shell>
)

export default ReauthenticationEmail
