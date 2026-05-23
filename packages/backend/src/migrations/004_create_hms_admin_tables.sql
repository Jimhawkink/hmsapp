-- ============================================================
-- Migration 004: HMS Admin, Budget, and Audit Tables
-- Run this in Supabase SQL Editor after 003
-- ============================================================

-- Audit Log
CREATE TABLE IF NOT EXISTS hms_audit_log (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','VIEW')),
  resource_name VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  user_id INTEGER,
  user_name VARCHAR(255),
  user_role VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_audit_log_user ON hms_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_hms_audit_log_resource ON hms_audit_log(resource_name);
CREATE INDEX IF NOT EXISTS idx_hms_audit_log_created ON hms_audit_log(created_at DESC);

-- Budget (expense budgets per category per period)
CREATE TABLE IF NOT EXISTS hms_budget (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  period VARCHAR(20) NOT NULL,  -- YYYY-MM format
  budget_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, period)
);

CREATE INDEX IF NOT EXISTS idx_hms_budget_period ON hms_budget(period);
CREATE INDEX IF NOT EXISTS idx_hms_budget_category ON hms_budget(category);

-- System Settings (key-value store for facility-wide config)
CREATE TABLE IF NOT EXISTS hms_system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type VARCHAR(50) DEFAULT 'text',
  description TEXT,
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default system settings
INSERT INTO hms_system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('facility_name', 'My Hospital', 'text', 'Facility display name'),
  ('kra_pin', '', 'text', 'KRA PIN for receipts'),
  ('default_currency', 'KES', 'text', 'Default currency code'),
  ('sms_sender_id', 'HOSPITAL', 'text', 'Africa''s Talking SMS sender ID'),
  ('mpesa_shortcode', '', 'text', 'M-Pesa business shortcode'),
  ('mpesa_till', '', 'text', 'M-Pesa till number'),
  ('at_api_key', '', 'text', 'Africa''s Talking API key'),
  ('at_username', '', 'text', 'Africa''s Talking username'),
  ('lab_result_notify_hours', '2', 'number', 'Hours after which pending lab results trigger alert')
ON CONFLICT (setting_key) DO NOTHING;
