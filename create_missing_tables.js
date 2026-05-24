/**
 * Create missing HMS database tables
 * Run: node create_missing_tables.js
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.enlqpifpxuecxxozyiak',
  password: process.env.DB_PASSWORD || '@JIm47jhC_7%#',
  ssl: { rejectUnauthorized: false },
});

const tables = [
  // Expenses table for HMS
  `CREATE TABLE IF NOT EXISTS hms_expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR NOT NULL DEFAULT 'General',
    description TEXT DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    expense_date DATE DEFAULT CURRENT_DATE,
    payment_method VARCHAR DEFAULT 'Cash',
    vendor VARCHAR DEFAULT '',
    receipt_number VARCHAR DEFAULT '',
    recorded_by VARCHAR DEFAULT 'Admin',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Budget table
  `CREATE TABLE IF NOT EXISTS hms_budget (
    id SERIAL PRIMARY KEY,
    category VARCHAR NOT NULL,
    period VARCHAR NOT NULL,
    budget_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Insurance schemes
  `CREATE TABLE IF NOT EXISTS hms_insurance_schemes (
    id SERIAL PRIMARY KEY,
    scheme_name VARCHAR NOT NULL,
    scheme_type VARCHAR DEFAULT 'NHIF',
    provider VARCHAR DEFAULT '',
    contact_phone VARCHAR DEFAULT '',
    contact_email VARCHAR DEFAULT '',
    benefit_packages JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Insurance claims
  `CREATE TABLE IF NOT EXISTS hms_insurance_claims (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER,
    scheme_id INTEGER,
    encounter_id INTEGER,
    claim_amount NUMERIC DEFAULT 0,
    status VARCHAR DEFAULT 'Pending',
    diagnosis TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // SMS logs
  `CREATE TABLE IF NOT EXISTS hms_sms_logs (
    id SERIAL PRIMARY KEY,
    recipient_phone VARCHAR,
    recipient_name VARCHAR,
    message TEXT,
    message_type VARCHAR DEFAULT 'Custom',
    status VARCHAR DEFAULT 'Queued',
    sent_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // SMS templates
  `CREATE TABLE IF NOT EXISTS hms_sms_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR DEFAULT 'General',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Admission notes
  `CREATE TABLE IF NOT EXISTS hms_admission_notes (
    id SERIAL PRIMARY KEY,
    admission_id INTEGER,
    note_type VARCHAR DEFAULT 'Progress',
    note_text TEXT,
    created_by VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Investigation results (for lab)
  `CREATE TABLE IF NOT EXISTS hms_investigation_results (
    id SERIAL PRIMARY KEY,
    request_id INTEGER,
    param_name VARCHAR,
    value VARCHAR,
    unit VARCHAR DEFAULT '',
    reference_range VARCHAR DEFAULT '',
    flag VARCHAR DEFAULT '',
    entered_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Investigation test parameters
  `CREATE TABLE IF NOT EXISTS hms_investigation_test_params (
    id SERIAL PRIMARY KEY,
    test_id INTEGER,
    param_name VARCHAR NOT NULL,
    unit VARCHAR DEFAULT '',
    reference_range VARCHAR DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Prescriptions
  `CREATE TABLE IF NOT EXISTS hms_prescriptions (
    id SERIAL PRIMARY KEY,
    encounter_id INTEGER,
    drug_name VARCHAR,
    dosage VARCHAR,
    frequency VARCHAR,
    duration VARCHAR,
    instructions TEXT,
    status VARCHAR DEFAULT 'Pending',
    dispensed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Prescription items
  `CREATE TABLE IF NOT EXISTS hms_prescription_items (
    id SERIAL PRIMARY KEY,
    prescription_id INTEGER,
    drug_name VARCHAR,
    dosage VARCHAR,
    frequency VARCHAR,
    quantity INTEGER DEFAULT 0,
    dispensed_qty INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Formulary
  `CREATE TABLE IF NOT EXISTS hms_formulary (
    id SERIAL PRIMARY KEY,
    drug_name VARCHAR NOT NULL,
    generic_name VARCHAR,
    category VARCHAR DEFAULT 'General',
    dosage_form VARCHAR DEFAULT 'Tablet',
    strength VARCHAR DEFAULT '',
    unit_price NUMERIC DEFAULT 0,
    stock_qty INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Settings
  `CREATE TABLE IF NOT EXISTS hms_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR NOT NULL UNIQUE,
    setting_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

async function createTables() {
  console.log('🔧 Creating missing HMS tables...\n');

  for (const sql of tables) {
    const match = sql.match(/CREATE TABLE IF NOT EXISTS (\S+)/);
    const tableName = match ? match[1] : 'unknown';
    try {
      await pool.query(sql);
      console.log(`✅ ${tableName}`);
    } catch (err) {
      console.log(`⚠️  ${tableName}: ${err.message}`);
    }
  }

  // Seed default SMS templates
  try {
    const existing = await pool.query('SELECT COUNT(*) FROM hms_sms_templates');
    if (parseInt(existing.rows[0].count) === 0) {
      await pool.query(`INSERT INTO hms_sms_templates (name, body, category) VALUES
        ('Appointment Reminder', 'Dear {{patient_name}}, your appointment is on {{date}} at {{time}}. Please arrive 15 minutes early.', 'Appointment'),
        ('Lab Results Ready', 'Dear {{patient_name}}, your lab results are ready. Please visit the facility to collect them.', 'Lab'),
        ('Payment Receipt', 'Dear {{patient_name}}, payment of KES {{amount}} received. Receipt: {{receipt_no}}. Thank you.', 'Billing'),
        ('Follow-up Reminder', 'Dear {{patient_name}}, this is a reminder for your follow-up visit on {{date}}.', 'Follow-up')
      `);
      console.log('\n✅ Default SMS templates seeded');
    }
  } catch(e) { console.log('⚠️  SMS templates seed:', e.message); }

  // Seed default settings
  try {
    const existing = await pool.query('SELECT COUNT(*) FROM hms_settings');
    if (parseInt(existing.rows[0].count) === 0) {
      await pool.query(`INSERT INTO hms_settings (setting_key, setting_value) VALUES
        ('facility_name', 'Hospital Management System'),
        ('currency', 'KES'),
        ('timezone', 'Africa/Nairobi'),
        ('date_format', 'DD/MM/YYYY'),
        ('registration_fee', '500')
      `);
      console.log('✅ Default settings seeded');
    }
  } catch(e) { console.log('⚠️  Settings seed:', e.message); }

  console.log('\n🎉 Done!');
  await pool.end();
}

createTables();
