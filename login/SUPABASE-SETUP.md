# Supabase account backend

The project is a static website that can be edited in Visual Studio or VS Code. No IDE extension is required.

## Connect your project

1. In your Supabase project's SQL Editor, run `supabase/migrations/202609110001_accounts.sql` once. It creates profiles, account warnings, signup provisioning, and row-level security. It does not delete existing Supabase users. Existing users receive Client or Freelancer profiles; Admin must be assigned explicitly.
2. Copy the project URL and public publishable (or legacy anon) key into `supabase-config.js`. Never put a service-role or secret key in browser code.
3. Serve the `login` directory through VS Code Live Server or a static HTTP server. For example, `python -m http.server 4173 --directory login` if Python is installed. Open `http://localhost:4173/auth/login.html`.
4. In Supabase Authentication URL Configuration, set Site URL to your site's origin. Add the exact local and deployed URLs for `/auth/login.html` and `/auth/update-password.html` to Redirect URLs. If serving from the repository root, include `/login` before `/auth`.
5. Enable the Email provider and email confirmation. Configure SMTP for real email delivery. Register separate Client and Freelancer accounts and confirm their email addresses.
6. Create the administrator through Supabase Authentication > Users, then use the SQL Editor with that user's exact UUID:

```sql
update public.profiles set role = 'admin' where id = 'REPLACE_WITH_ADMIN_USER_UUID';
```

Public registration cannot create administrators. Browser API clients cannot update the role column. Admins sign in at `/admin/login.html` using their actual Supabase email and password.

## Implemented scope

- Supabase signup, email/password login, recovery, session validation, logout, private profiles, and Admin account listing/warnings.
- Protected page scripts wait for server-verified identity and database role. Browser role values are display caches, not authorization.
- Former demo credentials and browser accounts are removed. On the first visit after this change, old Envisage browser data is cleared to prevent demo data or another account's private data from appearing in a real session.
- Profile fields are saved to Supabase. Images currently remain embedded in profile JSON; a Storage migration is still needed for large media.

## Create account

`auth/register.html` supports Client and Freelancer registration through Supabase Auth. It validates the selected role, name, email, password confirmation, and terms checkbox. The existing signup trigger provisions the matching private profile; no browser-only accounts are created.

Email confirmation is enabled in the connected project (checked October 2, 2026). Signup now opens a separate page, `auth/verify-email.html`. Users enter the OTP from their email, then see a verified screen with a **Back to homepage** link to sign in. Verification uses an isolated, nonpersistent Supabase client; it does not automatically sign in or enter onboarding. Only the pending email and resend cooldown are kept in session storage; passwords and codes are not stored. Incorrect/expired codes remain on the verification screen. Resends have a 60-second UI cooldown in addition to Supabase's server rate limits.

**Email delivery setup is still required:** see [OTP email setup](supabase/EMAIL-OTP-SETUP.md). The confirmation template is prepared in `supabase/templates/confirmation.html` and must be saved in the hosted project's Confirm sign up template. SMTP credentials must be entered in Supabase, never browser files. The database connector cannot change hosted Auth email settings. Live inbox delivery has not been tested.

Client onboarding saves a San Pedro barangay and opens discovery; a photo is optional. Freelancer onboarding saves a service and barangay, then opens the public profile editor. Saving the completed profile publishes it to discovery and opens availability. An external portfolio URL is optional. Setup writes are awaited before redirecting, and incomplete accounts are routed back to setup.

The regression suite covers signup metadata, confirmation/no-session behavior, duplicate accounts, resend and verification, and prevents admin registration. `supabase/tests/registration.sql` exercises both profile-provisioning and onboarding paths in a rollback transaction, including visibility of the new freelancer to another client. Actual delivery of confirmation emails needs a real inbox; the tests do not bypass verification.

## San Pedro discovery and bookings

Run `supabase/migrations/202609290001_marketplace.sql` and `202609290002_marketplace_validation.sql` after the accounts migration. These migrations are already applied to the configured Supabase project.

- All signed-in clients, including newly registered clients, see completed freelancer profiles from Supabase. There are no hardcoded discovery cards. Profiles and events use the 27 San Pedro barangays.
- Demo locations: Maya Santos in Pacita 1, Lucas Reyes in San Vicente, and Isabel Cruz in Calendola. These are editable from each freelancer's profile.
- Location selection, sidebar hover/focus summaries, service filters, and search use the shared directory.
- Inquiry → client requests booking → freelancer accepts → booking confirmed. Accepted bookings reserve their time. Declines, rejections, and cancellations release it.
- Only participants can read/send conversation messages. Admins can monitor booking details; freelancer acceptance confirms the booking directly. Direct status writes are forbidden; database functions enforce the role and transition.
- A transaction lock per freelancer prevents competing booking acceptances and manual blocks from overlapping. Calendar responses expose occupied times, never private block labels or client details.
- Calendars distinguish available, partly booked, and fully unavailable days. Times are in Philippine time. Pages refresh on focus and every 15 seconds while visible.
- Payment controls record client claims and freelancer confirmations only. No payment is processed. Completion requires the event date and confirmation from both participants. Rescheduling uses cancellation and a new request.

Portfolio uploads/posts, reviews, and helpdesk cases still need a shared backend. Old browser booking and inquiry records are not uploaded automatically.

## Verification

Run `node --test tests/auth.test.cjs tests/marketplace.test.cjs`. For SQL policy checks, run `supabase/tests/accounts.sql` and `supabase/tests/marketplace.sql` in the Supabase SQL Editor after the migrations; both roll back their fixtures. The marketplace checks cover new-client discovery, private messages, direct freelancer acceptance, invalid locations/services/dates, conflicting bookings, cancellation, and personal blocks. The marketplace SQL suite uses the demo freelancer names and an existing client/admin.

References: [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Admin panel and direct bookings (October 2, 2026)

Run `supabase/migrations/202610020001_admin_management.sql` after the existing migrations before using the updated frontend. This migration is not applied automatically by this static app. Existing Pending admin bookings become Approved (confirmed); existing published freelancers are grandfathered as approved. New completed freelancer profiles require admin review.

The panel at `admin/dashboard.html` provides users, freelancer applications, clients, bookings, service categories, reports, communication counts, notifications, and profile/password settings. Reports are stored in Supabase; old browser-only helpdesk cases are not migrated. Booking messages remain private; the admin report RPC permits content only for a Reviewing report and logs each access. Delete is available only for accounts without retained booking history; otherwise deactivate the account.

Run `node --test tests/auth.test.cjs tests/marketplace.test.cjs` and the rollback SQL suites after applying migrations. A trusted Supabase database connection is required for SQL validation.

Additional checks for the admin panel:
- `supabase/tests/admin-management.sql` is a self-contained rollback suite covering application approval, direct booking acceptance, report-scoped message access, audit logging, and suspension. Run it with a trusted SQL connection after applying the migrations.
- `tests/admin-dom.cjs`, `tests/marketplace-dom.cjs`, and `tests/registration-dom.cjs` export `run(parseHTML)` for the LinkeDOM parser. These test screens and interactions with fixture data; they do not replace live Supabase policy tests or visual browser checks.
- Website settings control the authenticated workspace name and announcement. Notification preferences are stored per administrator. Application and report queues refresh automatically on the overview, messages, and notifications screens.
- Service-category renames update freelancer profiles; removal is blocked while a freelancer still offers that category. Existing booking services remain historical records.
- Administrator role assignment remains a trusted database operation. The Users screen manages information, verification, and account access without allowing self-promotion to admin.

Verification in this workspace: 25 Node unit tests and all three DOM suites passed. JavaScript syntax checks passed. SQL suites were added/updated but not executed against the live database; only a public Supabase key is configured. No connected browser was available for visual verification.

Deployment update (2026-10-02): Applied the admin management migration to the configured Supabase project using the connected Supabase plugin. The self-contained admin-management SQL rollback suite passed: application review, direct booking acceptance, private messages, report review, moderation audit logging, and suspension. The admin_message_summary() function and seven service categories are present. Visual browser verification remains unavailable.

## Client discovery map and stable location hover
The discovery sidebar now uses fixed row padding and no lower preview to avoid hover-induced layout movement. Per-location and selected-result counts are removed. The San Pedro OpenStreetMap view uses profile photos from the public freelancer directory and the client's saved barangay for approximate proximity. No new Supabase migration is needed. See `assets/maps/README.md` for data sources, licensing, privacy behavior, and map tests.
## Sequential booking payments and notifications (October 3, 2026)

Applied `20261002141209_booking_payment_progress.sql` and `20261003051758_booking_notifications.sql` to the connected Supabase project.

- A new inquiry is immediately actionable by the freelancer. Acceptance reserves its time and waits for client acknowledgement; it does not assert payment receipt.
- Freelancers set the agreed total, deposit, balance due date, account name and QR before acceptance. The total/deposit/due date are locked afterward. Existing agreements retain the prior 50/50 amounts; existing verified deposits migrate to Partially Booked.
- Clients acknowledge, open Pay Deposit, and submit their payment claim. Only the assigned freelancer can confirm receipt. Deposit receipt makes the booking Partially Booked (yellow). Clients can pay the balance early after deposit confirmation; balance receipt makes it Fully Booked (green). Completion remains a separate, two-party step after the event date.
- Payment issues stay unconfirmed, create admin reports, and return the relevant installment to its required/due state so the participants can resolve it and resubmit. Direct table writes and skipped/duplicate transitions remain blocked.
- Freelancer profile editing now asks for a raster QR image and payment account name. The private profile stores these defaults. Accepting a new inquiry copies them into that booking's payment details; changing a profile later does not silently replace an existing booking's QR. QR fields are omitted from the public freelancer directory.
- View Payment QR opens the stored QR. Pay Remaining Balance is available after deposit confirmation, including before the due date. Real payment happens in the client's bank/e-wallet, followed by freelancer verification.
- Database triggers create private, recipient-specific notifications for inquiries, acceptance, client acknowledgement, payment submissions, confirmations, disputes, declines and cancellations. Both workspaces show an unread badge, update toast and Notifications inbox. Refresh runs on focus and every 15 seconds while the page is visible. These are in-app notifications, not emails or browser push messages.

Validation: 29 auth/marketplace unit tests, all eight DOM suites, and live rollback SQL suites `payment-progress.sql` and `admin-management.sql` passed. The payment suite checks receipt order, participant permissions, immutable amounts, due dates, disputes, calendar classification, notification recipients/privacy and read permissions. DOM checks cover acknowledgement, QR viewing, staged controls, profile QR persistence, notification links and unread counts. Browser visual verification remains unavailable in this session.

Security advisor review: the guarded RPCs intentionally use SECURITY DEFINER because browser roles cannot directly write booking state; each payment mutation verifies the caller against the assigned participant and checks account/status conditions. Their authenticated-execution notices were reviewed against the role-denial tests. See [Supabase's function advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). The pre-existing leaked-password-protection setting remains unchanged.
# Booking reviews and report warnings

Applied migration `20261003053244_booking_reviews_and_report_warnings.sql` restricts cancellation to the assigned freelancer, including API calls. Admins issue a private warning from a client report in Reviewing status; each report permits one warning. Warnings and their notification links appear on the freelancer profile.

After a booking is Completed, its client can publish one 1–5 star review with written feedback from the booking detail page. Reviews appear on the freelancer's public profile for signed-in users. Only the server sets the author and booking associations. Payment disputes remain available during the payment flow.

Regression coverage: `supabase/tests/reviews-warnings.sql` (transaction rolled back), `tests/reviews-dom.cjs`, and the payment, admin and notification DOM suites.


## Payment receipts and cancellation agreements

Applied `20261003062853_booking_receipts_and_cancellation_terms.sql` and `20261004081704_receipt_label_encoding.sql`.

- Default example for new agreements: client cancellation within 3 calendar days of the event retains 50% of the deposit. Earlier cancellations or freelancer-initiated cancellations refund all confirmed payments. Freelancers can change these example terms before accepting; terms lock afterward and appear in client acknowledgement. Existing accepted agreements receive no retroactive deduction.
- Clients request cancellation and freelancers finalize it. A request does not release the calendar slot. The request timestamp determines the fee window in Manila time; freelancer processing delays do not increase the deduction. Unverified payment submissions must be resolved before cancellation. Further payment submissions pause while cancellation is pending.
- Deposit and remaining-balance confirmations create immutable receipt snapshots. Cancellation creates a separate statement with confirmed paid, deduction and refund due. Participants can view, print or save these through the browser's PDF destination. Receipts do not expose payment QR data. No money or refund is transferred by Envisage.
- Completion buttons explain their prerequisites. Both participants still confirm delivery, separately from full payment. Completion notifications link to the booking.
- Verified: 29 unit tests, 10 DOM suites, and rollback-only `supabase/tests/booking-receipts.sql` covering early balance, receipt privacy/immutability, unverified claims, locked terms, refund boundaries, legacy agreements and cancellation roles.
- Security advisor: new tables have RLS. Authenticated SECURITY DEFINER notices are intentional for participant-guarded RPCs; see [Supabase function access advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Existing [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled and is unrelated to this change.

## Shared freelancer work

`20261004090138_freelancer_public_work.sql` stores portfolio samples and project posts in Supabase with author-only publishing/removal. Signed-in clients can read work from active, approved freelancers through `freelancer_public_work`; pending freelancers can manage their own work. Client profiles always show Portfolio & Posts, independently of the optional external portfolio URL.

Selected post photos preview before publication and can be removed. New posts persist across devices. Old unscoped browser-only posts and portfolio samples remain reviewable drafts; the freelancer explicitly publishes their own saved work. No automatic cross-account import occurs.

Validation: 11 DOM suites passed, including photo previews and the client portfolio feed; rollback-only `supabase/tests/freelancer-work.sql` verifies public reads, author-only mutation, pending visibility and invalid media/link rejection. Security advisor returned intentional authenticated function notices and the existing leaked-password-protection notice documented above.

## Payments in the booking conversation (October 8, 2026)

The client and freelancer booking and inquiry threads now open with Messages & payments. Booking details, payment terms, cancellation and printable receipts remain under a disclosure below the conversation. Agreement acceptance is inline instead of an automatic modal.

- Clients choose GCash, Bank transfer (any mobile banking app), Maya, GoTyme or Other, attach a gallery receipt photo, and send payment proof without opening a QR modal first. The amount and deposit/balance stage come from the booking. The selected method records how the client paid; it does not integrate with or automatically transfer through a payment provider. Participants confirm the correct recipient account in the chat.
- Freelancers check their account and confirm receipt in the same conversation, optionally attaching a receipt photo. Existing notifications, sequential payment transitions and immutable receipts remain server controlled. Ordinary photo messages never change payment status.
- JPG, PNG and WebP photos up to 6 MB preview before sending. Upload/RPC failures retain the draft. Photos use the private booking-chat Storage bucket and short-lived signed URLs; participant policies prevent unrelated users from reading or writing them. Published evidence cannot be removed through the browser API. Direct message inserts remain limited to booking_id and body, so they cannot forge a payment event.
- The send_booking_payment RPC performs the existing guarded transition and message insert in one transaction. A client submission is pending, not confirmed money received. A freelancer confirmation still creates the existing receipt and notification. Existing pending bookings can be confirmed without requiring retroactive photo uploads.

Migration: supabase/migrations/20261008121743_booking_chat_payments.sql. Applied to the Envisage Supabase project on 2026-10-23 with explicit user approval. Verified the private 6 MB booking-chat bucket, payment/photo RPCs, and all three rollback-only SQL suites: booking-chat-payments.sql, payment-progress.sql, and booking-receipts.sql. Updated the receipt-retention test to expect the current Supabase Storage direct-delete protection. Security advisors report intentional participant-guarded authenticated SECURITY DEFINER functions and the existing disabled leaked-password protection; no new unprotected tables were introduced. Browser testing with real photo uploads remains a separate end-to-end check.

Verified locally: 32 auth/marketplace unit tests and six relevant DOM suites pass, including the new gallery/payment integration suite. Chromium checks pass at 320, 375, 768 and 1440 px for gallery selection, Bank transfer submission, pending state, and freelancer confirmation without overflow. No real money transfers or real-user payment records were changed.

