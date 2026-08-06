import type { ComponentType } from 'react'
import { template as newApplicationAlertTemplate } from './new-application-alert'
import { template as expressWelcomeTemplate } from './express-welcome'
import { template as roleBlueprintReadyTemplate } from './role-blueprint-ready'
import { template as blueprintDelayedTemplate } from './blueprint-delayed'
import { template as searchLiveTemplate } from './search-live'
import { template as intakeConfirmationTemplate } from './intake-confirmation'
import { template as paymentReceiptTemplate } from './payment-receipt'
import { template as clientWeeklyDigestTemplate } from './client-weekly-digest'
import { template as applicationReceivedTemplate } from './application-received'
import { template as applicationClosedTemplate } from './application-closed'
import { template as internalLeadAlertTemplate } from './internal-lead-alert'
import { template as intakeResumeTemplate } from './intake-resume'
import { template as interviewReminderTemplate } from './interview-reminder'
import { template as profileIncompleteTemplate } from './profile-incomplete'



export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-application-alert': newApplicationAlertTemplate,
  'express-welcome': expressWelcomeTemplate,
  'role-blueprint-ready': roleBlueprintReadyTemplate,
  'blueprint-delayed': blueprintDelayedTemplate,
  'search-live': searchLiveTemplate,
  'intake-confirmation': intakeConfirmationTemplate,
  'intake-resume': intakeResumeTemplate,
  'payment-receipt': paymentReceiptTemplate,
  'client-weekly-digest': clientWeeklyDigestTemplate,
  'application-received': applicationReceivedTemplate,
  'application-closed': applicationClosedTemplate,
  'internal-lead-alert': internalLeadAlertTemplate,
  'interview-reminder': interviewReminderTemplate,
  'profile-incomplete': profileIncompleteTemplate,
}


