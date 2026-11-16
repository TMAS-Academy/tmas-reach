# TMAS Reach — API Endpoints & RBAC Matrix

## 1. Role Permissions Matrix

| Action / Resource | Marketing Intern | Marketing Lead | Administrator |
| :--- | :---: | :---: | :---: |
| View & Search Contacts | Yes | Yes | Yes |
| Create / Edit / Import CSV Contacts | Yes | Yes | Yes |
| Manually Suppress Contact | No | Yes | Yes |
| Create / Edit Email Templates | Yes | Yes | Yes |
| Create / Edit Draft Campaigns | Yes | Yes | Yes |
| Send Test Email to Self | Yes | Yes | Yes |
| Submit Campaign for Approval | Yes | Yes | Yes |
| Approve / Reject / Cancel Campaign | No | Yes | Yes |
| Trigger / Schedule Live Dispatch | No | Yes | Yes |
| View Campaign Analytics & Logs | Read-Only | Yes | Yes |
| Manage Users & Roles | No | No | Yes |

## 2. Core API Endpoints

### Contacts
- `GET /api/contacts` — Paginated list with filters (`search`, `organization`, `audience_tag`, `status`).
- `POST /api/contacts` — Create single contact (checks duplicate email).
- `POST /api/contacts/import` — Validate CSV headers, deduplicate against existing emails, preview/commit import, and log to `activity_logs`.
- `PATCH /api/contacts/:id` — Update contact details or status.

### Templates & Campaigns
- `GET /POST /api/templates` — List and create reusable templates.
- `GET /POST /api/campaigns` — List and create draft campaigns.
- `POST /api/campaigns/:id/test-send` — Render template with sample/user contact data and send single test email.
- `POST /api/campaigns/:id/submit` — Move `draft` -> `pending_approval`.
- `POST /api/campaigns/:id/review` — *(Lead/Admin only)* Approve (`approved`) or reject (`rejected`) with notes.
- `GET /api/campaigns/:id/report` — Delivery summary (`queued`, `sent`, `delivered`, `bounced`, `unsubscribed`).

### Public & Webhooks (Unauthenticated / Signature-Verified)
- `GET /unsubscribe/:token` — Public one-click unsubscribe endpoint setting `contacts.status = 'unsubscribed'` and logging event.
- `POST /api/webhooks/email` — ESP delivery/bounce event handler.