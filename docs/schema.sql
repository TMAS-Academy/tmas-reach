-- TMAS Reach Initial Release Schema (PostgreSQL / Supabase)
-- Aligned with docs/project-scope.md

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('marketing_intern', 'marketing_lead', 'administrator');
CREATE TYPE contact_status AS ENUM ('active', 'unsubscribed', 'bounced', 'suppressed');
CREATE TYPE campaign_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'sending', 'completed', 'cancelled');
CREATE TYPE delivery_status AS ENUM ('queued', 'sent', 'delivered', 'bounced', 'failed', 'skipped_suppressed');

-- 2. USERS & RBAC (Maps to Auth provider user IDs)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'marketing_intern',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CONTACTS & SUPPRESSION
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL, -- Enforces duplicate email detection
    first_name TEXT,
    last_name TEXT,
    organization TEXT,          -- School, district, or organization name
    job_role TEXT,              -- e.g., Principal, Math Dept Chair, Teacher
    audience_tag TEXT,          -- e.g., 'high_school', 'district_admin', 'nonprofit'
    status contact_status NOT NULL DEFAULT 'active',
    unsubscribe_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    last_contacted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_audience ON contacts(audience_tag);

-- 4. REUSABLE EMAIL TEMPLATES
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject_template TEXT NOT NULL, -- Supports {{first_name}}, {{organization}}, etc.
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CAMPAIGNS & APPROVAL WORKFLOW
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE RESTRICT,
    target_audience_tag TEXT,       -- Filter criteria for recipients
    status campaign_status NOT NULL DEFAULT 'draft',
    scheduled_for TIMESTAMPTZ,
    batch_size INT NOT NULL DEFAULT 50 CHECK (batch_size > 0 AND batch_size <= 500),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Guardrail: Cannot be approved without a reviewer
    CONSTRAINT chk_approval_requires_reviewer CHECK (
        status NOT IN ('approved', 'scheduled', 'sending', 'completed') OR reviewed_by IS NOT NULL
    )
);

-- 6. CAMPAIGN RECIPIENTS & DUPLICATE-SEND PREVENTION
CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    delivery_status delivery_status NOT NULL DEFAULT 'queued',
    provider_message_id TEXT,       -- ID returned by Resend / SendGrid / SES
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Guardrail: Prevents accidentally sending the same campaign twice to one contact
    CONSTRAINT uq_campaign_contact UNIQUE (campaign_id, contact_id)
);

CREATE INDEX idx_recipients_campaign_status ON campaign_recipients(campaign_id, delivery_status);

-- 7. AUDIT & ACTIVITY LOGS (Required by Section 6 of Project Scope)
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,           -- e.g., 'csv_imported', 'campaign_approved', 'contact_unsubscribed'
    entity_type TEXT NOT NULL,      -- e.g., 'campaign', 'contact', 'template'
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);