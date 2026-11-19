# TMAS Reach Deployment Guide

This guide covers deploying `apps/api` and `apps/web`, verifying a sending domain in Resend, and onboarding your first administrator and interns.

---

## 1. Deploy the Backend API (`apps/api`)

Deploy `apps/api` on any Node.js 22 host with a persistent volume (Railway, Render, Fly.io, or Docker using `apps/api/Dockerfile`). A `render.yaml` blueprint is included at the repository root.

- **Root Directory:** `apps/api`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`
- **Health Checks:** `GET /api/health` and `GET /api/ready`
- **Persistent Volume:** Mount a disk at `/data` and set `SQLITE_DB_PATH=/data/tmas-reach.sqlite`

### Required API Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Disables dev header auth bypass when set to `production` | `production` |
| `PORT` | HTTP listening port (injected by most hosts) | `4000` |
| `AUTH_SECRET` | Random secret (32+ chars) for signing HS256 JWTs | `openssl rand -hex 32` |
| `SQLITE_DB_PATH` | Path on persistent volume for SQLite WAL database | `/data/tmas-reach.sqlite` |
| `CORS_ORIGIN` | Allowed frontend URL (no trailing slash) | `https://reach.yourdomain.org` |
| `APP_PUBLIC_URL` | Public frontend URL used inside unsubscribe links | `https://reach.yourdomain.org` |
| `RESEND_API_KEY` | Live Resend API key | `re_...` |
| `EMAIL_FROM_ADDRESS` | Verified sender address in Resend | `Outreach <outreach@mail.yourdomain.org>` |
| `WEBHOOK_SIGNING_SECRET` | Signing secret from Resend webhook settings | `whsec_...` |

Optional bootstrap env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`) seed an initial administrator on startup if the database has no users yet. Leave them unset if you prefer completing the browser setup screen on first launch.

If you also maintain a PostgreSQL database, apply `db/migrations/001_initial_schema.sql` followed by `db/migrations/002_auth_and_delivery_metadata.sql`.

---

## 2. Deploy the Frontend (`apps/web`)

Deploy `apps/web` as a static site on Vercel, Netlify, or Cloudflare Pages (`apps/web/vercel.json` and `apps/web/public/_redirects` handle SPA rewrites so direct `/unsubscribe/<token>` links work).

- **Root Directory:** `apps/web`
- **Build Command:** `npm ci && npm run build`
- **Output Directory:** `dist`
- **Environment Variable:**
  - `VITE_API_BASE_URL=https://<your-api-domain>` (omit trailing slash)

Setting `VITE_API_BASE_URL` turns off local browser demo mode and switches the UI to authenticated API mode.

---

## 3. Configure Resend Domain & Webhooks

1. In Resend, go to **Domains** and add your sending domain (or a subdomain such as `mail.yourdomain.org`).
2. Add the SPF, DKIM, and DMARC DNS records Resend displays to your domain DNS provider and wait for Resend status to change to **Verified**.
3. Set `EMAIL_FROM_ADDRESS` on the API service to an address on that verified domain and set `RESEND_API_KEY`.
4. In Resend **Webhooks**, create an endpoint pointing to:
   `https://<your-api-domain>/api/webhooks/email`
5. Subscribe to `email.delivered`, `email.bounced`, and `email.complained`.
6. Copy the webhook signing secret into `WEBHOOK_SIGNING_SECRET` on the API service.

---

## 4. First-Time Setup & Onboarding Interns

1. Open your deployed frontend URL. When the database has no users yet, TMAS Reach displays **Set Up Administrator Account**.
2. Create the first administrator account (`Full Name`, `Email Address`, and an 8+ character password). This locks `/api/auth/bootstrap` against further public calls.
3. Open **Team & RBAC** and inspect the **Production Readiness** panel:
   - Confirm all 8 checks are green and **Ready for live outreach** is shown.
   - Click **Verify Resend Domain** to confirm your sending domain reports `verified`.
4. Add interns and marketing leads individually via **Add Member** or bulk-import via **Import Team CSV** (`email,name,role`). If you leave the password blank, the server generates a one-time temporary password you can hand to each team member.
5. Have interns sign in, update their password via the key icon in the top bar, and test an outreach draft with **Test Send to Self** before approving and dispatching live batches.
