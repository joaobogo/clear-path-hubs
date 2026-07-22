# Runbook 11 — Email Failure

**Symptoms**
- Users report missing email (invite, notification digest, password recovery).
- `notification_deliveries.status='failed'` with `channel='email'`.

**Diagnosis**
1. `SELECT status, last_error, attempts FROM notification_deliveries WHERE recipient_user_id=$1 ORDER BY created_at DESC LIMIT 20;`
2. Check bounces on provider dashboard (Resend logs via connector).
3. Verify recipient not in suppression list.

**Safe action**
- Suppression → `resendNotification(deliveryId)` after user removed from suppression.
- Auth email (invite/recovery) → `resendInvitation` or `sendRecoveryLink(userId)` (canonical; delivers via Auth Admin `generateLink`).
- Provider outage → runbook 10.

**Expected result**
- Delivery `status='sent'`; user confirms receipt.

**Escalation**
- Sender domain reputation issue → engineering.

**Rollback**
- N/A — resends are additive.

**Audit**
- Every resend logs `support_actions('other')` with recipient + delivery id.
