# TMAS Reach

**Marketing and Outreach Management Platform for TMAS Academy**

TMAS Reach is an internal web application designed for **TMAS Academy** to streamline and coordinate marketing outreach to schools, school districts, educators, and educational organizations. It centralizes contact management, personalized email templating, multi-stage approval workflows, controlled batch delivery, and delivery analytics in one unified platform.

---

## Current Status

**Active Development — Complete Full-Stack Architecture Implemented & Verified**

The application features a decoupled frontend (`apps/web`), a backend API service with RBAC and ESP webhook processing (`apps/api`), an asynchronous batch worker, and an authentic **Educator Outreach Intake Survey System**. The codebase contains 33 passing automated tests across frontend and backend services.

---

## Objectives & Implemented Features

* **Authentic Educator Intake & Survey Hub:** Collect verified school and educator information via the built-in Educator Intake Survey (`/intake` / `POST /api/surveys`) or map external Google Forms data. Fictitious placeholder records have been eliminated to protect domain deliverability and enforce CAN-SPAM compliance.
* **Contact Management & Suppression Tracking:** Add, edit, search, and categorize contacts by audience tag (`high_school`, `middle_school`, `district_admin`, `educators`, `nonprofit`). Includes manual suppression controls restricted to Leads and Admins.
* **CSV Import & Deduplication Engine:** Upload or paste contact spreadsheets with automated whitespace normalization, lowercase email syntax validation, duplicate email detection, and strict suppression protection to prevent reactivating opted-out contacts.
* **Email Template Builder:** Create reusable outreach templates supporting double-curly-brace variable personalization (`{{first_name}}`, `{{last_name}}`, `{{organization}}`, `{{job_role}}`, and mandatory `{{unsubscribe_url}}`) with default fallbacks.
* **Campaign Workflow & Pre-Approval Gate:** Full campaign lifecycle management (`draft` &rarr; `pending_approval` &rarr; `approved` / `rejected` &rarr; `sending` &rarr; `completed`). Enforces 4 automated pre-approval validation checks before submission.
* **Backend API & Controlled Batch Scheduler:** Node.js/TypeScript backend API handling contacts CRUD, survey intake, ESP delivery/bounce webhooks with HMAC-SHA256 signature verification, and a batched background scheduler respecting provider rate limits.
* **Delivery Reporting & Analytics:** Live tracking of delivery rates, hard bounces, unsubscribe rates, and active contact pools, alongside an immutable activity audit trail (`activity_logs`).
* **Public Unsubscribe Portal:** Recipient-facing `GET /unsubscribe/:token` and `POST /unsubscribe` endpoints for one-click compliance opt-outs.

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
│   ├── api/                   # Node.js TypeScript API & Background Worker
│   │   ├── src/
│   │   │   ├── middleware/    # RBAC authentication & authorization guards
│   │   │   ├── routes/        # Contacts, campaigns, surveys, webhooks, unsubscribe
│   │   │   ├── services/      # Batch scheduler & simulated ESP client
│   │   │   ├── server.ts      # HTTP server with CORS and error handling
│   │   │   └── __tests__/     # Webhook signature & scheduler unit tests
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                   # React + TypeScript frontend (Vite, Tailwind CSS v4)
│       ├── public/            # Static assets and official TMAS Academy logo
│       ├── src/
│       │   ├── components/    # Modular UI views (contacts, survey hub, campaigns, templates)
│       │   ├── lib/           # CSV parser, survey engine, template engine, reactive store
│       │   └── types/         # Strict TypeScript models aligned with PostgreSQL schema
│       └── vite.config.ts     # Vite and Vitest configuration
├── db/
│   ├── migrations/            # Production PostgreSQL schema migrations
│   └── seeds/                 # Initial system user records and templates
├── docs/                      # Architectural, API, schema, survey, and CSV specifications
│   ├── api-and-permissions.md
│   ├── architecture.md
│   ├── csv-and-templates.md
│   ├── project-scope.md
│   ├── schema.sql
│   └── survey-intake-spec.md
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
- [x] **Milestone 9: Educator Outreach Intake Survey System** (Public school intake form, survey hub, CSV export)
- [x] **Milestone 10: Backend API Service & Webhooks** (`apps/api` Express router, HMAC webhook checks, batch scheduler worker)
- [ ] **Milestone 11: Production Database Deployment** (PostgreSQL / Supabase migration hosting)

---

## Getting Started Locally

### Prerequisites
* **Node.js** v20+ or v22+
* **npm** v10+

### Frontend Setup (`apps/web`)

```bash
cd apps/web
npm install
npm run dev
```

Run tests and production build:

```bash
npm run test
npm run build
```

### Backend API Setup (`apps/api`)

```bash
cd apps/api
npm install
npm test
npm run build
```
