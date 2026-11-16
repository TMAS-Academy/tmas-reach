# AGENTS.md — TMAS Reach Engineering Guidelines

## Project Overview
**TMAS Reach** is an internal marketing and outreach management platform for **TMAS Academy** (streamlining school/educator outreach, contact management, email templates, approval workflows, batched delivery, and campaign analytics).

- **Source of Truth:** Always read `docs/project-scope.md` and `README.md` before proposing architecture changes or creating issues.
- **Current Structure:**
  - `apps/web/` — React + TypeScript (`tsx`) frontend application
  - `docs/project-scope.md` — Product requirements, workflows, and release scope
  - *(Planned)* Backend API / Serverless functions, relational database (PostgreSQL / Supabase), and email provider integration (e.g., Resend).

## Role-Based Access Control (RBAC) Rules
All features and database schemas must enforce three distinct user roles:
1. **Marketing Interns:** Can import/manage contacts, create email templates, draft campaigns, and submit campaigns for approval. **Cannot** send live mass campaigns.
2. **Marketing Leads:** Can review, approve, reject, and schedule submitted campaigns, plus access campaign analytics.
3. **Administrators:** Full access to user roles, permissions, email provider settings, and system configuration.

## Core Engineering & Safety Guardrails
- **Approval Gate Enforcement:** Never allow a campaign to dispatch emails unless its status is explicitly `approved` by a `Marketing Lead` or `Administrator`.
- **Compliance & Responsible Outreach:** Every outbound campaign template must support unsubscribe handling (`unsubscribe_token` / opt-out flag) and bounce tracking. Never send to unsubscribed contacts.
- **Database & Auth:** Use strict Row-Level Security (RLS) if using Supabase/PostgreSQL. Never expose service-role keys or email API keys in `apps/web/`.
- **Secrets Management:** Never read, print, or commit `.env` files. Only update `.env.example` when adding new required environment variables.

## Git & GitHub CLI (`gh`) Workflow Rules
- **Never commit or push directly to `main`.**
- **Branch Naming:** Always create a feature branch off `main` using `codex/<issue-number>-<short-slug>` or `feat/<short-slug>`.
- **Atomic Commits:** Keep commits focused on a single feature or fix with clear conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`).
- **Pull Requests:** When finished with a task, push the branch and open a Pull Request via `gh pr create --fill` referencing the relevant GitHub Issue (`Closes #<id>`). Leave final merge approval to a human maintainer.
- **Verification Before PR:** Always run `npm run build` and `npm run lint` (or TypeScript typecheck `tsc --noEmit`) inside `apps/web/` before opening a PR.