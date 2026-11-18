# TMAS Reach

Internal tool for TMAS Academy to manage school outreach contacts, email templates, and batch outreach campaigns.

---

## Status

Active development. 53 passing automated tests across frontend (`apps/web`) and API (`apps/api`).

---

## What It Does

- **Contact Management**: Store contacts with school, district, role, email, and audience tags (`high_school`, `middle_school`, `district_admin`, `educators`, `nonprofit`). Filter by school, district, role, tag, or delivery status. Supports single deletion and bulk actions (bulk delete, bulk suppress).
- **CSV Import**: Import contact spreadsheets. Detects email, name, school, district, role, and audience tag columns. Validates email syntax, skips duplicates, and protects opted-out or bounced contacts from reactivation.
- **Educator Intake Survey**: In-app form and CSV export for gathering real educator contact information. Submissions can be reviewed and added directly into active contacts.
- **Email Templates**: Reusable templates using `{{first_name}}`, `{{last_name}}`, `{{school}}`, `{{organization}}`, `{{district}}`, `{{job_role}}`, and `{{unsubscribe_url}}`.
- **Campaign Review & Approval**: Campaign workflow (`draft` -> `pending_approval` -> `approved` / `rejected` -> `sending` -> `completed`). Requires subject, body, unsubscribe link, and active contacts before submission.
- **Controlled Batch Sending**: Dispatches recipients in configurable batch sizes. Shows recipient delivery status (`queued`, `delivered`, `bounced`, `suppressed`) with simulated bounce testing.
- **Analytics**: Tracks sent count, delivery rate, bounce rate, and unsubscribe rate. Includes a breakdown table grouping deliveries by school and district.
- **Unsubscribe Portal**: Public endpoint (`/unsubscribe/:token`) letting recipients opt out. Opted-out contacts are suppressed from all future campaigns.
- **Team Roster & CSV Import**: Import staff and interns from a CSV with `email,name,role`. Accepts arbitrary personal and university email domains without hardcoding `@tmasacademy.org`.
- **Role-Based Access Control**:
  - `marketing_intern`: Add/edit contacts, templates, draft campaigns, submit for review.
  - `marketing_lead`: Campaign approvals, manual contact suppression, batch dispatch.
  - `administrator`: User and role management, full system access.
- **Theme**: Dark theme by default with light theme toggle.

---

## Roles & Permissions

| Action | Intern | Lead | Admin |
| :--- | :---: | :---: | :---: |
| Search & view contacts | Yes | Yes | Yes |
| Add / edit / import CSV contacts | Yes | Yes | Yes |
| Delete contacts (single / bulk) | Yes | Yes | Yes |
| Manually suppress contacts | No | Yes | Yes |
| Create / edit templates | Yes | Yes | Yes |
| Create draft campaigns | Yes | Yes | Yes |
| Test send to self | Yes | Yes | Yes |
| Submit campaign for review | Yes | Yes | Yes |
| Approve / reject campaigns | No | Yes | Yes |
| Dispatch batches | No | Yes | Yes |
| View analytics & audit logs | Yes | Yes | Yes |
| Manage users & roles | No | No | Yes |

---

## Project Layout

```text
tmas-reach/
├── apps/
│   ├── api/            # Express backend (RBAC, webhooks, batch worker)
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/            # React + TypeScript frontend (Vite, Tailwind CSS)
│       ├── src/
│       │   ├── components/
│       │   ├── lib/
│       │   └── types/
│       ├── package.json
│       └── vite.config.ts
├── db/                 # PostgreSQL migrations and seed data
├── docs/               # Specifications and schema references
└── README.md
```

---

## Running Locally

### Requirements
- Node.js 20+
- npm 10+

### Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev
```

App runs on `http://localhost:5173`.

Run tests and production build:

```bash
npm run test
npm run build
```

### Backend API (`apps/api`)

```bash
cd apps/api
npm install
npm test
npm run build
```
