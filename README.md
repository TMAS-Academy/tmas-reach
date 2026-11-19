# TMAS Reach

Internal tool for TMAS Academy to manage school outreach contacts, email templates, and batch outreach campaigns.

---

## Status

Active development. 132 passing automated tests across frontend (`apps/web`: 84 tests in 17 suites) and API (`apps/api`: 48 tests in 9 suites). GitHub Actions CI verifies lint, tests, and builds for both apps.

---

## What It Does

- **Contact Management**: Store contacts with school, district, role, email, notes, interaction history drawer, and audience tags (`high_school`, `middle_school`, `district_admin`, `educators`, `nonprofit`). Filter by school, district, role, tag, or delivery status, sort columns, paginate results, jump to search with `/`, delete or suppress contacts individually or in bulk, and export RFC-4180 CSV files.
- **CSV Import**: Import contact spreadsheets. Detects email, name, school, district, role, and audience tag columns. Validates email syntax, detects duplicates with skip/merge handling, and blocks reactivation of opted-out or bounced contacts.
- **Educator Intake Survey**: In-app form (including optional district), submission review and archiving, CSV export, and direct promotion of reviewed entries into active contacts.
- **Email Templates**: Reusable templates using `{{first_name}}`, `{{last_name}}`, `{{school}}`, `{{organization}}`, `{{district}}`, `{{job_role}}`, and `{{unsubscribe_url}}`. Includes cursor-position variable insertion, template duplication, subject length counter, live spam-risk warnings, sanitized HTML preview, and side-by-side editor/preview on wide screens.
- **Campaign Review & Approval**: Workflow stepper (`draft` -> `pending_approval` -> `approved` / `rejected` -> `sending` -> `completed`) with live eligible recipient counts, pre-submit validation, duplicate send prevention guard, live **Test Send to Self**, and reopen/resubmit support for rejected campaigns.
- **Controlled Batch Sending & Provider Adapter**: Dispatches recipients in configurable batch sizes using a concurrency lock, pre-send suppression re-check, token-bucket rate limiting, exponential retry/backoff with terminal `failed` state, manual dispatch endpoint (`POST /api/campaigns/:id/dispatch`), and a native Node 22 `fetch` Resend client with `Idempotency-Key` support (falls back to the mock sender when `RESEND_API_KEY` is unset).
- **Webhooks & Unsubscribe Portal**: Verifies raw-body HMAC-SHA256 webhook signatures (`x-esp-signature` and Svix/Resend headers) with a 5-minute replay window and event deduplication, automatically cancels remaining queued recipients on bounce or complaint, and exposes `/unsubscribe/:token` plus a public `?token=` portal.
- **Analytics & Audit Trail**: Tracks sent count, delivery rate, bounce rate, and unsubscribe rate (displays `—` when zero messages are sent), breaks down deliveries by school and district, and provides searchable, filterable, paginated Activity Logs with CSV export and `GET /api/logs`.
- **Authentication, Production Readiness & Persistence (`apps/api`)**: Built on Node.js 22+ with zero external runtime dependencies. Enforces `scrypt` password hashing and HS256 JWT authentication (header-based dev bypass is disabled in production and non-test defaults), rate-limited login, first-admin bootstrap, team user CRUD with one-time temporary passwords, Resend domain verification (`POST /api/system/verify-domain`), `GET /api/system/readiness`, structured JSON logging, `413` body limits, security headers, HTTP timeouts, graceful shutdown, and `node:sqlite` WAL persistence via `SQLITE_DB_PATH`.
- **Frontend Runtime & UI (`apps/web`)**: Built with React 19, Vite 8, and Tailwind CSS v4. Connects to `apps/api` when `VITE_API_BASE_URL` is configured (with login/first-time admin setup, password change modal, API-backed workspace sync, and the Admin **Production Readiness** panel) or runs offline in local browser mode. Uses `useSyncExternalStore`, React `ErrorBoundary`, accessible dialogs/drawers/confirmations, a `Ctrl/Cmd+K` command palette, URL `?tab=` sync, and a dark theme default with light toggle.
- **Team Roster & RBAC**: Import staff and interns from a CSV with `email,name,role` across any email domain, enforce role checks (`marketing_intern`, `marketing_lead`, `administrator`), and prevent demoting, deactivating, or removing the last remaining administrator.

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
| Manage users, roles & readiness checks | No | No | Yes |

---

## Project Layout

```text
tmas-reach/
├── .github/workflows/ci.yml  # CI verification for apps/web and apps/api
├── .env.example              # Environment variable template
├── render.yaml               # Render blueprint (API + disk + static frontend)
├── apps/
│   ├── api/                  # Node.js 22 HTTP API (JWT auth, RBAC, SQLite WAL, webhooks, batch worker)
│   │   ├── Dockerfile        # Multi-stage Node 22 Alpine container
│   │   ├── src/
│   │   │   ├── lib/          # Config loader, JWT/scrypt auth, JSON logger, node:sqlite WAL persistence
│   │   │   ├── middleware/   # RBAC guards
│   │   │   ├── routes/       # Auth, users, system readiness, contacts, campaigns, surveys, logs, unsubscribe, webhooks
│   │   │   ├── services/     # Batch scheduler and Resend/mock email provider
│   │   │   ├── __tests__/    # Vitest unit tests
│   │   │   └── server.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/                  # React 19 + TypeScript frontend (Vite 8, Tailwind CSS v4)
│       ├── public/_redirects # Netlify / Cloudflare Pages SPA fallback
│       ├── vercel.json       # Vercel SPA fallback
│       ├── src/
│       │   ├── components/
│       │   ├── lib/
│       │   └── types/
│       ├── package.json
│       └── vite.config.ts
├── db/                       # PostgreSQL migrations and seed data
├── docs/                     # Specifications, schema references, and deployment guide
└── README.md
```

---

## Running Locally

### Requirements
- Node.js 22+
- npm 10+

### Backend API (`apps/api`)

```bash
cd apps/api
npm install
npm test
npm run typecheck
npm run build
npm start
```

API listens on `http://localhost:4000` and exposes `GET /api/health` and `GET /api/ready`.

### Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev
```

App runs on `http://localhost:5173` in local demo mode by default. To connect the UI to a running local API server with full authentication and shared persistence, set `VITE_API_BASE_URL=http://localhost:4000` before starting Vite:

```bash
VITE_API_BASE_URL=http://localhost:4000 npm run dev
```

Run lint, tests, and production build:

```bash
npm run lint
npm test
npm run build
```

---

## Hosting & Production Setup

See [docs/deployment-guide.md](docs/deployment-guide.md) for step-by-step instructions on hosting `apps/api` (Railway, Render, or Docker) and `apps/web` (Vercel, Netlify, or Cloudflare Pages), configuring DNS/webhooks in Resend, and running first-time admin setup.

---

## Environment Variables

Copy `.env.example` when configuring runtime services:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Runtime mode (`production` enforces strict JWT auth) | `development` |
| `PORT` | API HTTP listening port | `4000` |
| `CORS_ORIGIN` | Allowed frontend origin for CORS | `http://localhost:5173` |
| `APP_PUBLIC_URL` | Base URL used in generated unsubscribe links | `http://localhost:5173` |
| `AUTH_SECRET` | Secret key (32+ chars) for HS256 JWT signing | — |
| `AUTH_TOKEN_TTL_SEC` | JWT lifetime in seconds | `43200` |
| `ALLOW_DEV_AUTH` | Allow `x-user-role` headers outside production (never in `production`) | `false` |
| `ADMIN_EMAIL` | Optional initial admin email to seed on startup | — |
| `ADMIN_PASSWORD` | Optional initial admin password (8+ chars) | — |
| `ADMIN_NAME` | Optional initial admin display name | `Administrator` |
| `BODY_LIMIT_BYTES` | Maximum request payload size in bytes | `1048576` |
| `RATE_LIMIT_PER_SEC` | Outbound batch send rate limit | `8` |
| `SCHEDULER_INTERVAL_MS` | Batch worker polling interval in ms | `15000` |
| `LOG_LEVEL` | API log level (`debug`, `info`, `warn`, `error`, `silent`) | `info` |
| `SQLITE_DB_PATH` | Path for `node:sqlite` WAL file (omit for in-memory mode) | `./data/tmas-reach.sqlite` |
| `RESEND_API_KEY` | Resend API key (falls back to mock sender if unset) | — |
| `EMAIL_FROM_ADDRESS` | Sender address for outbound campaign emails | `outreach@example.com` |
| `WEBHOOK_SIGNING_SECRET` | Secret for verifying provider webhook signatures | — |
| `VITE_API_BASE_URL` | Optional API base URL for `apps/web` (`Local mode` if unset) | `http://localhost:4000` |
