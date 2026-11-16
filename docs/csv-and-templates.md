# TMAS Reach — CSV Import & Template Personalization Spec

## 1. CSV Import Rules
- **Required Columns:** `email`
- **Optional Columns:** `first_name`, `last_name`, `organization`, `job_role`, `audience_tag`
- **Normalization:**
  - Trim leading/trailing whitespace on all fields.
  - Lowercase `email` before duplicate checking.
  - Reject rows with invalid email syntax and return a downloadable/viewable error report for skipped rows.
- **Duplicate Handling:**
  - If `email` already exists in `contacts`, skip overwrite by default (or allow explicit "update empty fields only" option) and never overwrite `unsubscribed`, `bounced`, or `suppressed` statuses back to `active`.

## 2. Supported Template Variables
Templates support double-curly-brace syntax with fallback defaults:
- `{{first_name}}` (Fallback: `"Educator"` or `"there"`)
- `{{last_name}}`
- `{{organization}}` (Fallback: `"your school"`)
- `{{job_role}}`
- `{{unsubscribe_url}}` *(Required in every campaign footer before approval)*

## 3. Pre-Approval Validation Checks
Before a campaign can move to `pending_approval`, the backend must verify:
1. Subject and body are non-empty.
2. Body contains `{{unsubscribe_url}}`.
3. Target audience resolves to at least 1 `active` contact.
4. No unresolved/malformed `{{...}}` tags exist in the rendered preview.