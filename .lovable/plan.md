# Plan: Application Submission Hardening (P-042, P-043, P-044, P-050)

Hardening the application submission flow to ensure reliability, visibility into failures, and a better experience for applicants with unreadable CVs or duplicate attempts.

## User Review Required

> [!IMPORTANT]
> - Duplicate detection now rejects submissions with the same email+role after 5 minutes (double-click protection returns the existing reference instead).
> - Applicants with unreadable PDFs (scanned images) will be told immediately after submission that manual review is required.

## Proposed Changes

### Application Submission & State Machine
- **Submission Hardening**: Integrated `logApplicationIncident` to capture trace IDs and metadata for any failure during the application process.
- **Duplicate Detection**:
    - Returns existing application reference if submitted < 5 minutes ago (double-click/refresh).
    - Rejects with a clear "Already Applied" message if submitted > 5 minutes ago.
- **Incident Logging**: Staff now see a detailed incident report for any application that fails mid-creation (e.g., CV stored but record failed).

### CV Processing & Unreadable Files
- **Immediate Detection**: Validates the PDF text layer during submission.
- **Actionable Feedback**: Applicants are told honestly if their PDF is unreadable, and staff receive an automated lead event to trigger OCR or manual review.
- **Stuck State Prevention**: Maps extraction failures to explicit `cv_unreadable` codes rather than leaving them in a generic `failed` state.

### UI & UX Improvements
- **Server Errors**: The application form now displays server-side error messages (with reference IDs) instead of generic "Network error".
- **Notifications**: Integrated `sonner` toasts for success and unreadable file warnings.

## Technical Details

- **File**: `src/lib/apply.functions.ts`
    - Added duplicate check logic.
    - Integrated `cv-extractor.server.ts` for immediate text-layer validation.
    - Added `logApplicationIncident` to `catch` blocks.
- **File**: `src/lib/cv-extractor.server.ts`
    - Standardized `cv_unreadable` reason code.
- **File**: `src/routes/jobs.$id.apply.tsx`
    - Updated `onSubmit` to handle specific rejection codes (e.g., `already_applied`).
    - Added `serverError` display with trace ID visibility.
- **File**: `src/lib/incident-logger.server.ts` (New)
    - Helper for recording high-severity application failures in the `incidents` table.
