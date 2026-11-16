-- Seed: 001_seed_data.sql
-- Description: Realistic initial data for TMAS Academy outreach platform.
-- Aligned with docs/schema.sql

BEGIN;

-- 1. USERS
INSERT INTO users (id, email, full_name, role, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'intern@tmasacademy.org', 'Alex Rivera', 'marketing_intern', true),
('00000000-0000-0000-0000-000000000002', 'lead@tmasacademy.org', 'Jordan Chen', 'marketing_lead', true),
('00000000-0000-0000-0000-000000000003', 'admin@tmasacademy.org', 'Dr. Sarah Patel', 'administrator', true)
ON CONFLICT (email) DO NOTHING;

-- 2. CONTACTS
INSERT INTO contacts (id, email, first_name, last_name, organization, job_role, audience_tag, status, unsubscribe_token, created_by) VALUES
('10000000-0000-0000-0000-000000000001', 'm.vasquez@lincolnhs.edu', 'Maria', 'Vasquez', 'Lincoln High School', 'Math Department Chair', 'high_school', 'active', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000002', 'd.kowalski@metrodist7.k12.org', 'David', 'Kowalski', 'Metro District 7', 'STEM Curriculum Director', 'district_admin', 'active', 'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000003', 'elena.rodriguez@oakridge.k12.org', 'Elena', 'Rodriguez', 'Oakridge High School', 'Principal', 'high_school', 'active', 'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000004', 'b.thompson@westlakeacad.org', 'Brian', 'Thompson', 'Westlake Academy', 'Science Teacher', 'educators', 'unsubscribed', 'a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001'),
('10000000-0000-0000-0000-000000000005', 'j.harrison@northsummit.edu', 'Jennifer', 'Harrison', 'North Summit School District', 'Assistant Superintendent', 'district_admin', 'bounced', 'a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002'),
('10000000-0000-0000-0000-000000000006', 'r.alvarez@horizonprep.org', 'Robert', 'Alvarez', 'Horizon Prep School', 'Academic Dean', 'high_school', 'active', 'a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (email) DO NOTHING;

-- 3. EMAIL TEMPLATES
INSERT INTO email_templates (id, name, subject_template, body_html, body_text, created_by) VALUES
('20000000-0000-0000-0000-000000000001', 'Fall 2026 Math Outreach - High School Leaders',
 'Partnering with TMAS Academy for STEM success at {{organization}}',
 '<p>Dear {{first_name}},</p><p>We hope this semester is going well at {{organization}}. As {{job_role}}, we wanted to reach out regarding TMAS Academy competitive math enrichment programs.</p><hr/><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
 'Dear {{first_name}},\n\nPartner with TMAS Academy.\n\nUnsubscribe: {{unsubscribe_url}}',
 '00000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000002', 'District STEM Leadership Introduction',
 'TMAS Academy curriculum partnerships for {{organization}}',
 '<p>Hello {{first_name}},</p><p>We work with district leaders to elevate STEM achievement through competition pathways.</p><hr/><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
 'Hello {{first_name}},\n\nElevate STEM achievement.\n\nUnsubscribe: {{unsubscribe_url}}',
 '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 4. CAMPAIGNS
INSERT INTO campaigns (id, name, template_id, target_audience_tag, status, batch_size, created_by, reviewed_by, reviewed_at, review_notes) VALUES
('30000000-0000-0000-0000-000000000001', 'Q4 High School Math Educator Outreach', '20000000-0000-0000-0000-000000000001', 'high_school', 'approved', 50, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', NOW(), 'Pre-approval checks satisfied; approved for batch sending.')
ON CONFLICT (id) DO NOTHING;

-- 5. ACTIVITY LOGS
INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, metadata) VALUES
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'campaign_created', 'campaign', '30000000-0000-0000-0000-000000000001', '{"name": "Q4 High School Math Educator Outreach"}'::jsonb),
('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'campaign_approved', 'campaign', '30000000-0000-0000-0000-000000000001', '{"notes": "Approved by Marketing Lead"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMIT;
