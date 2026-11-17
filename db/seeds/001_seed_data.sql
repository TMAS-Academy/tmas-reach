-- Seed: 001_seed_data.sql
-- Description: Clean system initialization for TMAS Reach platform.
-- Note: Contact records start empty and are populated via educator survey intake or CSV import.

BEGIN;

-- 1. SYSTEM USERS
INSERT INTO users (id, email, full_name, role, is_active) VALUES
('00000000-0000-0000-0000-000000000001', 'intern@tmasacademy.org', 'TMAS Outreach Intern', 'marketing_intern', true),
('00000000-0000-0000-0000-000000000002', 'lead@tmasacademy.org', 'TMAS Outreach Lead', 'marketing_lead', true),
('00000000-0000-0000-0000-000000000003', 'admin@tmasacademy.org', 'TMAS Administrator', 'administrator', true)
ON CONFLICT (email) DO NOTHING;

-- 2. INITIAL REUSABLE EMAIL TEMPLATES
INSERT INTO email_templates (id, name, subject_template, body_html, body_text, created_by) VALUES
('20000000-0000-0000-0000-000000000001', 'STEM Outreach - Mathematics Enrichment Workshop',
 'Partnering with TMAS Academy for STEM enrichment at {{organization}}',
 '<p>Dear {{first_name}},</p><p>We are reaching out to explore math enrichment and competition opportunities for students at {{organization}}.</p><p>Best regards,<br>TMAS Academy Outreach</p><hr/><p style="font-size: 12px; color: #666;">If you no longer wish to receive outreach communications, you may <a href="{{unsubscribe_url}}">unsubscribe here</a>.</p>',
 'Dear {{first_name}},\n\nWe are reaching out to explore math enrichment and competition opportunities for students at {{organization}}.\n\nBest regards,\nTMAS Academy Outreach\n\n---\nUnsubscribe: {{unsubscribe_url}}',
 '00000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000002', 'District Administrator Introduction',
 'TMAS Academy curriculum partnerships for {{organization}}',
 '<p>Hello {{first_name}},</p><p>We collaborate with district coordinators to support extracurricular STEM pathways.</p><hr/><p style="font-size: 12px; color: #666;"><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
 'Hello {{first_name}},\n\nWe collaborate with district coordinators to support extracurricular STEM pathways.\n\nUnsubscribe: {{unsubscribe_url}}',
 '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 3. ACTIVITY LOGS
INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, metadata) VALUES
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'system_initialized', 'system', NULL, '{"version": "1.0.0"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

COMMIT;
