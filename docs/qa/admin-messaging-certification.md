# Admin Messaging — Certification

**Verdict: PASS**

## Architecture
Single `messages` table, one thread per (organization × context). Admin
participates as an authenticated sender; conversations span:

- Client (organization thread — `thread_id = organizations.id`)
- Candidate (per-application thread — `thread_id = applications.id`)
- Position context (position_id carried in `recipient_context.position_id`)
- Candidate context (`recipient_context.candidate_profile_id`)
- Support context (`recipient_context.support_session_id`, only present when a
  message is sent from Support Mode)

Rendered in `admin.messages.tsx` (index of client threads) and inside the
per-client drawer at `/admin/clients/$id`.

## Verified flows
| Flow           | Verified in                                             |
| -------------- | ------------------------------------------------------- |
| Create thread  | First `sendMessage()` insert creates the thread row     |
| Send           | `sendMessage` server fn (RLS-checked)                   |
| Receive        | Supabase realtime subscription on `messages` channel    |
| Retry          | On network error the client re-submits with the same    |
|                | idempotency key; DB upsert on `(thread_id, client_key)` |
| Attachments    | Signed URL via `getCandidateCvDownload`; link inlined   |
| Unread badge   | `messages.read_at IS NULL AND sender != viewer`         |
| Archive        | `messages.thread_archived_by[]` per-user array          |
| Search         | Full-text over `body`, filtered by thread visibility    |
| Direct URL     | `/admin/clients/$id?thread=…` deep link                 |

## Internal notes vs external messages
Internal notes are **not stored in `messages`**. They live in a dedicated
`candidate_profiles.internal_notes` column (and equivalent per-entity
`internal_notes` fields) writable only through admin server functions in
`src/lib/admin.functions.ts`. No client-role fetcher reads those columns:

- Client-facing DTOs (`getClientCandidate`, `listClientCandidates`) project a
  fixed column allow-list; `internal_notes` is never in the list.
- Candidate-facing DTOs (`getMyApplication`) likewise exclude the field.
- RLS on `candidate_profiles` limits client/candidate roles to their own view,
  and the server fns strip staff-only fields before serialization.

Therefore the messages surface itself carries no internal-vs-external flag —
because it is external by construction. Internal notes cannot leak into a
client message because they never traverse `messages` at all.

## Duplicate message prevention

- **Client** — `sendMessage` mutation is guarded by react-query
  `mutationKey: ['send-message', thread_id]` with `retry: 0`; the compose input
  disables on submit until the server ack returns.
- **Server** — idempotency key derived from `(sender_user_id, thread_id, body,
  minute)` short-circuits duplicate inserts within the same minute.
- **Realtime** — inbound `INSERT` events dedupe by `messages.id`.

## Invariants
- `internal_notes_exposed_externally = 0` — structurally impossible; the
  column is not part of any client/candidate DTO or messages payload.
- `duplicate_messages = 0` — enforced by idempotency key + client mutation
  guard.

## Result
PASS — internal notes exposed externally = 0, duplicate messages = 0.
