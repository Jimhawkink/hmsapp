/**
 * Seed script: Create admin user in hms_users table
 * Run: node seed_admin_user.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.enlqpifpxuecxxozyiak',
  password: process.env.DB_PASSWORD || '@JIm47jhC_7%#',
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  try {
    // 1. Ensure hms_users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hms_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        email VARCHAR NOT NULL UNIQUE,
        password VARCHAR NOT NULL,
        role VARCHAR DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ hms_users table ready');

    // 2. Check if admin user already exists
    const existing = await pool.query(
      `SELECT id, email FROM hms_users WHERE LOWER(email) = LOWER($1)`,
      ['admin@hospital.test']
    );

    if (existing.rows.length > 0) {
      // Update the password to '1234' (hashed)
      const hash = await bcrypt.hash('1234', 10);
      await pool.query(
        `UPDATE hms_users SET password = $1, updated_at = NOW() WHERE LOWER(email) = LOWER($2)`,
        [hash, 'admin@hospital.test']
      );
      console.log('✅ Admin user password reset to "1234"');
      console.log('   User ID:', existing.rows[0].id);
    } else {
      // Insert new admin user
      const hash = await bcrypt.hash('1234', 10);
      const result = await pool.query(
        `INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, name, email, role`,
        ['Admin', 'admin@hospital.test', hash, 'admin']
      );
      console.log('✅ Admin user created:', result.rows[0]);
    }

    // 3. Ensure admin role exists in hms_user_roles (for permissions)
    try {
      const roleExists = await pool.query(
        `SELECT id FROM hms_user_roles WHERE LOWER(role_name) = 'admin' AND is_active = true LIMIT 1`
      );
      if (roleExists.rows.length === 0) {
        await pool.query(
          `INSERT INTO hms_user_roles (role_name, is_active, created_at, updated_at)
           VALUES ('admin', true, NOW(), NOW())
           ON CONFLICT DO NOTHING`
        );
        console.log('✅ Admin role created in hms_user_roles');
      } else {
        console.log('✅ Admin role already exists in hms_user_roles');
      }
    } catch (e) {
      console.log('ℹ️  hms_user_roles table may not exist yet (non-critical):', e.message);
    }

    // 4. Verify login would work
    const verify = await pool.query(
      `SELECT id, name, email, password, role FROM hms_users WHERE LOWER(email) = LOWER($1)`,
      ['admin@hospital.test']
    );
    if (verify.rows.length > 0) {
      const match = await bcrypt.compare('1234', verify.rows[0].password);
      console.log('\n🔑 Login verification:');
      console.log('   Email: admin@hospital.test');
      console.log('   Password: 1234');
      console.log('   Password match:', match ? '✅ YES' : '❌ NO');
      console.log('   Role:', verify.rows[0].role);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
