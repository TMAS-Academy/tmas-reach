# TMAS Reach — System Architecture

## 1. Overview
TMAS Reach uses a decoupled frontend/backend architecture designed for low-maintenance, zero-cost/low-cost deployment while enforcing strict backend role checks and controlled email delivery.

## 2. Recommended Stack
- **Frontend (`apps/web/`):** React + TypeScript (`tsx`), Vite, Tailwind CSS, shadcn/ui.
- **Database & Auth:** PostgreSQL with Row-Level Security (Supabase or Neon + Auth.js/Clerk).
- **Backend API & Workers:** Node.js / TypeScript (or Python FastAPI) handling RBAC validation, CSV parsing, and email provider webhooks.
- **Email Service Provider (ESP):** Resend (or AWS SES) for transactional/campaign delivery and delivery/bounce webhooks.
- **Batch Scheduler:** Cron job / background worker polling `scheduled` or `sending` campaigns every 5 minutes to dispatch batches safely within ESP rate limits.

## 3. Core Data Flows

### Campaign Approval & Dispatch Flow
1. **Drafting (`marketing_intern`):** Selects an `email_template`, defines `target_audience_tag`, previews rendered output, and sends a test email to themselves.
2. **Submission:** Intern changes campaign status from `draft` to `pending_approval`.
3. **Review (`marketing_lead` or `administrator`):** Reviewer inspects rendered copy and recipient count, then sets status to `approved` (or `rejected` with `review_notes`).
4. **Recipient Snapshot:** Upon approval/scheduling, active, non-suppressed contacts matching `target_audience_tag` are inserted into `campaign_recipients` as `queued`.
5. **Batched Sending:** Background worker locks up to `batch_size` rows in `queued` status, personalizes variables (`{{first_name}}`, `{{organization}}`), injects the unique `unsubscribe_token` link, sends via ESP, and updates status to `sent`.

### Webhook & Suppression Flow
1. ESP sends POST events (`delivered`, `bounced`, `complained`) to `/api/webhooks/email`.
2. Backend verifies webhook signature and updates `campaign_recipients.delivery_status`.
3. If `bounced` (hard bounce) or `complained`, the corresponding `contacts.status` is automatically updated to `bounced` or `suppressed` to block all future outreach.