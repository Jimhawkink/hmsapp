-- ============================================================
-- Migration 003: HMS Insurance / SHA / NHIF Tables
-- Run this in Supabase SQL Editor after 002
-- ============================================================

-- Insurance Schemes (SHA, NHIF, Private)
CREATE TABLE IF NOT EXISTS hms_insurance_schemes (
  id SERIAL PRIMARY KEY,
  scheme_name VARCHAR(100) NOT NULL,
  scheme_code VARCHAR(50),
  benefit_packages JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default schemes
INSERT INTO hms_insurance_schemes (scheme_name, scheme_code, benefit_packages) VALUES
  ('Social Health Authority (SHA)', 'SHA', '[{"service":"Outpatient Consultation","limit":500},{"service":"Inpatient","limit":15000},{"service":"Maternity","limit":10000},{"service":"Surgery","limit":50000},{"service":"Laboratory","limit":3000},{"service":"Radiology","limit":5000},{"service":"Pharmacy","limit":2000}]'),
  ('NHIF', 'NHIF', '[{"service":"Outpatient Consultation","limit":1000},{"service":"Inpatient","limit":20000},{"service":"Maternity","limit":15000},{"service":"Surgery","limit":100000}]'),
  ('Private Insurance', 'PRIVATE', '[{"service":"All Services","limit":500000}]'),
  ('Cash / Self Pay', 'CASH', '[]')
ON CONFLICT DO NOTHING;

-- Patient Insurance Records
CREATE TABLE IF NOT EXISTS hms_patient_insurance (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  scheme_id INTEGER REFERENCES hms_insurance_schemes(id),
  sha_number VARCHAR(100),
  nhif_number VARCHAR(100),
  member_number VARCHAR(100),
  policy_number VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_patient_insurance_patient ON hms_patient_insurance(patient_id);

-- Claims
CREATE TABLE IF NOT EXISTS hms_claims (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id),
  scheme_id INTEGER NOT NULL REFERENCES hms_insurance_schemes(id),
  claim_number VARCHAR(100) UNIQUE,
  claimed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  approved_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','Approved','Rejected','Paid')),
  submission_date TIMESTAMPTZ,
  payment_date TIMESTAMPTZ,
  rejection_reason TEXT,
  pre_auth_number VARCHAR(100),
  pre_auth_procedure VARCHAR(255),
  pre_auth_amount NUMERIC(12,2),
  pre_auth_validity DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_claims_patient ON hms_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_hms_claims_encounter ON hms_claims(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hms_claims_status ON hms_claims(status);

-- Claim Items
CREATE TABLE IF NOT EXISTS hms_claim_items (
  id SERIAL PRIMARY KEY,
  claim_id INTEGER NOT NULL REFERENCES hms_claims(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  service_code VARCHAR(50),
  quantity INTEGER DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  claimed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_claim_items_claim ON hms_claim_items(claim_id);
