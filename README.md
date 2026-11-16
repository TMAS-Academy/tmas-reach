# TMAS Reach

**Marketing and Outreach Management Platform for TMAS Academy**

TMAS Reach is an internal web application designed for **TMAS Academy** to streamline and coordinate marketing outreach to schools, school districts, educators, and educational organizations. It centralizes contact management, personalized email templating, multi-stage approval workflows, controlled batch delivery, and delivery analytics in one unified platform.

---

## Current Status

**Active Development — Core MVP Implemented & Verified**

The core application architecture, role-based access control (RBAC), contact manager, template engine, campaign approval gate, delivery simulator, and analytics dashboard are implemented, tested with Vitest, and verified via GitHub Actions CI.

---

## Objectives & Implemented Features

* **Contact Management & Suppression Tracking:** Add, edit, search, and categorize contacts by audience tag (`high_school`, `district_admin`, `educators`, `nonprofit`). Includes manual suppression controls restricted to Leads and Admins.
* **CSV Import Engine:** Upload or paste contact spreadsheets with automated whitespace normalization, lowercase email syntax validation, duplicate email detection, and strict suppression protection to prevent reactivating opted-out contacts.
* **Email Template Builder:** Create reusable outreach templates supporting double-curly-brace variable personalization (`{{first_name}}`, `{{last_name}}`, `{{organization}}`, `{{job_role}}`, and mandatory `{{unsubscribe_url}}`) with default fallbacks.
* **Campaign Workflow & Pre-Approval Gate:** Full campaign lifecycle management (`draft` &rarr; `pending_approval` &rarr; `approved` / `rejected` &rarr; `sending` &rarr; `completed`). Enforces 4 automated pre-approval validation checks before submission.
* **Controlled Batch Delivery:** Simulates batched sending within provider rate limits and generates recipient snapshots to prevent accidental duplicate sends.
* **Delivery Reporting & Analytics:** Live tracking of delivery rates, hard bounces, unsubscribe rates, and active contact pools, alongside an immutable activity audit trail (`activity_logs`).
* **Public Unsubscribe Portal:** Recipient-facing `GET /unsubscribe/:token` simulation for one-click compliance opt-outs.

---

## Role-Based Access Control (RBAC)

The application enforces three distinct user roles per `docs/api-and-permissions.md`:

| Capability | Marketing Intern | Marketing Lead | Administrator |
| :--- | :---: | :---: | :---: |
| View & Search Contacts | Yes | Yes | Yes |
| Create / Edit / Import CSV Contacts | Yes | Yes | Yes |
| Manually Suppress Contact | No | Yes | Yes |
| Create / Edit Email Templates | Yes | Yes | Yes |
| Create / Edit Draft Campaigns | Yes | Yes | Yes |
| Send Test Email to Self | Yes | Yes | Yes |
| Submit Campaign for Approval | Yes | Yes | Yes |
| Approve / Reject Campaigns with Notes | No | Yes | Yes |
| Trigger Batch Dispatch | No | Yes | Yes |
| View Analytics & Audit Logs | Read-Only | Full Access | Full Access |
| Manage Team Users & Roles | No | No | Yes |

---

## Project Structure

```text
tmas-reach/
├── .github/
│   └── workflows/ci.yml       # GitHub Actions CI (lint, test, build)
├── apps/
│   └── web/                   # React + TypeScript frontend (Vite, Tailwind CSS v4)
│       ├── public/            # Static assets and official TMAS Academy logo
│       ├── src/
│       │   ├── assets/        # Bundled images and icons
│       │   ├── components/    # Modular UI views (contacts, campaigns, templates, analytics)
│       │   ├── lib/           # CSV parser, template engine, RBAC helper, reactive store
│       │   └── types/         # TypeScript models aligned with PostgreSQL schema
│       └── vite.config.ts     # Vite and Vitest configuration
├── db/
│   ├── migrations/            # Production PostgreSQL schema migrations
│   └── seeds/                 # Initial seed dataset with realistic TMAS Academy records
├── docs/                      # Architectural, API, schema, and CSV specifications
│   ├── api-and-permissions.md
│   ├── architecture.md
│   ├── csv-and-templates.md
│   ├── project-scope.md
│   └── schema.sql
├── .env.example               # Template environment variables
├── AGENTS.md                  # Engineering and Git workflow guidelines
└── README.md
```

---

## Development Roadmap Progress

- [x] **Milestone 1: Architecture & Schema Definition** (`docs/schema.sql`, `docs/architecture.md`, `db/migrations/001_initial_schema.sql`)
- [x] **Milestone 2: Role-Based Access Control** (Intern, Lead, Admin role switching & permission matrix)
- [x] **Milestone 3: Contact Management & CSV Import** (Syntax normalization, duplicate deduplication, suppression protection)
- [x] **Milestone 4: Template Personalization Engine** (Variable interpolation, fallback defaults, live preview)
- [x] **Milestone 5: Campaign Management & Approval Gate** (Pre-approval verification checklist, test-send to self, lead sign-off)
- [x] **Milestone 6: Controlled Batch Delivery Simulation** (Recipient snapshots, batched dispatch)
- [x] **Milestone 7: Reporting, Audit Trail & Unsubscribe** (KPI dashboard, activity logs, recipient unsubscribe portal)
- [x] **Milestone 8: Automated Testing & CI Verification** (Vitest unit tests, ESLint, GitHub Actions CI)
- [ ] **Milestone 9: Production ESP Integration & Live Webhooks** (Resend / AWS SES webhook signature verification)

---

## Getting Started Locally

### Prerequisites
* **Node.js** v20+ or v22+
* **npm** v10+

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/TMAS-Academy/tmas-reach.git
cd tmas-reach/apps/web

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Run automated unit test suite
npm run test

# 5. Run linter and typecheck
npm run lint
npm run build
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Responsible Outreach & Compliance

TMAS Reach is designed strictly for authorized, legitimate school and educator outreach. The platform enforces unsubscribe link presence before any campaign can be approved, respects suppression lists across all future imports, and maintains an immutable audit log of outreach activities.
