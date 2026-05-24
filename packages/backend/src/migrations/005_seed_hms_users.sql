-- ============================================================
-- Migration 005: Seed HMS Users
-- Run this in Supabase SQL Editor to create login accounts
-- Password for all users is: 1234
-- Bcrypt hash of "1234" with 10 rounds
-- ============================================================

-- Insert admin user (password: 1234)
INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
VALUES (
  'Administrator',
  'admin@hospital.test',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Insert doctor user (password: 1234)
INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
VALUES (
  'Dr. John Doe',
  'doctor@hospital.test',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO',
  'doctor',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Insert nurse user (password: 1234)
INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
VALUES (
  'Nurse Mary Jane',
  'nurse@hospital.test',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO',
  'nurse',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Insert pharmacist user (password: 1234)
INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
VALUES (
  'Pharmacist Paul Smith',
  'pharmacist@hospital.test',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO',
  'pharmacist',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Insert cashier user (password: 1234)
INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
VALUES (
  'Cashier Alice Brown',
  'cashier@hospital.test',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO',
  'cashier',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Verify the users were inserted
SELECT id, name, email, role, created_at FROM hms_users ORDER BY id;
