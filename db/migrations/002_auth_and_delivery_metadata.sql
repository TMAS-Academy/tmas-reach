-- Migration: 002_auth_and_delivery_metadata.sql
-- Description: Adds auth credentials, contact/survey metadata, delivery retry fields,
--              surveys table, and webhook deduplication tracking for TMAS Reach.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE campaign_recipients
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

ALTER TABLE activity_logs
    ADD COLUMN IF NOT EXISTS actor_name TEXT;

CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    organization TEXT NOT NULL,
    district TEXT,
    job_role TEXT NOT NULL,
    audience_tag TEXT NOT NULL,
    grade_levels JSONB NOT NULL DEFAULT '[]'::JSONB,
    estimated_students INT,
    notes TEXT,
    consent_outreach BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending_review',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);

CREATE TABLE IF NOT EXISTS processed_webhooks (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
