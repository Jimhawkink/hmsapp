-- ============================================================
-- Migration 002: HMS Ward / IPD Tables
-- Run this in Supabase SQL Editor after 001
-- ============================================================

-- Wards
CREATE TABLE IF NOT EXISTS hms_wards (
  id SERIAL PRIMARY KEY,
  ward_name VARCHAR(100) NOT NULL,
  ward_type VARCHAR(50) NOT NULL CHECK (ward_type IN ('Medical','Surgical','Maternity','Pediatric','ICU','General')),
  total_beds INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beds
CREATE TABLE IF NOT EXISTS hms_beds (
  id SERIAL PRIMARY KEY,
  ward_id INTEGER NOT NULL REFERENCES hms_wards(id) ON DELETE CASCADE,
  bed_number VARCHAR(20) NOT NULL,
  status VARCHAR(30) DEFAULT 'Vacant' CHECK (status IN ('Vacant','Occupied','Reserved','Maintenance')),
  current_admission_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ward_id, bed_number)
);

CREATE INDEX IF NOT EXISTS idx_hms_beds_ward ON hms_beds(ward_id);
CREATE INDEX IF NOT EXISTS idx_hms_beds_status ON hms_beds(status);

-- Admissions
CREATE TABLE IF NOT EXISTS hms_admissions (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  encounter_id INTEGER REFERENCES hms_encounters(id),
  ward_id INTEGER NOT NULL REFERENCES hms_wards(id),
  bed_id INTEGER NOT NULL REFERENCES hms_beds(id),
  admitting_clinician_id INTEGER NOT NULL REFERENCES hms_staff(id),
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admitting_diagnosis TEXT,
  discharge_date TIMESTAMPTZ,
  discharge_diagnosis TEXT,
  discharge_summary TEXT,
  discharge_medications JSONB DEFAULT '[]',
  status VARCHAR(30) DEFAULT 'Admitted' CHECK (status IN ('Admitted','Discharged','Transferred')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_admissions_patient ON hms_admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_hms_admissions_ward ON hms_admissions(ward_id);
CREATE INDEX IF NOT EXISTS idx_hms_admissions_bed ON hms_admissions(bed_id);
CREATE INDEX IF NOT EXISTS idx_hms_admissions_status ON hms_admissions(status);

-- Ward Notes
CREATE TABLE IF NOT EXISTS hms_ward_notes (
  id SERIAL PRIMARY KEY,
  admission_id INTEGER NOT NULL REFERENCES hms_admissions(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES hms_patients(id),
  clinician_id INTEGER REFERENCES hms_staff(id),
  clinician_name VARCHAR(255),
  note_type VARCHAR(50) DEFAULT 'Ward Round' CHECK (note_type IN ('Ward Round','Nursing','Progress','Discharge')),
  observations TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hms_ward_notes_admission ON hms_ward_notes(admission_id);
CREATE INDEX IF NOT EXISTS idx_hms_ward_notes_patient ON hms_ward_notes(patient_id);
