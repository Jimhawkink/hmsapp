-- ============================================================
-- Migration 001: HMS Clinical Tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- History of Present Illness
CREATE TABLE IF NOT EXISTS hms_hpi (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  onset TEXT,
  character TEXT,
  radiation TEXT,
  associated_symptoms TEXT,
  timing TEXT,
  exacerbating_factors TEXT,
  relieving_factors TEXT,
  narrative TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_hpi_encounter ON hms_hpi(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hms_hpi_patient ON hms_hpi(patient_id);

-- Structured Visit Forms (ANC, PNC, CWC, FP, HIV_TB)
CREATE TABLE IF NOT EXISTS hms_structured_visit_forms (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  form_type VARCHAR(50) NOT NULL CHECK (form_type IN ('ANC','PNC','CWC','FP','HIV_TB')),
  form_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_svf_encounter ON hms_structured_visit_forms(encounter_id);

-- Review of Systems
CREATE TABLE IF NOT EXISTS hms_review_of_systems (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  ros_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hms_ros_encounter ON hms_review_of_systems(encounter_id);

-- Medication History (patient-level, persists across encounters)
CREATE TABLE IF NOT EXISTS hms_medication_history (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  current_medications JSONB DEFAULT '[]',
  past_medical_history TEXT,
  surgical_history TEXT,
  family_history TEXT,
  social_history JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hms_medhistory_patient ON hms_medication_history(patient_id);

-- Allergies (patient-level)
CREATE TABLE IF NOT EXISTS hms_allergies (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id) ON DELETE CASCADE,
  allergen VARCHAR(255) NOT NULL,
  allergy_type VARCHAR(50) DEFAULT 'Drug' CHECK (allergy_type IN ('Drug','Food','Environmental','Other')),
  reaction_type VARCHAR(255),
  severity VARCHAR(50) DEFAULT 'Mild' CHECK (severity IN ('Mild','Moderate','Severe')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_allergies_patient ON hms_allergies(patient_id);

-- Physical Examination
CREATE TABLE IF NOT EXISTS hms_physical_examination (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  general_appearance TEXT,
  heent TEXT,
  neck TEXT,
  chest_lungs TEXT,
  heart TEXT,
  abdomen TEXT,
  extremities TEXT,
  neurological TEXT,
  skin TEXT,
  exam_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hms_exam_encounter ON hms_physical_examination(encounter_id);

-- Diagnoses (ICD-10)
CREATE TABLE IF NOT EXISTS hms_diagnoses (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  icd10_code VARCHAR(20) NOT NULL,
  icd10_description TEXT NOT NULL,
  diagnosis_type VARCHAR(20) DEFAULT 'Primary' CHECK (diagnosis_type IN ('Primary','Secondary')),
  clinical_notes TEXT,
  management_plan TEXT,
  follow_up_instructions TEXT,
  referral_type VARCHAR(50) DEFAULT 'None' CHECK (referral_type IN ('Internal','External','None')),
  referral_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_diagnoses_encounter ON hms_diagnoses(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hms_diagnoses_patient ON hms_diagnoses(patient_id);
CREATE INDEX IF NOT EXISTS idx_hms_diagnoses_icd10 ON hms_diagnoses(icd10_code);

-- Prescriptions (header)
CREATE TABLE IF NOT EXISTS hms_prescriptions (
  id SERIAL PRIMARY KEY,
  encounter_id INTEGER NOT NULL REFERENCES hms_encounters(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  prescriber_id INTEGER NOT NULL REFERENCES hms_staff(id),
  status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending','Dispensed','Cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_rx_encounter ON hms_prescriptions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hms_rx_patient ON hms_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_hms_rx_status ON hms_prescriptions(status);

-- Prescription Items
CREATE TABLE IF NOT EXISTS hms_prescription_items (
  id SERIAL PRIMARY KEY,
  prescription_id INTEGER NOT NULL REFERENCES hms_prescriptions(id) ON DELETE CASCADE,
  drug_name VARCHAR(255) NOT NULL,
  dose VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  route VARCHAR(100) DEFAULT 'Oral',
  instructions TEXT,
  quantity_prescribed INTEGER DEFAULT 1,
  stock_id UUID REFERENCES hms_stock(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_rx_items_prescription ON hms_prescription_items(prescription_id);

-- SMS Log (needed by messaging module)
CREATE TABLE IF NOT EXISTS hms_sms_log (
  id SERIAL PRIMARY KEY,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(255),
  patient_id INTEGER REFERENCES hms_patients(id),
  message_body TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'Custom',
  status VARCHAR(20) DEFAULT 'Sent' CHECK (status IN ('Sent','Delivered','Failed')),
  provider_message_id VARCHAR(255),
  error_reason TEXT,
  sent_by VARCHAR(255),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_sms_log_patient ON hms_sms_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_hms_sms_log_status ON hms_sms_log(status);
