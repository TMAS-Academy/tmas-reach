# TMAS Reach

**Marketing and Outreach Management Platform**

TMAS Reach is an internal web application for **TMAS Academy** designed to streamline outreach to schools, school districts, educators, and other organizations. It aims to centralize contact management, email campaigns, approval workflows, and campaign reporting in one platform.

## Objectives

* **Contact Management** — Import, organize, search, and manage outreach contacts.
* **Email Templates** — Create reusable templates with personalized content.
* **Campaign Management** — Build, preview, test, and schedule email campaigns.
* **Approval Workflows** — Allow authorized team members to review campaigns before sending.
* **Controlled Delivery** — Support batched sending and reliable handling of delivery failures.
* **Campaign Analytics** — Track delivery outcomes, bounces, unsubscribes, and campaign performance.

## Intended Users

| Role              | Purpose                                             |
| ----------------- | --------------------------------------------------- |
| Marketing Interns | Manage contacts and prepare outreach campaigns      |
| Marketing Leads   | Review campaigns and oversee outreach               |
| Administrators    | Manage users, permissions, and application settings |

## Planned Technology

The application architecture and technology stack will be finalized during initial development. The planned system will include a web frontend, backend API, relational database, background email-processing jobs, and an email service provider.

## Project Structure

```text
tmas-reach/
├── README.md
├── .gitignore
├── .env.example
├── docs/
│   └── project-scope.md
└── src/
```

This structure will evolve as the frontend, backend, and supporting services are implemented.

## Responsible Outreach

TMAS Reach is intended for legitimate organizational outreach. The platform will prioritize accurate contact records, recipient preferences, unsubscribe handling, secure access, and compliance with applicable email laws and provider policies.

## Development Roadmap

1. Define the architecture and database schema.
2. Implement authentication and role-based access.
3. Build contact management and CSV import.
4. Implement templates and campaign creation.
5. Add campaign previews, test sends, and approval workflows.
6. Integrate reliable, controlled email delivery.
7. Add reporting and deploy the application for authorized TMAS personnel.

## Documentation

See [`docs/project-scope.md`](docs/project-scope.md) for the detailed project scope, proposed workflows, and initial release requirements.

## Status

**Early development — initial project scaffolding and requirements definition.**
