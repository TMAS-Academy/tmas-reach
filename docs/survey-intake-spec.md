# TMAS Reach — Educator Outreach Intake & Survey Specification

## 1. Overview & Compliance Rationale

In high-stakes educational outreach, sending cold emails to fictitious, scraped, or unverified contact lists severely damages domain deliverability, triggers spam filters, and violates CAN-SPAM and FERPA/school communication regulations.

To solve this, **TMAS Reach** enforces an authentic intake model:
- All placeholder and fake seed contacts have been completely eliminated from the platform database.
- Outreach data is collected directly from verified school leaders, department chairs, and educators via an **Intake Survey**.
- Submissions undergo staff review in the **Intake Survey Hub** and can either be:
  1. Promoted directly into active outreach contacts with one-click deduplication.
  2. Exported as a standardized, clean CSV conforming to the TMAS Reach CSV schema for batch review or archival.

---

## 2. Intake Methods

TMAS Reach supports two flexible intake flows:

```
[ School Educator / Administrator ]
                │
        ┌───────┴───────┐
        ▼               ▼
[ Native Intake Form ] [ Google Form / External ]
 (web /api/surveys)      (Google Sheets CSV Export)
        │                       │
        ▼                       ▼
[ Intake Survey Hub ]   [ CSV Import Modal ]
        │                       │
        └───────┬───────────────┘
                ▼
   [ Verified Contacts DB ]
                │
                ▼
   [ Strict Pre-Approval Gate ]
                │
                ▼
   [ Controlled Batch Dispatch ]
```

### Method A: Built-in Educator Intake Form
- Accessible directly within TMAS Reach under the **Intake Survey** navigation tab or as an embeddable public form (`POST /api/surveys`).
- Validates school email addresses, extracts audience classification, records curricular interest, and mandates explicit consent.
- Submissions are logged immediately in `pending_review` status.

### Method B: Google Forms / External Survey Ingestion
When conducting external surveys or intake via Google Forms, questions should be configured to map directly into the standard CSV columns:

| Google Form Question | Field Description | Target CSV Header | Example Value |
| :--- | :--- | :--- | :--- |
| School / Work Email | Educator's verified institutional email | `email` | `math.chair@lincolnhigh.edu` |
| First Name | Educator's given name | `first_name` | `Sarah` |
| Last Name | Educator's family name | `last_name` | `Jenkins` |
| School or District Name | Official educational institution | `organization` | `Lincoln High School` |
| Role / Title | Position in school | `job_role` | `Math Department Chair` |
| Grade Level Category | Outreach audience classification | `audience_tag` | `high_school` |

---

## 3. Standard CSV Header Specification

When exporting from Google Sheets or Excel, ensure the first line matches:

```csv
email,first_name,last_name,organization,job_role,audience_tag
```

### Supported `audience_tag` Values:
- `high_school` — High school teachers, math department heads, competition coordinators
- `middle_school` — Middle school educators and STEM leads
- `district_admin` — Superintendents, curriculum supervisors, and STEM specialists
- `educators` — General teachers, adjunct faculty, and instructors
- `nonprofit` — Community learning centers, math circles, and youth academic foundations

---

## 4. Deduplication & Suppression Safety

When importing survey submissions into the active contacts list (either via the API, the Survey Hub UI, or the CSV Import modal):
1. **Case-Insensitive Normalization:** Emails are normalized to lowercase (e.g., `Teacher@School.ORG` becomes `teacher@school.org`).
2. **Duplicate Protection:** If the email address already exists in the contacts table, the system prevents duplicate creation and notifies the user.
3. **Suppression Enforcement:** If a contact was previously marked as `unsubscribed`, `bounced`, or `suppressed`, the system strictly prevents re-activation or re-import to protect sender reputation.
