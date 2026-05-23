import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const pool = new Pool({
  host: process.env.DB_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres.enlqpifpxuecxxozyiak',
  password: process.env.DB_PASSWORD || '@JIm47jhC_7%#',
  ssl: { rejectUnauthorized: false },
  max: 3,
  connectionTimeoutMillis: 10000,
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// M-Pesa (Daraja) config (supports multiple env naming styles)
const MPESA_CONSUMER_KEY = firstEnv('MPESA_CONSUMER_KEY', 'DARAJA_CONSUMER_KEY');
const MPESA_CONSUMER_SECRET = firstEnv('MPESA_CONSUMER_SECRET', 'DARAJA_CONSUMER_SECRET');
const MPESA_SHORTCODE = firstEnv('MPESA_SHORTCODE', 'MPESA_BUSINESS_SHORTCODE', 'BUSINESS_SHORT_CODE');
const MPESA_TILL_NUMBER = firstEnv('MPESA_TILL_NUMBER', 'MPESA_TILL');
const MPESA_PASSKEY = firstEnv('MPESA_PASSKEY', 'DARAJA_PASSKEY');
const MPESA_CALLBACK_URL = firstEnv('MPESA_CALLBACK_URL') || 'https://hms-monorepo.vercel.app/api/mpesa/callback';
const MPESA_ENV = (firstEnv('MPESA_ENV', 'DARAJA_ENV') || 'sandbox').toLowerCase();
const MPESA_BASE_URL = MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

// Determine if we're using Till or Paybill
// For BOTH Till and Paybill: BusinessShortCode = Shortcode (Daraja-registered org code)
// Till: PartyB = Till Number, TransactionType = CustomerBuyGoodsOnline
// Paybill: PartyB = Shortcode, TransactionType = CustomerPayBillOnline
const MPESA_IS_TILL = !!MPESA_TILL_NUMBER;
const MPESA_TRANSACTION_TYPE = MPESA_IS_TILL ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
const MPESA_PARTY_B = MPESA_IS_TILL ? MPESA_TILL_NUMBER : MPESA_SHORTCODE;

function normalizePhone(phone: string): string {
  const raw = String(phone || '').replace(/[^\d]/g, '');
  if (raw.startsWith('254') && raw.length === 12) return raw;
  if (raw.startsWith('0') && raw.length === 10) return `254${raw.slice(1)}`;
  if (raw.length === 9 && raw.startsWith('7')) return `254${raw}`;
  return raw;
}

async function getMpesaAccessToken(): Promise<string> {
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
    throw new Error('M-Pesa credentials missing. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.');
  }
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const resp = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await resp.json() as any;
  if (!resp.ok || !data?.access_token) {
    throw new Error(data?.errorMessage || 'Failed to get M-Pesa access token');
  }
  return data.access_token as string;
}

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim().length > 0) return String(value).trim();
  }
  return '';
}

const EMAIL_USER = firstEnv('EMAIL_USER', 'SMTP_USER', 'MAIL_USER', 'SMTP_USERNAME');
const EMAIL_PASS = firstEnv('EMAIL_PASS', 'SMTP_PASS', 'MAIL_PASS', 'EMAIL_PASSWORD', 'SMTP_PASSWORD');
const EMAIL_HOST = firstEnv('EMAIL_HOST', 'SMTP_HOST', 'MAIL_HOST') || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(firstEnv('EMAIL_PORT', 'SMTP_PORT', 'MAIL_PORT') || '587', 10);
const EMAIL_FROM = firstEnv('EMAIL_FROM', 'SMTP_FROM') || EMAIL_USER;

const mailer = (EMAIL_USER && EMAIL_PASS)
  ? nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      tls: { rejectUnauthorized: false },
    })
  : null;

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

async function sendStaffOtp(email: string) {
  if (!mailer || !EMAIL_USER) {
    throw new Error(
      'SMTP not configured. Set EMAIL_USER/EMAIL_PASS (or SMTP_USER/SMTP_PASS) plus EMAIL_HOST/EMAIL_PORT.'
    );
  }
  const otp = generateOtp();
  otpStore.set(email.toLowerCase(), { otp, expiresAt: Date.now() + OTP_EXPIRY_MS });

  await mailer.sendMail({
    from: `"Hospital Management System" <${EMAIL_FROM}>`,
    to: email,
    subject: "Your OTP for Staff Registration",
    html: `<p>Hello,</p><p>Your OTP is:</p><h2 style="letter-spacing:4px">${otp}</h2><p>This code expires in 5 minutes.</p>`,
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
  });
}

function verifyStaffOtp(email: string, otp: string): boolean {
  const key = (email || "").toLowerCase();
  const rec = otpStore.get(key);
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  const ok = rec.otp === String(otp || "").trim();
  if (ok) otpStore.delete(key);
  return ok;
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function verifyToken(req: VercelRequest): any {
  try {
    const auth = req.headers.authorization;
    if (!auth) return null;
    return jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
  } catch { return null; }
}

// Convert snake_case DB columns to camelCase for frontend (keeps both)
function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}
function tx(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const r: any = {};
  for (const k of Object.keys(row)) {
    r[k] = row[k];
    const c = toCamel(k);
    if (c !== k) r[c] = row[k];
  }
  return r;
}
function txAll(rows: any[]): any[] { return rows.map(tx); }

export default async (req: VercelRequest, res: VercelResponse) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = (req.url || '').replace(/\?.*$/, '');
  const path = url.startsWith('/api') ? url.slice(4) : url;
  const segments = path.split('/').filter(Boolean);
  const method = req.method || 'GET';

  console.log(`⚡ ${method} ${url} -> [${segments.join(', ')}]`);

  try {
    // ========== DASHBOARD STATS ==========
    if (segments[0] === 'dashboard-stats' && method === 'GET') {
      // Helper: safe query that returns default on error
      const sq = async (sql: string, def: any = []) => {
        try { return (await pool.query(sql)).rows; } catch(e: any) { console.warn('Stats query fail:', e.message); return def; }
      };
      const s1 = async (sql: string, field: string, def: any = 0) => {
        try { const r = (await pool.query(sql)).rows; return r[0]?.[field] ?? def; } catch { return def; }
      };

      const totalPatients = parseInt(await s1(`SELECT COUNT(*) as c FROM hms_patients`, 'c', '0'));
      const newPatientsThisMonth = parseInt(await s1(`SELECT COUNT(*) as c FROM hms_patients WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`, 'c', '0'));
      const totalEncounters = parseInt(await s1(`SELECT COUNT(*) as c FROM hms_encounters`, 'c', '0'));
      const encountersThisMonth = parseInt(await s1(`SELECT COUNT(*) as c FROM hms_encounters WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`, 'c', '0'));
      const totalAppointments = parseInt(await s1(`SELECT COUNT(*) as c FROM hms_appointments`, 'c', '0'));
      const appointmentsToday = parseInt(await s1(`SELECT COUNT(*) as c FROM hms_appointments WHERE appointment_date::date = CURRENT_DATE`, 'c', '0'));
      const totalRevenue = parseFloat(await s1(`SELECT COALESCE(SUM(amount),0) as s FROM hms_payments`, 's', '0'));
      const revenueThisMonth = parseFloat(await s1(`SELECT COALESCE(SUM(amount),0) as s FROM hms_payments WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)`, 's', '0'));

      // Gender
      let genderBreakdown = { male: 0, female: 0, other: 0 };
      try {
        const gR = await pool.query(`SELECT 
          COALESCE(SUM(CASE WHEN LOWER(gender) IN ('male','m') THEN 1 ELSE 0 END),0) as male,
          COALESCE(SUM(CASE WHEN LOWER(gender) IN ('female','f') THEN 1 ELSE 0 END),0) as female,
          COALESCE(SUM(CASE WHEN LOWER(gender) NOT IN ('male','m','female','f') THEN 1 ELSE 0 END),0) as other
          FROM hms_patients`);
        genderBreakdown = { male: parseInt(gR.rows[0].male), female: parseInt(gR.rows[0].female), other: parseInt(gR.rows[0].other) };
      } catch {}

      // Age groups
      let ageGroups: any[] = [];
      try {
        const ageR = await pool.query(`SELECT 
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 5 THEN '00-04'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 10 THEN '05-09'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 15 THEN '10-14'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 20 THEN '15-19'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 25 THEN '20-24'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 30 THEN '25-29'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 35 THEN '30-34'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 40 THEN '35-39'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 45 THEN '40-44'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 50 THEN '45-49'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 55 THEN '50-54'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 60 THEN '55-59'
            WHEN EXTRACT(YEAR FROM AGE(dob)) < 65 THEN '60-64'
            ELSE '65+'
          END as age_group,
          COALESCE(SUM(CASE WHEN LOWER(gender) IN ('male','m') THEN 1 ELSE 0 END),0) as male,
          COALESCE(SUM(CASE WHEN LOWER(gender) IN ('female','f') THEN 1 ELSE 0 END),0) as female
          FROM hms_patients WHERE dob IS NOT NULL GROUP BY age_group ORDER BY age_group`);
        ageGroups = ageR.rows.map((r: any) => ({ label: r.age_group, male: parseInt(r.male), female: parseInt(r.female) }));
      } catch {}

      // Encounter types
      let encountersByType: any[] = [];
      try {
        const etR = await pool.query(`SELECT COALESCE(encounter_type,'Consultation') as type, COUNT(*) as c FROM hms_encounters GROUP BY encounter_type ORDER BY c DESC LIMIT 5`);
        encountersByType = etR.rows.map((r: any) => ({ type: r.type, count: parseInt(r.c) }));
      } catch {}

      // Encounters by hour
      let encountersByHour: any[] = [];
      try {
        const ehR = await pool.query(`SELECT EXTRACT(HOUR FROM created_at)::int as hr, COUNT(*)::int as c FROM hms_encounters GROUP BY hr ORDER BY hr`);
        encountersByHour = ehR.rows.map((r: any) => ({ hour: parseInt(r.hr), count: parseInt(r.c) }));
      } catch {}

      // Monthly trend
      let monthlyTrend: any[] = [];
      try {
        const mtR = await pool.query(`SELECT TO_CHAR(m, 'Mon YYYY') as month,
          (SELECT COUNT(*) FROM hms_encounters WHERE created_at >= m AND created_at < m + interval '1 month') as encounters,
          (SELECT COUNT(*) FROM hms_patients WHERE created_at >= m AND created_at < m + interval '1 month') as patients
          FROM generate_series(DATE_TRUNC('month', CURRENT_DATE) - interval '11 months', DATE_TRUNC('month', CURRENT_DATE), '1 month') as m ORDER BY m`);
        monthlyTrend = mtR.rows.map((r: any) => ({ month: r.month, encounters: parseInt(r.encounters), patients: parseInt(r.patients) }));
      } catch {}

      // Top diagnoses
      let topDiagnoses: any[] = [];
      try {
        const tdR = await pool.query(`SELECT complaint_text as name, COUNT(*) as c FROM hms_complaints GROUP BY complaint_text ORDER BY c DESC LIMIT 10`);
        topDiagnoses = tdR.rows.map((r: any) => ({ name: r.name, count: parseInt(r.c) }));
      } catch {}

      // Top investigations
      let topInvestigations: any[] = [];
      try {
        const tiR = await pool.query(`SELECT test_name as name, COUNT(*) as c FROM hms_investigation_requests GROUP BY test_name ORDER BY c DESC LIMIT 10`);
        topInvestigations = tiR.rows.map((r: any) => ({ name: r.name, count: parseInt(r.c) }));
      } catch {}

      // Top products
      let topProducts: any[] = [];
      try {
        const tpR = await pool.query(`SELECT product_name as name, COALESCE(SUM(quantity),0)::int as qty, COALESCE(SUM(subtotal),0)::numeric as rev FROM hms_pos_sale_items GROUP BY product_name ORDER BY rev DESC LIMIT 10`);
        topProducts = tpR.rows.map((r: any) => ({ name: r.name, qty: parseInt(r.qty), revenue: parseFloat(r.rev) }));
      } catch {}

      // Encounters by provider
      let encountersByProvider: any[] = [];
      try {
        const epR = await pool.query(`SELECT 
          COALESCE(s.first_name || ' ' || s.last_name, 'Unknown') as name,
          COUNT(*) as arrived, 0 as cancelled
          FROM hms_encounters e LEFT JOIN hms_staff s ON e.provider_id = s.id
          GROUP BY s.first_name, s.last_name ORDER BY arrived DESC LIMIT 7`);
        encountersByProvider = epR.rows.map((r: any) => ({ name: r.name || 'Unknown', arrived: parseInt(r.arrived), cancelled: parseInt(r.cancelled) }));
      } catch {}

      // Repeat vs single
      let repeatVsSingle = { repeat: 0, single: 0 };
      try {
        const rsR = await pool.query(`SELECT 
          COALESCE(SUM(CASE WHEN enc_count > 1 THEN 1 ELSE 0 END),0) as "repeat",
          COALESCE(SUM(CASE WHEN enc_count = 1 THEN 1 ELSE 0 END),0) as single
          FROM (SELECT patient_id, COUNT(*) as enc_count FROM hms_encounters GROUP BY patient_id) sub`);
        repeatVsSingle = { repeat: parseInt(rsR.rows[0]?.repeat || 0), single: parseInt(rsR.rows[0]?.single || 0) };
      } catch {}

      // Recent patients
      let recentPatients: any[] = [];
      try {
        const rpR = await pool.query(`SELECT id, first_name, last_name, gender, phone, TO_CHAR(created_at, 'DD Mon YYYY') as date FROM hms_patients ORDER BY created_at DESC LIMIT 10`);
        recentPatients = rpR.rows.map((r: any) => ({ id: r.id, name: `${r.first_name || ''} ${r.last_name || ''}`.trim(), gender: r.gender, phone: r.phone, date: r.date }));
      } catch {}

      return res.json({
        totalPatients, newPatientsThisMonth, totalEncounters, encountersThisMonth,
        totalAppointments, appointmentsToday, totalRevenue, revenueThisMonth,
        genderBreakdown, ageGroups, encountersByType, encountersByHour,
        monthlyTrend, topDiagnoses, topInvestigations, topProducts,
        encountersByProvider, repeatVsSingle, recentPatients
      });
    }

    // ========== AUTH ==========
    if (segments[0] === 'auth-v2') {
      if (segments[1] === 'login' && method === 'POST') {
        const { email, password } = req.body || {};
        if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
        const result = await pool.query(
          `SELECT u.id, u.name, u.email, u.password, u.role,
                  s.id as staff_id, s.active_status, s.first_name, s.last_name, s.job_title
           FROM hms_users u
           LEFT JOIN hms_staff s ON LOWER(s.email) = LOWER(u.email)
           WHERE LOWER(u.email) = LOWER($1)
           LIMIT 1`,
          [email]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = result.rows[0];
        if (user.staff_id && user.active_status === false) {
          return res.status(403).json({ message: 'Account is inactive. Contact administrator.' });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });

        const roleRes = await pool.query(
          'SELECT id, role_name FROM hms_user_roles WHERE LOWER(role_name) = LOWER($1) AND is_active = true LIMIT 1',
          [user.role]
        );
        let permissions: any[] = [];
        if (roleRes.rows.length > 0) {
          const roleId = roleRes.rows[0].id;
          const permRes = await pool.query(
            `SELECT p.permission_key, p.permission_name, rp.can_create, rp.can_edit, rp.can_view, rp.can_archive
             FROM hms_role_permissions rp
             JOIN hms_permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = $1`,
            [roleId]
          );
          permissions = permRes.rows;
        }

        const tokenPayload = {
          id: user.id,
          role: user.role,
          name: user.name,
          email: user.email,
          staffId: user.staff_id || null,
          activeStatus: user.staff_id ? user.active_status !== false : true,
        };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
        return res.json({
          token,
          user: {
            id: user.id,
            name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' ').trim(),
            email: user.email,
            role: user.role,
            staffId: user.staff_id || null,
            activeStatus: user.staff_id ? user.active_status !== false : true,
            permissions,
          }
        });
      }
      if (segments[1] === 'me' && method === 'GET') {
        const decoded = verifyToken(req);
        if (!decoded) return res.status(401).json({ message: 'Invalid token' });
        const result = await pool.query('SELECT id, name, email, role FROM hms_users WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        return res.json({ user: result.rows[0] });
      }
      return res.status(404).json({ message: 'Auth route not found' });
    }

    // ========== M-PESA ==========
    if (segments[0] === 'mpesa') {
      // Ensure hospital-specific mpesa_transactions table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hms_mpesa_transactions (
          id SERIAL PRIMARY KEY,
          checkout_request_id VARCHAR UNIQUE,
          merchant_request_id VARCHAR,
          phone_number VARCHAR,
          amount NUMERIC DEFAULT 0,
          account_reference VARCHAR,
          transaction_desc VARCHAR,
          mpesa_receipt_number VARCHAR,
          result_code INTEGER,
          result_desc TEXT,
          status VARCHAR DEFAULT 'Pending',
          inv_id INTEGER,
          invoice_no VARCHAR,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      if (segments[1] === 'register' && method === 'POST') {
        const b = req.body || {};
        const phone = normalizePhone(String(b.phone || ''));
        const amount = Number(b.amount || 0);
        const accountReference = String(b.accountReference || 'HMS_REG').slice(0, 20);
        const transactionDesc = String(b.transactionDesc || 'Patient Registration Fee').slice(0, 30);

        if (!phone || !/^254\d{9}$/.test(phone)) {
          return res.status(400).json({ message: 'Valid Kenyan phone is required (2547XXXXXXXX).' });
        }
        if (!amount || amount < 1) {
          return res.status(400).json({ message: 'Valid amount is required.' });
        }
        if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
          return res.status(500).json({ message: 'M-Pesa not configured. Set MPESA_SHORTCODE and MPESA_PASSKEY.' });
        }

        const token = await getMpesaAccessToken();
        const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
        const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

        const stkPayload: Record<string, any> = {
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: MPESA_TRANSACTION_TYPE,
          Amount: Math.round(amount),
          PartyA: phone,
          PartyB: MPESA_PARTY_B,
          PhoneNumber: phone,
          CallBackURL: MPESA_CALLBACK_URL,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc,
        };

        console.log('[MPESA STK] Sending:', JSON.stringify({
          BusinessShortCode: stkPayload.BusinessShortCode,
          TransactionType: stkPayload.TransactionType,
          Amount: stkPayload.Amount,
          PartyA: stkPayload.PartyA,
          PartyB: stkPayload.PartyB,
          env: MPESA_ENV,
          isTill: MPESA_IS_TILL,
        }));

        const stkResp = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(stkPayload),
        });
        const stkData = await stkResp.json() as any;
        console.log('[MPESA STK] Response:', JSON.stringify(stkData));

        if (!stkResp.ok || stkData?.errorCode || stkData?.ResponseCode === '1' || stkData?.ResponseCode === '2') {
          const errMsg = stkData?.errorMessage || stkData?.ResponseDescription || stkData?.resultDesc || 'Failed to initiate STK push';
          return res.status(500).json({
            message: errMsg,
            errorCode: stkData?.errorCode || stkData?.ResponseCode,
            requestId: stkData?.CheckoutRequestID || stkData?.MerchantRequestID,
          });
        }

        const checkoutRequestId = String(stkData.CheckoutRequestID || '');
        const merchantRequestId = String(stkData.MerchantRequestID || '');

        if (checkoutRequestId) {
          await pool.query(
            `INSERT INTO hms_mpesa_transactions
             (checkout_request_id, merchant_request_id, phone_number, amount, account_reference, transaction_desc, status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
             ON CONFLICT (checkout_request_id)
             DO UPDATE SET updated_at=NOW()`,
            [checkoutRequestId, merchantRequestId, phone, amount, accountReference, transactionDesc, 'Pending']
          );
        }

        return res.json({
          message: 'STK push sent successfully',
          checkoutRequestId,
          merchantRequestId,
        });
      }

      if (segments[1] === 'status' && method === 'GET') {
        const checkoutRequestId = String(req.query?.checkoutRequestId || req.query?.checkout_request_id || '');
        if (!checkoutRequestId) return res.status(400).json({ message: 'checkoutRequestId is required' });
        const txr = await pool.query(
          `SELECT * FROM hms_mpesa_transactions WHERE checkout_request_id=$1 ORDER BY created_at DESC LIMIT 1`,
          [checkoutRequestId]
        );
        if (txr.rows.length === 0) return res.status(404).json({ message: 'Transaction not found' });
        const tx = txr.rows[0];
        const rc = tx.result_code; // null when callback hasn't arrived yet
        const status = tx.status || 'Pending';
        const isPending = status === 'Pending' && (rc === null || rc === undefined);
        console.log(`[MPESA STATUS] checkoutRequestId=${checkoutRequestId}, status=${status}, result_code=${rc}, isPending=${isPending}`);
        return res.json({
          status,
          resultCode: rc === null || rc === undefined ? null : Number(rc),
          resultDesc: tx.result_desc || null,
          mpesaReceipt: tx.mpesa_receipt_number || null,
          amount: tx.amount,
          phone: tx.phone_number,
          success: status === 'Completed' || rc === 0,
          isPending,
        });
      }

      if (segments[1] === 'callback' && method === 'POST') {
        const body = req.body || {};
        const callback = body?.Body?.stkCallback;
        if (!callback) return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        const resultCode = Number(callback.ResultCode ?? -1);
        const resultDesc = String(callback.ResultDesc || '');
        const checkoutRequestId = String(callback.CheckoutRequestID || '');
        const merchantRequestId = String(callback.MerchantRequestID || '');
        const items = callback?.CallbackMetadata?.Item || [];
        const getItem = (name: string) => {
          const m = items.find((i: any) => i?.Name === name);
          return m?.Value;
        };
        const receipt = String(getItem('MpesaReceiptNumber') || '');
        const amount = Number(getItem('Amount') || 0);
        const phone = String(getItem('PhoneNumber') || '');
        const status = resultCode === 0 ? 'Completed'
          : resultCode === 1032 ? 'Cancelled'
          : resultCode === 1001 ? 'Failed'  // Wrong PIN
          : resultCode === 1025 ? 'Failed'  // Insufficient balance
          : resultCode === 1037 ? 'Failed'  // Timeout / DS timeout
          : resultCode === 2001 ? 'Failed'  // Invalid PIN
          : resultCode === 1 ? 'Failed'     // Generic failure
          : 'Failed';

        if (checkoutRequestId) {
          console.log(`[MPESA CALLBACK] checkoutRequestId=${checkoutRequestId}, resultCode=${resultCode}, status=${status}, receipt=${receipt}, amount=${amount}`);
          await pool.query(
            `INSERT INTO hms_mpesa_transactions
             (checkout_request_id, merchant_request_id, phone_number, amount, mpesa_receipt_number, result_code, result_desc, status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
             ON CONFLICT (checkout_request_id)
             DO UPDATE SET
               merchant_request_id=EXCLUDED.merchant_request_id,
               phone_number=COALESCE(EXCLUDED.phone_number, hms_mpesa_transactions.phone_number),
               amount=CASE WHEN EXCLUDED.amount > 0 THEN EXCLUDED.amount ELSE hms_mpesa_transactions.amount END,
               mpesa_receipt_number=COALESCE(EXCLUDED.mpesa_receipt_number, hms_mpesa_transactions.mpesa_receipt_number),
               result_code=EXCLUDED.result_code,
               result_desc=EXCLUDED.result_desc,
               status=EXCLUDED.status,
               updated_at=NOW()`,
            [checkoutRequestId, merchantRequestId, phone, amount, receipt || null, resultCode, resultDesc, status]
          );
        }

        return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
      }
    }

    // ========== PAYMENTS ==========
    if (segments[0] === 'payments') {
      // Ensure settings table exists for registration fee
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hms_settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR UNIQUE NOT NULL,
          value TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      // Ensure hms_mpesa_transactions table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS hms_mpesa_transactions (
          id SERIAL PRIMARY KEY,
          checkout_request_id VARCHAR UNIQUE,
          merchant_request_id VARCHAR,
          phone_number VARCHAR,
          amount NUMERIC DEFAULT 0,
          account_reference VARCHAR,
          transaction_desc VARCHAR,
          mpesa_receipt_number VARCHAR,
          result_code INTEGER,
          result_desc TEXT,
          status VARCHAR DEFAULT 'Pending',
          inv_id INTEGER,
          invoice_no VARCHAR,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // GET /payments/registration-fee
      if (segments[1] === 'registration-fee' && method === 'GET') {
        const r = await pool.query(`SELECT value FROM hms_settings WHERE key = 'registration_fee'`);
        const fee = r.rows.length > 0 ? Number(r.rows[0].value) : 300;
        return res.json({ fee });
      }

      // PUT /payments/registration-fee
      if (segments[1] === 'registration-fee' && method === 'PUT') {
        const b = req.body || {};
        const fee = Number(b.fee);
        if (!fee || fee < 1) return res.status(400).json({ message: 'Valid fee amount required' });
        await pool.query(
          `INSERT INTO hms_settings (key, value, updated_at) VALUES ('registration_fee', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [String(fee)]
        );
        return res.json({ fee, message: 'Registration fee updated' });
      }

      // GET /payments - list all payments with patient info
      if (method === 'GET' && segments.length <= 1) {
        try {
          // Migrate data from old mpesa_transactions table if it exists
          try {
            await pool.query(`
              INSERT INTO hms_mpesa_transactions (checkout_request_id, merchant_request_id, phone_number, amount, account_reference, transaction_desc, mpesa_receipt_number, result_code, result_desc, status, inv_id, invoice_no, created_at, updated_at)
              SELECT checkout_request_id, merchant_request_id, phone_number, amount, account_reference, transaction_desc, mpesa_receipt_number, result_code, result_desc, status, inv_id, invoice_no, created_at, updated_at
              FROM mpesa_transactions
              ON CONFLICT (checkout_request_id) DO NOTHING
            `);
          } catch (migErr: any) {
            console.log('[PAYMENTS MIGRATE] old table not found or empty:', migErr.message);
          }

          const dateFrom = req.query?.dateFrom as string || '';
          const dateTo = req.query?.dateTo as string || '';
          const search = (req.query?.search as string || '').trim();

          let whereClauses: string[] = [];
          let params: any[] = [];
          let paramIdx = 1;

          if (dateFrom) {
            whereClauses.push(`mt.created_at >= $${paramIdx++}`);
            params.push(`${dateFrom}T00:00:00`);
          }
          if (dateTo) {
            whereClauses.push(`mt.created_at <= $${paramIdx++}`);
            params.push(`${dateTo}T23:59:59`);
          }
          if (search) {
            whereClauses.push(`(p.first_name ILIKE $${paramIdx} OR p.last_name ILIKE $${paramIdx} OR p.phone ILIKE $${paramIdx} OR CONCAT(p.first_name,' ',p.last_name) ILIKE $${paramIdx} OR mt.phone_number ILIKE $${paramIdx} OR mt.mpesa_receipt_number ILIKE $${paramIdx})`);
            params.push(`%${search}%`);
            paramIdx++;
          }

          const where = whereClauses.length > 0 ? 'AND ' + whereClauses.join(' AND ') : '';

          const r = await pool.query(
            `SELECT mt.*, p.first_name as patient_first_name, p.last_name as patient_last_name, p.phone as patient_phone, p.id as patient_id
             FROM hms_mpesa_transactions mt
             LEFT JOIN hms_patients p ON mt.phone_number = p.phone OR mt.account_reference = p.patient_number
             WHERE mt.status IS NOT NULL ${where}
             ORDER BY mt.created_at DESC`,
            params
          );

          // Get summary stats (using CASE WHEN instead of FILTER for PgBouncer compatibility)
          const today = new Date().toISOString().slice(0, 10);
          const stats = await pool.query(`
            SELECT
              COUNT(CASE WHEN mt.status = 'Completed' AND mt.created_at::date = $1 THEN 1 END) as paid_today,
              COUNT(CASE WHEN mt.status = 'Completed' THEN 1 END) as total_payments,
              COALESCE(SUM(CASE WHEN mt.status = 'Completed' AND mt.created_at::date = $1 THEN mt.amount END), 0) as amount_today,
              COALESCE(SUM(CASE WHEN mt.status = 'Completed' THEN mt.amount END), 0) as total_amount,
              COUNT(CASE WHEN mt.status = 'Failed' THEN 1 END) as failed_payments,
              COUNT(CASE WHEN mt.status = 'Cancelled' THEN 1 END) as cancelled_payments
            FROM hms_mpesa_transactions mt
          `, [today]);

          // New patients today
          const newPatientsToday = await pool.query(`SELECT COUNT(*) as count FROM hms_patients WHERE created_at::date = $1`, [today]);
          // Total patients
          const totalPatients = await pool.query(`SELECT COUNT(*) as count FROM hms_patients`);
          // Renewals (patients with registration > 1 year old who made a new payment)
          const renewals = await pool.query(`
            SELECT COUNT(DISTINCT p.id) as count
            FROM hms_patients p
            JOIN hms_mpesa_transactions mt ON mt.phone_number = p.phone AND mt.status = 'Completed'
            WHERE p.created_at < NOW() - INTERVAL '1 year' AND mt.created_at::date = $1
          `, [today]);

          // New user amounts vs renewal amounts
          const newVsRenewal = await pool.query(`
            SELECT
              COALESCE(SUM(CASE WHEN p.created_at::date = mt.created_at::date THEN mt.amount END), 0) as new_user_amount,
              COALESCE(SUM(CASE WHEN p.created_at::date != mt.created_at::date THEN mt.amount END), 0) as renewal_amount
            FROM hms_mpesa_transactions mt
            JOIN hms_patients p ON mt.phone_number = p.phone
            WHERE mt.status = 'Completed' AND mt.created_at::date = $1
          `, [today]);

          // Daily payment trend for charts (last 14 days)
          const dailyTrend = await pool.query(`
            SELECT DATE(mt.created_at) as date, COUNT(*) as count, COALESCE(SUM(mt.amount), 0) as total
            FROM hms_mpesa_transactions mt
            WHERE mt.status = 'Completed' AND mt.created_at >= NOW() - INTERVAL '14 days'
            GROUP BY DATE(mt.created_at) ORDER BY DATE(mt.created_at)
          `);

          return res.json({
            payments: txAll(r.rows),
            stats: {
              paidToday: Number(stats.rows[0]?.paid_today || 0),
              totalPayments: Number(stats.rows[0]?.total_payments || 0),
              amountToday: Number(stats.rows[0]?.amount_today || 0),
              totalAmount: Number(stats.rows[0]?.total_amount || 0),
              failedPayments: Number(stats.rows[0]?.failed_payments || 0),
              cancelledPayments: Number(stats.rows[0]?.cancelled_payments || 0),
              newPatientsToday: Number(newPatientsToday.rows[0]?.count || 0),
              totalPatients: Number(totalPatients.rows[0]?.count || 0),
              renewalsToday: Number(renewals.rows[0]?.count || 0),
              newUsersAmountToday: Number(newVsRenewal.rows[0]?.new_user_amount || 0),
              renewalAmountToday: Number(newVsRenewal.rows[0]?.renewal_amount || 0),
            },
            dailyTrend: txAll(dailyTrend.rows),
          });
        } catch (err: any) {
          console.error('[PAYMENTS GET ERROR]', err.message, err.stack);
          return res.status(500).json({ message: err.message || 'Failed to load payments data' });
        }
      }

      return res.status(404).json({ message: 'Payment route not found' });
    }

    // ========== PATIENTS ==========
    if (segments[0] === 'patients') {
      if (segments[1] === 'count' && method === 'GET') {
        const r = await pool.query('SELECT COUNT(*) as total FROM hms_patients');
        return res.json({ total: parseInt(r.rows[0].total) });
      }
      // Patient search
      if (segments[1] === 'search' && method === 'GET') {
        const q = (req.query?.q as string || '').trim();
        if (!q) return res.json([]);
        const r = await pool.query(
          `SELECT * FROM hms_patients WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR phone ILIKE $1 OR CONCAT(first_name,' ',last_name) ILIKE $1 ORDER BY first_name LIMIT 20`,
          [`%${q}%`]
        );
        return res.json(txAll(r.rows));
      }
      if (segments.length === 3 && segments[2] === 'tags') {
        if (method === 'GET') return res.json([]);
        if (method === 'POST') return res.json({ message: 'Tag added' });
        if (method === 'DELETE') return res.json({ message: 'Tag removed' });
      }
      if (segments.length === 3 && segments[2] === 'consents') {
        if (method === 'GET') return res.json([]);
        if (method === 'POST') return res.json({ message: 'Consent saved' });
      }
      if (segments.length === 3 && segments[2] === 'send-consent-otp') {
        return res.json({ message: 'OTP sent' });
      }
      if (segments.length === 3 && segments[2] === 'verify-consent-otp') {
        return res.json({ message: 'OTP verified' });
      }
      if (segments.length === 3 && segments[2] === 'encounters' && method === 'POST') {
        const patientId = segments[1];
        const b = req.body || {};
        const encNum = `ENC-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const r = await pool.query(
          `INSERT INTO hms_encounters (encounter_number, encounter_type, priority_type, notes, patient_id, provider_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
          [encNum, b.encounter_type || 'Outpatient', b.priority_type || 'Normal', b.notes, patientId, b.provider_id]
        );
        return res.status(201).json(tx(r.rows[0]));
      }
      if (segments.length === 2 && method === 'DELETE') {
        await pool.query('DELETE FROM hms_patients WHERE id = $1', [segments[1]]);
        return res.json({ message: 'Patient deleted' });
      }
      if (segments.length === 2 && method === 'PUT') {
        const id = segments[1];
        const b = req.body || {};
        const r = await pool.query(
          `UPDATE hms_patients SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
           middle_name=COALESCE($3,middle_name), gender=COALESCE($4,gender), dob=COALESCE($5,dob),
           phone=COALESCE($6,phone), email=COALESCE($7,email), occupation=COALESCE($8,occupation),
           county=COALESCE($9,county), sub_county=COALESCE($10,sub_county),
           area_of_residence=COALESCE($11,area_of_residence), updated_at=NOW()
           WHERE id=$12 RETURNING *`,
          [b.firstName||b.first_name, b.lastName||b.last_name, b.middleName||b.middle_name,
           b.gender, b.dob, b.phone, b.email, b.occupation,
           b.county, b.subCounty||b.sub_county, b.areaOfResidence||b.area_of_residence, id]
        );
        return res.json(tx(r.rows[0]));
      }
      // GET /patients/:id (single patient)
      if (segments.length === 2 && method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_patients WHERE id = $1', [segments[1]]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Patient not found' });
        return res.json(tx(r.rows[0]));
      }
      // GET /patients or POST /patients
      if (segments.length <= 1) {
        if (method === 'GET') {
          const r = await pool.query('SELECT * FROM hms_patients ORDER BY created_at DESC');
          return res.json(txAll(r.rows));
        }
        if (method === 'POST') {
          const b = req.body || {};
          const registrationPayment = b.registrationPayment || b.registration_payment;
          if (!registrationPayment?.checkoutRequestId) {
            return res.status(400).json({ message: 'Registration payment is required before saving patient.' });
          }
          const paymentTx = await pool.query(
            `SELECT * FROM hms_mpesa_transactions WHERE checkout_request_id=$1 ORDER BY updated_at DESC LIMIT 1`,
            [registrationPayment.checkoutRequestId]
          );
          if (paymentTx.rows.length === 0) {
            return res.status(400).json({ message: 'M-Pesa transaction not found. Complete payment first.' });
          }
          const mpesaTx = paymentTx.rows[0];
          const isPaid = mpesaTx.status === 'Completed' || Number(mpesaTx.result_code) === 0;
          if (!isPaid) {
            return res.status(400).json({ message: 'M-Pesa payment not completed yet.' });
          }
          // Get dynamic registration fee
          const feeRes = await pool.query(`SELECT value FROM hms_settings WHERE key = 'registration_fee'`);
          const registrationFee = feeRes.rows.length > 0 ? Number(feeRes.rows[0].value) : 300;
          if (Number(mpesaTx.amount || 0) < registrationFee) {
            return res.status(400).json({ message: `Registration fee must be at least KSh ${registrationFee} via M-Pesa.` });
          }

          // Ensure enum types have the values we need BEFORE starting transaction
          // (ALTER TYPE ADD VALUE cannot run inside a transaction block)
          try { await pool.query(`ALTER TYPE enum_hms_payments_method ADD VALUE IF NOT EXISTS 'mpesa'`); } catch(e: any) { console.log('[ENUM] payments_method mpesa:', e.message); }
          try { await pool.query(`ALTER TYPE enum_hms_invoices_status ADD VALUE IF NOT EXISTS 'paid'`); } catch(e: any) { console.log('[ENUM] invoices_status paid:', e.message); }

          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            const gender = String((b.gender || '').toLowerCase());
            const normalizedGender = gender.startsWith('m') ? 'Male' : gender.startsWith('f') ? 'Female' : 'Other';
            const heard = b.heardAboutFacility || b.heard_about_facility || null;
            const patientNumber = b.patientNumber || b.patient_number || null;
            const shaNumber = b.shaNumber || b.sha_number || null;

            const r = await client.query(
              `INSERT INTO hms_patients (first_name, last_name, middle_name, gender, dob, phone, email, occupation,
               patient_status, heard_about_facility, patient_number, sha_number, county, sub_county, area_of_residence,
               next_of_kin_first_name, next_of_kin_last_name, next_of_kin_phone, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW()) RETURNING *`,
              [b.firstName||b.first_name, b.lastName||b.last_name, b.middleName||b.middle_name,
               normalizedGender, b.dob, b.phone, b.email, b.occupation,
               b.patientStatus||b.patient_status||'Alive', heard,
               patientNumber, shaNumber,
               b.county, b.subCounty||b.sub_county, b.areaOfResidence||b.area_of_residence,
               b.nextOfKinFirstName||b.next_of_kin_first_name, b.nextOfKinLastName||b.next_of_kin_last_name,
               b.nextOfKinPhone||b.next_of_kin_phone]
            );

            const patient = r.rows[0];
            const invoiceNumber = `REG-${patient.id}-${Date.now().toString().slice(-6)}`;

            const inv = await client.query(
              `INSERT INTO hms_invoices (patient_id, invoice_number, amount, status, created_at, updated_at)
               VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING *`,
              [patient.id, invoiceNumber, registrationFee, 'paid']
            );
            await client.query(
              `INSERT INTO hms_payments (invoice_id, amount, method, transaction_code, created_at, updated_at)
               VALUES ($1,$2,$3,$4,NOW(),NOW())`,
              [inv.rows[0].id, registrationFee, 'mpesa', mpesaTx.mpesa_receipt_number || mpesaTx.checkout_request_id]
            );
            await client.query(
              `UPDATE hms_mpesa_transactions
               SET inv_id=$1, invoice_no=$2, updated_at=NOW()
               WHERE checkout_request_id=$3`,
              [inv.rows[0].id, invoiceNumber, registrationPayment.checkoutRequestId]
            );
            await client.query('COMMIT');
            return res.status(201).json(tx(patient));
          } catch (err: any) {
            await client.query('ROLLBACK');
            return res.status(500).json({ message: err.message || 'Failed to create patient' });
          } finally {
            client.release();
          }
        }
      }
      return res.status(404).json({ message: 'Patient route not found' });
    }

    // ========== ENCOUNTERS ==========
    if (segments[0] === 'encounters') {
      if (segments.length === 3 && segments[2] === 'close' && method === 'PATCH') {
        await pool.query(`UPDATE hms_encounters SET updated_at=NOW() WHERE id=$1`, [segments[1]]);
        return res.json({ message: 'Encounter closed' });
      }
      if (method === 'GET') {
        const r = await pool.query(`
          SELECT e.*, p.first_name as patient_first, p.last_name as patient_last, p.gender as patient_gender, p.dob as patient_dob,
                 s.first_name as provider_first, s.last_name as provider_last, s.title as provider_title
          FROM hms_encounters e
          LEFT JOIN hms_patients p ON e.patient_id = p.id
          LEFT JOIN hms_staff s ON e.provider_id = s.id
          ORDER BY e.created_at DESC
        `);
        return res.json(txAll(r.rows));
      }
      if (method === 'POST') {
        const b = req.body || {};
        const encNum = b.encounter_number || `ENC-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const r = await pool.query(
          `INSERT INTO hms_encounters (encounter_number, encounter_type, priority_type, notes, patient_id, provider_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
          [encNum, b.encounter_type, b.priority_type, b.notes, b.patient_id, b.provider_id]
        );
        return res.status(201).json(tx(r.rows[0]));
      }
      return res.status(404).json({ message: 'Encounter route not found' });
    }

    // ========== APPOINTMENTS ==========
    if (segments[0] === 'appointments') {
      if (segments.length === 2 && method === 'PATCH') {
        const b = req.body || {};
        const r = await pool.query(
          `UPDATE hms_appointments SET status=COALESCE($1,status), updated_at=NOW() WHERE id=$2 RETURNING *`,
          [b.status, segments[1]]
        );
        return res.json(tx(r.rows[0]));
      }
      if (method === 'GET') {
        const r = await pool.query(`
          SELECT a.*, p.first_name, p.last_name, u.name as doctor_name
          FROM hms_appointments a
          LEFT JOIN hms_patients p ON a.patient_id = p.id
          LEFT JOIN hms_users u ON a.doctor_id = u.id
          ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `);
        return res.json(txAll(r.rows));
      }
      if (method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
          [b.patient_id, b.doctor_id, b.appointment_date, b.appointment_time, b.reason, b.status || 'Scheduled']
        );
        return res.status(201).json(tx(r.rows[0]));
      }
      return res.status(404).json({ message: 'Appointment route not found' });
    }

    // ========== STAFF ==========
    if (segments[0] === 'staff') {
      if (segments.length === 2 && segments[1] === 'request-otp' && method === 'POST') {
        const email = String((req.body || {}).email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email format.' });
        const exists = await pool.query('SELECT id FROM hms_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        if (exists.rows.length > 0) return res.status(409).json({ message: 'This email is already registered.' });
        try {
          await sendStaffOtp(email);
        } catch (e: any) {
          return res.status(500).json({
            message: `Failed to request OTP: ${e?.message || 'SMTP settings are not configured correctly.'}`
          });
        }
        return res.json({ message: 'OTP sent to your email.' });
      }
      if (segments.length === 2 && segments[1] === 'resend-otp' && method === 'POST') {
        const email = String((req.body || {}).email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email format.' });
        const exists = await pool.query('SELECT id FROM hms_users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        if (exists.rows.length > 0) return res.status(409).json({ message: 'This email is already registered.' });
        try {
          await sendStaffOtp(email);
        } catch (e: any) {
          return res.status(500).json({
            message: `Failed to resend OTP: ${e?.message || 'SMTP settings are not configured correctly.'}`
          });
        }
        return res.json({ message: 'OTP resent to your email.' });
      }
      if (segments.length === 3 && segments[2] === 'active' && method === 'PATCH') {
        const b = req.body || {};
        await pool.query('UPDATE hms_staff SET active_status=$1, updated_at=NOW() WHERE id=$2', [b.is_active, segments[1]]);
        return res.json({ message: 'Staff status updated' });
      }
      if (segments.length === 2 && method === 'DELETE') {
        await pool.query('DELETE FROM hms_staff WHERE id = $1', [segments[1]]);
        return res.json({ message: 'Staff deleted' });
      }
      if (segments.length === 2 && method === 'PUT') {
        const b = req.body || {};
        const r = await pool.query(
          `UPDATE hms_staff SET title=COALESCE($1,title), first_name=COALESCE($2,first_name),
           last_name=COALESCE($3,last_name), gender=COALESCE($4,gender), email=COALESCE($5,email),
           phone=COALESCE($6,phone), address=COALESCE($7,address), role=COALESCE($8,role),
           job_title=COALESCE($9,job_title), updated_at=NOW() WHERE id=$10 RETURNING *`,
          [b.title, b.first_name||b.firstName, b.last_name||b.lastName, b.gender, b.email, b.phone, b.address, b.role, b.job_title||b.jobTitle, segments[1]]
        );
        const updated = tx(r.rows[0]);
        if (updated?.email) {
          await pool.query(
            `UPDATE hms_users
             SET name = COALESCE($1, name),
                 email = COALESCE($2, email),
                 role = COALESCE($3, role),
                 updated_at = NOW()
             WHERE LOWER(email) = LOWER($4)`,
            [
              `${updated.firstName || ''} ${updated.lastName || ''}`.trim(),
              updated.email,
              updated.role,
              updated.email
            ]
          );
        }
        return res.json(updated);
      }
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_staff ORDER BY created_at DESC');
        return res.json(txAll(r.rows));
      }
      if (method === 'POST') {
        const b = req.body || {};
        const email = String(b.email || '').trim().toLowerCase();
        const otp = String(b.otp || '').trim();
        if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });
        if (!verifyStaffOtp(email, otp)) return res.status(401).json({ message: 'Invalid or expired OTP.' });
        const existingUser = await pool.query('SELECT id FROM hms_users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
        if (existingUser.rows.length > 0) return res.status(409).json({ message: 'This email is already registered.' });

        const hashed = await bcrypt.hash(b.password || '1234', 10);
        const r = await pool.query(
          `INSERT INTO hms_staff (title, first_name, last_name, gender, email, phone, address, role, job_title, username, password, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *`,
          [b.title, b.first_name||b.firstName, b.last_name||b.lastName, b.gender, email, b.phone, b.address, b.role, b.job_title||b.jobTitle, b.username || email, hashed]
        );
        const created = tx(r.rows[0]);
        await pool.query(
          `INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
           VALUES ($1,$2,$3,$4,NOW(),NOW())`,
          [`${created.firstName || ''} ${created.lastName || ''}`.trim(), email, hashed, created.role || 'Staff']
        );
        return res.status(201).json(created);
      }
      return res.status(404).json({ message: 'Staff route not found' });
    }

    // ========== TRIAGE ==========
    if (segments[0] === 'triage') {
      if (method === 'GET') {
        const r = await pool.query(`
          SELECT t.*, p.first_name, p.last_name, p.gender, p.dob, p.phone
          FROM hms_triages t
          LEFT JOIN hms_patients p ON t.patient_id = p.id
          ORDER BY t.created_at DESC
        `);
        return res.json(txAll(r.rows));
      }
      if (method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_triages (patient_id, patient_status, temperature, heart_rate, blood_pressure,
           respiratory_rate, blood_oxygenation, weight, height, muac, lmp_date, comments, date, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW(),NOW()) RETURNING *`,
          [b.patient_id||b.patientId, b.patient_status||b.patientStatus, b.temperature, b.heart_rate||b.heartRate,
           b.blood_pressure||b.bloodPressure, b.respiratory_rate||b.respiratoryRate,
           b.blood_oxygenation||b.bloodOxygenation, b.weight, b.height, b.muac, b.lmp_date||b.lmpDate, b.comments]
        );
        return res.status(201).json(tx(r.rows[0]));
      }
    }

    // ========== ORGANISATION SETTINGS ==========
    if (segments[0] === 'organisation-settings') {
      if (segments[1] === 'discard' && method === 'DELETE') {
        return res.json({ message: 'Settings discarded' });
      }
      if (segments[1] === 'save' && method === 'POST') {
        const b = req.body || {};
        const existing = await pool.query('SELECT id FROM hms_organisation_settings LIMIT 1');
        if (existing.rows.length > 0) {
          const r = await pool.query(
            `UPDATE hms_organisation_settings SET organisation_name=COALESCE($1,organisation_name),
             email=COALESCE($2,email), phone=COALESCE($3,phone), address=COALESCE($4,address),
             country=COALESCE($5,country), city=COALESCE($6,city), town=COALESCE($7,town),
             county=COALESCE($8,county), sub_county=COALESCE($9,sub_county), ward=COALESCE($10,ward),
             "updatedAt"=NOW() WHERE id=$11 RETURNING *`,
            [b.organisation_name||b.organisationName, b.email, b.phone, b.address, b.country, b.city, b.town,
             b.county, b.sub_county||b.subCounty, b.ward, existing.rows[0].id]
          );
          return res.json(tx(r.rows[0]));
        } else {
          const r = await pool.query(
            `INSERT INTO hms_organisation_settings (organisation_name, email, phone, address, country, city, town, county, sub_county, ward, "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
            [b.organisation_name||b.organisationName, b.email, b.phone, b.address, b.country, b.city, b.town,
             b.county, b.sub_county||b.subCounty, b.ward]
          );
          return res.status(201).json(tx(r.rows[0]));
        }
      }
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_organisation_settings LIMIT 1');
        return res.json(r.rows.length > 0 ? tx(r.rows[0]) : null);
      }
    }

    // ========== ORGANIZATION ==========
    if (segments[0] === 'organization') {
      if (segments[1] === 'settings') {
        if (method === 'GET') {
          const r = await pool.query('SELECT * FROM hms_organisation_settings LIMIT 1');
          return res.json(r.rows.length > 0 ? tx(r.rows[0]) : {});
        }
        if (method === 'PUT') {
          const b = req.body || {};
          const existing = await pool.query('SELECT id FROM hms_organisation_settings LIMIT 1');
          if (existing.rows.length > 0) {
            const r = await pool.query(
              `UPDATE hms_organisation_settings SET organisation_name=COALESCE($1,organisation_name),
               email=COALESCE($2,email), phone=COALESCE($3,phone), address=COALESCE($4,address),
               "updatedAt"=NOW() WHERE id=$5 RETURNING *`,
              [b.organisation_name||b.organisationName, b.email, b.phone, b.address, existing.rows[0].id]
            );
            return res.json(tx(r.rows[0]));
          }
          return res.json({});
        }
      }
      if (segments[1] === 'payment-methods') {
        if (segments.length === 3 && method === 'DELETE') {
          await pool.query('DELETE FROM hms_payment_methods WHERE id = $1', [segments[2]]);
          return res.json({ message: 'Payment method deleted' });
        }
        if (method === 'GET') {
          const r = await pool.query('SELECT * FROM hms_payment_methods ORDER BY id');
          return res.json(txAll(r.rows));
        }
        if (method === 'POST') {
          const b = req.body || {};
          const r = await pool.query(
            `INSERT INTO hms_payment_methods (name, active_on_pos, transaction_code, enabled, "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING *`,
            [b.name, b.active_on_pos || false, b.transaction_code || false, b.enabled !== false]
          );
          return res.status(201).json(tx(r.rows[0]));
        }
      }
      if (segments[1] === 'roles') {
        // GET /organization/roles/:id/permissions
        if (segments.length >= 4 && segments[3] === 'permissions' && method === 'GET') {
          const roleId = segments[2];
          const r = await pool.query(
            `SELECT rp.id, rp.role_id, rp.permission_id, rp.can_create, rp.can_edit, rp.can_view, rp.can_archive,
                    p.permission_name, p.permission_key, p.category, p.has_create, p.has_edit, p.has_view, p.has_archive, p.sort_order
             FROM hms_role_permissions rp
             JOIN hms_permissions p ON rp.permission_id = p.id
             WHERE rp.role_id = $1
             ORDER BY p.sort_order, p.permission_name`,
            [roleId]
          );
          return res.json(txAll(r.rows));
        }
        // POST /organization/roles/:id/permissions - save permissions
        if (segments.length >= 4 && segments[3] === 'permissions' && method === 'POST') {
          const roleId = segments[2];
          const permissions = req.body?.permissions || [];
          for (const perm of permissions) {
            await pool.query(
              `UPDATE hms_role_permissions SET can_create=$1, can_edit=$2, can_view=$3, can_archive=$4, "updated_at"=NOW()
               WHERE role_id=$5 AND permission_id=$6`,
              [perm.can_create || false, perm.can_edit || false, perm.can_view || false, perm.can_archive || false, roleId, perm.permission_id]
            );
          }
          return res.json({ message: 'Permissions updated successfully' });
        }
        // GET /organization/roles - list all roles
        if (method === 'GET') {
          const r = await pool.query('SELECT * FROM hms_user_roles ORDER BY id');
          return res.json(txAll(r.rows));
        }
      }
    }

    // ========== STOCK ==========
    if (segments[0] === 'stock') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_stock ORDER BY created_at DESC');
        return res.json(txAll(r.rows));
      }
    }

    // ========== INVOICES ==========
    if (segments[0] === 'invoices') {
      if (method === 'GET') {
        const r = await pool.query(`
          SELECT i.*, p.first_name, p.last_name FROM hms_invoices i
          LEFT JOIN hms_patients p ON i.patient_id = p.id ORDER BY i.created_at DESC
        `);
        return res.json(txAll(r.rows));
      }
    }

    // ========== TAGS ==========
    if (segments[0] === 'tags') {
      if (method === 'POST') {
        return res.json({ id: Date.now(), name: req.body?.name || 'Tag' });
      }
      return res.json([]);
    }
    if (segments[0] === 'tag-categories') return res.json([]);

    // ========== POS ==========
    if (segments[0] === 'pos') {
      if (segments[1] === 'sales' && method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_pos_sales ORDER BY created_at DESC');
        return res.json(txAll(r.rows));
      }
      if (segments[1] === 'products' && method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_products ORDER BY created_at DESC');
        return res.json(txAll(r.rows));
      }
    }

    // ========== PRODUCTS ==========
    if (segments[0] === 'products') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_products ORDER BY created_at DESC');
        return res.json(txAll(r.rows));
      }
    }

    // ========== APPOINTMENT TYPES ==========
    if (segments[0] === 'appointment-types') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_appointment_types WHERE is_active = true ORDER BY sort_order');
        return res.json(txAll(r.rows));
      }
    }

    // ========== USER ROLES ==========
    if (segments[0] === 'user-roles' || segments[0] === 'roles') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_user_roles ORDER BY id');
        return res.json(txAll(r.rows));
      }
    }

    // ========== PERMISSIONS ==========
    if (segments[0] === 'permissions') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_permissions ORDER BY sort_order');
        return res.json(txAll(r.rows));
      }
    }

    // ========== COMPLAINTS ==========
    if (segments[0] === 'complaints') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_complaints ORDER BY created_at DESC');
        return res.json(txAll(r.rows));
      }
    }

    // ========== INVESTIGATIONS ==========
    if (segments[0] === 'investigations' || segments[0] === 'investigation-requests') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_investigation_requests ORDER BY created_at DESC');
        return res.json(txAll(r.rows));
      }
    }
    if (segments[0] === 'investigation-tests') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_investigation_tests ORDER BY name');
        return res.json(txAll(r.rows));
      }
    }

    // ========== ORGANISATION SETTINGS ==========
    if (segments[0] === 'organisation-settings') {
      // GET /organisation-settings
      if (segments.length === 1 && method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_organisation_settings ORDER BY id LIMIT 1');
        if (r.rows.length > 0) return res.json(tx(r.rows[0]));
        return res.json({});
      }
      // POST /organisation-settings/save
      if (segments[1] === 'save' && method === 'POST') {
        const b = req.body || {};
        // Check if record exists
        const existing = await pool.query('SELECT id FROM hms_organisation_settings LIMIT 1');
        if (existing.rows.length > 0) {
          // Build dynamic update - only update logo_url if provided
          let query = `UPDATE hms_organisation_settings SET 
              organisation_name=$1, country=$2, city=$3, town=$4, phone=$5, address=$6, email=$7, 
              payment_method_id=$8, county=$9, sub_county=$10, ward=$11, "updatedAt"=NOW()`;
          const params: any[] = [b.organisation_name||'', b.country||'', b.city||'', b.town||'', b.phone||'', b.address||'', b.email||'',
             b.payment_method_id||null, b.county||'', b.sub_county||'', b.ward||''];
          if (b.logo_url) {
            query += `, logo_url=$${params.length + 1}`;
            params.push(b.logo_url);
          }
          query += ` WHERE id=$${params.length + 1}`;
          params.push(existing.rows[0].id);
          await pool.query(query, params);
        } else {
          await pool.query(
            `INSERT INTO hms_organisation_settings (organisation_name, country, city, town, phone, address, email, payment_method_id, county, sub_county, ward, logo_url, "createdAt", "updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())`,
            [b.organisation_name||'', b.country||'', b.city||'', b.town||'', b.phone||'', b.address||'', b.email||'',
             b.payment_method_id||null, b.county||'', b.sub_county||'', b.ward||'', b.logo_url||'']
          );
        }
        return res.json({ message: 'Organisation settings saved' });
      }
      // DELETE /organisation-settings/discard
      if (segments[1] === 'discard' && method === 'DELETE') {
        return res.json({ message: 'Discarded' });
      }
    }

    // ========== ORGANIZATION (payment methods, roles, permissions) ==========
    if (segments[0] === 'organization') {
      // Payment Methods
      if (segments[1] === 'payment-methods') {
        if (method === 'GET' && segments.length === 2) {
          const r = await pool.query('SELECT * FROM hms_payment_methods ORDER BY id');
          return res.json(txAll(r.rows));
        }
        if (method === 'POST' && segments.length === 2) {
          const b = req.body || {};
          await pool.query(
            `INSERT INTO hms_payment_methods (name, active_on_pos, transaction_code, enabled, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())`,
            [b.name, b.active_on_pos ? true : false, b.transaction_code ? true : false, b.enabled ? true : false]
          );
          return res.json({ message: 'Payment method added' });
        }
        if (method === 'PUT' && segments.length === 3) {
          const id = segments[2];
          const b = req.body || {};
          await pool.query(
            `UPDATE hms_payment_methods SET name=$1, active_on_pos=$2, transaction_code=$3, "updatedAt"=NOW() WHERE id=$4`,
            [b.name, b.active_on_pos ? true : false, b.transaction_code ? true : false, id]
          );
          return res.json({ message: 'Payment method updated' });
        }
        if (method === 'DELETE' && segments.length === 3) {
          const id = segments[2];
          await pool.query('DELETE FROM hms_payment_methods WHERE id=$1', [id]);
          return res.json({ message: 'Payment method deleted' });
        }
      }

      // Roles
      if (segments[1] === 'roles') {
        if (method === 'GET' && segments.length === 2) {
          const r = await pool.query('SELECT * FROM hms_user_roles ORDER BY id');
          return res.json(txAll(r.rows));
        }
        // GET /organization/roles/:id/permissions
        if (segments.length === 4 && segments[3] === 'permissions') {
          const roleId = segments[2];
          if (method === 'GET') {
            const r = await pool.query(
              `SELECT p.*, COALESCE(rp.can_create, false) as can_create, COALESCE(rp.can_edit, false) as can_edit,
                      COALESCE(rp.can_view, false) as can_view, COALESCE(rp.can_archive, false) as can_archive
               FROM hms_permissions p
               LEFT JOIN hms_role_permissions rp ON rp.permission_id = p.id AND rp.role_id = $1
               ORDER BY p.sort_order`, [roleId]
            );
            return res.json(txAll(r.rows));
          }
          // POST /organization/roles/:id/permissions
          if (method === 'POST') {
            const { permissions } = req.body || {};
            if (Array.isArray(permissions)) {
              for (const p of permissions) {
                const existing = await pool.query(
                  'SELECT id FROM hms_role_permissions WHERE role_id=$1 AND permission_id=$2', [roleId, p.permission_id]
                );
                if (existing.rows.length > 0) {
                  await pool.query(
                    `UPDATE hms_role_permissions SET can_create=$1, can_edit=$2, can_view=$3, can_archive=$4, updated_at=NOW() WHERE role_id=$5 AND permission_id=$6`,
                    [p.can_create, p.can_edit, p.can_view, p.can_archive, roleId, p.permission_id]
                  );
                } else {
                  await pool.query(
                    `INSERT INTO hms_role_permissions (role_id, permission_id, can_create, can_edit, can_view, can_archive, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`,
                    [roleId, p.permission_id, p.can_create, p.can_edit, p.can_view, p.can_archive]
                  );
                }
              }
            }
            return res.json({ message: 'Permissions saved' });
          }
        }
      }
    }

    // ========== WARDS ==========
    if (segments[0] === 'wards') {
      if (segments.length === 1 && method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_wards ORDER BY name');
        return res.json(txAll(r.rows));
      }
      if (segments.length === 1 && method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_wards (name, ward_type, total_beds, description, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,true,NOW(),NOW()) RETURNING *`,
          [b.name, b.ward_type || 'General', b.total_beds || 0, b.description || '']
        );
        // Auto-create beds if total_beds > 0
        const ward = r.rows[0];
        const totalBeds = parseInt(b.total_beds) || 0;
        for (let i = 1; i <= totalBeds; i++) {
          await pool.query(
            `INSERT INTO hms_beds (ward_id, bed_number, status, created_at, updated_at)
             VALUES ($1, $2, 'Vacant', NOW(), NOW())`,
            [ward.id, `${b.name?.substring(0,3)?.toUpperCase() || 'BED'}-${String(i).padStart(2,'0')}`]
          );
        }
        return res.status(201).json(tx(ward));
      }
      // GET /wards/:id/beds
      if (segments.length === 3 && segments[2] === 'beds' && method === 'GET') {
        const r = await pool.query(
          `SELECT b.*, a.patient_id FROM hms_beds b
           LEFT JOIN hms_admissions a ON b.current_admission_id = a.id
           WHERE b.ward_id = $1 ORDER BY b.bed_number`,
          [segments[1]]
        );
        return res.json(txAll(r.rows));
      }
      // POST /wards/:id/beds
      if (segments.length === 3 && segments[2] === 'beds' && method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_beds (ward_id, bed_number, status, created_at, updated_at)
           VALUES ($1, $2, 'Vacant', NOW(), NOW()) RETURNING *`,
          [segments[1], b.bed_number]
        );
        return res.status(201).json(tx(r.rows[0]));
      }
    }

    // ========== ADMISSIONS ==========
    if (segments[0] === 'admissions') {
      if (segments.length === 1 && method === 'GET') {
        const r = await pool.query(`
          SELECT a.*, p.first_name, p.last_name, p.gender, p.dob, p.phone,
                 w.name as ward_name, b.bed_number,
                 s.first_name as clinician_first_name, s.last_name as clinician_last_name
          FROM hms_admissions a
          LEFT JOIN hms_patients p ON a.patient_id = p.id
          LEFT JOIN hms_wards w ON a.ward_id = w.id
          LEFT JOIN hms_beds b ON a.bed_id = b.id
          LEFT JOIN hms_staff s ON a.admitting_clinician_id = s.id
          ORDER BY a.created_at DESC
        `);
        return res.json(txAll(r.rows));
      }
      if (segments.length === 1 && method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_admissions (patient_id, encounter_id, ward_id, bed_id, admitting_clinician_id,
           admission_date, admitting_diagnosis, status, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW()),$7,'Admitted',NOW(),NOW()) RETURNING *`,
          [b.patient_id, b.encounter_id || null, b.ward_id, b.bed_id, b.admitting_clinician_id,
           b.admission_date || null, b.admitting_diagnosis || '']
        );
        // Update bed status
        await pool.query(`UPDATE hms_beds SET status='Occupied', current_admission_id=$1, updated_at=NOW() WHERE id=$2`,
          [r.rows[0].id, b.bed_id]);
        return res.status(201).json(tx(r.rows[0]));
      }
      // GET /admissions/:id
      if (segments.length === 2 && method === 'GET') {
        const r = await pool.query(`
          SELECT a.*, p.first_name, p.last_name, p.gender, p.dob, p.phone,
                 w.name as ward_name, b.bed_number,
                 s.first_name as clinician_first_name, s.last_name as clinician_last_name
          FROM hms_admissions a
          LEFT JOIN hms_patients p ON a.patient_id = p.id
          LEFT JOIN hms_wards w ON a.ward_id = w.id
          LEFT JOIN hms_beds b ON a.bed_id = b.id
          LEFT JOIN hms_staff s ON a.admitting_clinician_id = s.id
          WHERE a.id = $1`, [segments[1]]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Admission not found' });
        return res.json(tx(r.rows[0]));
      }
      // POST /admissions/:id/discharge
      if (segments.length === 3 && segments[2] === 'discharge' && method === 'POST') {
        const b = req.body || {};
        await pool.query(
          `UPDATE hms_admissions SET status='Discharged', discharge_date=NOW(),
           discharge_diagnosis=$1, discharge_summary=$2, updated_at=NOW() WHERE id=$3`,
          [b.discharge_diagnosis || '', b.discharge_summary || '', segments[1]]
        );
        // Free the bed
        const adm = await pool.query('SELECT bed_id FROM hms_admissions WHERE id=$1', [segments[1]]);
        if (adm.rows[0]?.bed_id) {
          await pool.query(`UPDATE hms_beds SET status='Vacant', current_admission_id=NULL, updated_at=NOW() WHERE id=$1`,
            [adm.rows[0].bed_id]);
        }
        return res.json({ message: 'Patient discharged' });
      }
      // POST /admissions/:id/notes
      if (segments.length === 3 && segments[2] === 'notes' && method === 'POST') {
        const b = req.body || {};
        try {
          await pool.query(
            `INSERT INTO hms_admission_notes (admission_id, note_type, note_text, created_by, created_at)
             VALUES ($1,$2,$3,$4,NOW())`,
            [segments[1], b.note_type || 'Progress', b.note_text || '', b.created_by || 'Admin']
          );
        } catch(e: any) {
          // If table doesn't exist, create it
          if (e.message?.includes('does not exist')) {
            await pool.query(`CREATE TABLE IF NOT EXISTS hms_admission_notes (
              id SERIAL PRIMARY KEY, admission_id INTEGER, note_type VARCHAR DEFAULT 'Progress',
              note_text TEXT, created_by VARCHAR, created_at TIMESTAMPTZ DEFAULT NOW()
            )`);
            await pool.query(
              `INSERT INTO hms_admission_notes (admission_id, note_type, note_text, created_by, created_at)
               VALUES ($1,$2,$3,$4,NOW())`,
              [segments[1], b.note_type || 'Progress', b.note_text || '', b.created_by || 'Admin']
            );
          }
        }
        return res.json({ message: 'Note added' });
      }
    }

    // ========== LAB WORKLIST ==========
    if (segments[0] === 'lab') {
      // GET /lab/worklist
      if (segments[1] === 'worklist' && method === 'GET') {
        const r = await pool.query(`
          SELECT ir.*, p.first_name, p.last_name, p.gender, p.dob,
                 it.name as test_name, it.department, it.type as test_type
          FROM hms_investigation_requests ir
          LEFT JOIN hms_encounters e ON ir.encounter_id = e.id
          LEFT JOIN hms_patients p ON e.patient_id = p.id
          LEFT JOIN hms_investigation_tests it ON ir.test_id = it.id
          ORDER BY ir.created_at DESC
        `);
        return res.json(txAll(r.rows));
      }
      // GET /lab/requests/:id/parameters
      if (segments[1] === 'requests' && segments[3] === 'parameters' && method === 'GET') {
        const r = await pool.query(`
          SELECT * FROM hms_investigation_test_params WHERE test_id = (
            SELECT test_id FROM hms_investigation_requests WHERE id = $1
          ) ORDER BY sort_order`, [segments[2]]);
        return res.json(txAll(r.rows));
      }
      // POST /lab/requests/:id/results
      if (segments[1] === 'requests' && segments[3] === 'results' && method === 'POST') {
        const b = req.body || {};
        const results = b.results || [];
        for (const r of results) {
          await pool.query(
            `INSERT INTO hms_investigation_results (request_id, param_name, value, unit, reference_range, flag, entered_by, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
             ON CONFLICT DO NOTHING`,
            [segments[2], r.param_name, r.value, r.unit || '', r.reference_range || '', r.flag || '', b.entered_by || 1]
          );
        }
        // Update request status
        await pool.query(`UPDATE hms_investigation_requests SET status='Completed', updated_at=NOW() WHERE id=$1`, [segments[2]]);
        return res.json({ message: 'Results saved' });
      }
      // GET /lab/requests/:id/report
      if (segments[1] === 'requests' && segments[3] === 'report' && method === 'GET') {
        const reqR = await pool.query(`
          SELECT ir.*, it.name as test_name, it.department, it.type as test_type,
                 p.first_name, p.last_name, p.gender, p.dob
          FROM hms_investigation_requests ir
          LEFT JOIN hms_investigation_tests it ON ir.test_id = it.id
          LEFT JOIN hms_encounters e ON ir.encounter_id = e.id
          LEFT JOIN hms_patients p ON e.patient_id = p.id
          WHERE ir.id = $1`, [segments[2]]);
        const results = await pool.query(
          `SELECT * FROM hms_investigation_results WHERE request_id = $1 ORDER BY created_at`, [segments[2]]);
        return res.json({
          request: reqR.rows[0] ? tx(reqR.rows[0]) : null,
          results: txAll(results.rows)
        });
      }
    }

    // ========== EXPENSES ==========
    if (segments[0] === 'expenses') {
      if (segments[1] === 'summary' && method === 'GET') {
        const period = req.query?.period || 'monthly';
        const r = await pool.query(`
          SELECT category, SUM(amount) as total, COUNT(*) as count
          FROM hms_expenses GROUP BY category ORDER BY total DESC
        `);
        // Also get budget data
        let budgets: any[] = [];
        try {
          const br = await pool.query('SELECT * FROM hms_budget ORDER BY category');
          budgets = txAll(br.rows);
        } catch(e) { /* table may not exist */ }
        return res.json({ expenses: txAll(r.rows), budgets, period });
      }
      if (segments.length === 1 && method === 'GET') {
        const from = req.query?.from || '2020-01-01';
        const to = req.query?.to || '2099-12-31';
        const cat = req.query?.category;
        let q = `SELECT * FROM hms_expenses WHERE expense_date >= $1 AND expense_date <= $2`;
        const params: any[] = [from, to];
        if (cat && cat !== 'all') {
          q += ` AND category = $3`;
          params.push(cat);
        }
        q += ` ORDER BY expense_date DESC`;
        const r = await pool.query(q, params);
        return res.json(txAll(r.rows));
      }
      if (segments.length === 1 && method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_expenses (category, description, amount, expense_date, payment_method, vendor, receipt_number, recorded_by, notes, created_at)
           VALUES ($1,$2,$3,COALESCE($4::date,CURRENT_DATE),$5,$6,$7,$8,$9,NOW()) RETURNING *`,
          [b.category, b.description || '', b.amount, b.expense_date || null, b.payment_method || 'Cash',
           b.vendor || '', b.receipt_number || '', b.recorded_by || 'Admin', b.notes || '']
        );
        return res.status(201).json(tx(r.rows[0]));
      }
      // PUT /expenses/:id
      if (segments.length === 2 && method === 'PUT') {
        const b = req.body || {};
        const r = await pool.query(
          `UPDATE hms_expenses SET category=COALESCE($1,category), description=COALESCE($2,description),
           amount=COALESCE($3,amount), expense_date=COALESCE($4::date,expense_date) WHERE id=$5 RETURNING *`,
          [b.category, b.description, b.amount, b.expense_date || null, segments[1]]
        );
        return res.json(tx(r.rows[0]));
      }
    }

    // ========== BUDGETS ==========
    if (segments[0] === 'budgets') {
      if (method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_budget ORDER BY category');
        return res.json(txAll(r.rows));
      }
      if (method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_budget (category, period, budget_amount, created_at, updated_at)
           VALUES ($1,$2,$3,NOW(),NOW())
           ON CONFLICT DO NOTHING RETURNING *`,
          [b.category, b.period, b.budget_amount || 0]
        );
        return res.status(201).json(r.rows[0] ? tx(r.rows[0]) : { message: 'Budget exists' });
      }
    }

    // ========== INSURANCE CLAIMS ==========
    if (segments[0] === 'claims') {
      if (method === 'GET') {
        const r = await pool.query(`
          SELECT c.*, p.first_name, p.last_name, s.scheme_name
          FROM hms_insurance_claims c
          LEFT JOIN hms_patients p ON c.patient_id = p.id
          LEFT JOIN hms_insurance_schemes s ON c.scheme_id = s.id
          ORDER BY c.created_at DESC
        `);
        return res.json(txAll(r.rows));
      }
      if (method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_insurance_claims (patient_id, scheme_id, encounter_id, claim_amount, status, diagnosis, notes, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'Pending',$5,$6,NOW(),NOW()) RETURNING *`,
          [b.patient_id, b.scheme_id, b.encounter_id || null, b.claim_amount || 0, b.diagnosis || '', b.notes || '']
        );
        return res.status(201).json(tx(r.rows[0]));
      }
    }

    // ========== INSURANCE SCHEMES ==========
    if (segments[0] === 'insurance') {
      if (segments[1] === 'schemes' && method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_insurance_schemes WHERE is_active = true ORDER BY scheme_name');
        return res.json(txAll(r.rows));
      }
      if (segments[1] === 'schemes' && method === 'POST') {
        const b = req.body || {};
        const r = await pool.query(
          `INSERT INTO hms_insurance_schemes (scheme_name, scheme_type, provider, contact_phone, contact_email, benefit_packages, is_active, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,true,NOW(),NOW()) RETURNING *`,
          [b.scheme_name, b.scheme_type || 'NHIF', b.provider || '', b.contact_phone || '', b.contact_email || '',
           JSON.stringify(b.benefit_packages || [])]
        );
        return res.status(201).json(tx(r.rows[0]));
      }
    }

    // ========== MESSAGING ==========
    if (segments[0] === 'messaging') {
      if (segments[1] === 'templates' && method === 'GET') {
        try {
          const r = await pool.query('SELECT * FROM hms_sms_templates WHERE is_active = true ORDER BY name');
          return res.json(txAll(r.rows));
        } catch(e) {
          return res.json([
            { id: 1, name: 'Appointment Reminder', body: 'Dear {{patient_name}}, your appointment is on {{date}} at {{time}}. Please arrive 15 minutes early.', category: 'Appointment' },
            { id: 2, name: 'Lab Results Ready', body: 'Dear {{patient_name}}, your lab results are ready. Please visit the facility to collect them.', category: 'Lab' },
            { id: 3, name: 'Payment Receipt', body: 'Dear {{patient_name}}, payment of KES {{amount}} received. Receipt: {{receipt_no}}. Thank you.', category: 'Billing' },
          ]);
        }
      }
      if (segments[1] === 'history' && method === 'GET') {
        try {
          const r = await pool.query('SELECT * FROM hms_sms_logs ORDER BY created_at DESC LIMIT 100');
          return res.json(txAll(r.rows));
        } catch(e) { return res.json([]); }
      }
      if (segments[1] === 'send' && method === 'POST') {
        const b = req.body || {};
        // Log the message (actual SMS sending would need Africa's Talking integration)
        try {
          await pool.query(
            `INSERT INTO hms_sms_logs (recipient_phone, recipient_name, message, message_type, status, sent_by, created_at)
             VALUES ($1,$2,$3,'Custom','Queued',$4,NOW())`,
            [b.phone, b.recipient_name || '', b.message, 'Admin']
          );
        } catch(e: any) {
          if (e.message?.includes('does not exist')) {
            await pool.query(`CREATE TABLE IF NOT EXISTS hms_sms_logs (
              id SERIAL PRIMARY KEY, recipient_phone VARCHAR, recipient_name VARCHAR,
              message TEXT, message_type VARCHAR DEFAULT 'Custom', status VARCHAR DEFAULT 'Queued',
              sent_by VARCHAR, created_at TIMESTAMPTZ DEFAULT NOW()
            )`);
          }
        }
        return res.json({ message: 'Message queued', status: 'Queued' });
      }
      if (segments[1] === 'bulk' && method === 'POST') {
        return res.json({ message: 'Bulk messages queued', count: 0 });
      }
    }

    // ========== PHARMACY ==========
    if (segments[0] === 'pharmacy') {
      // GET /pharmacy/queue - prescriptions awaiting dispensing
      if (segments[1] === 'queue' && method === 'GET') {
        try {
          const r = await pool.query(`
            SELECT pr.*, p.first_name, p.last_name, p.gender, p.dob
            FROM hms_prescriptions pr
            LEFT JOIN hms_encounters e ON pr.encounter_id = e.id
            LEFT JOIN hms_patients p ON e.patient_id = p.id
            WHERE pr.status IN ('Pending','Partial')
            ORDER BY pr.created_at DESC
          `);
          return res.json(txAll(r.rows));
        } catch(e) { return res.json([]); }
      }
      // GET /pharmacy/history
      if (segments[1] === 'history' && method === 'GET') {
        try {
          const r = await pool.query(`
            SELECT pr.*, p.first_name, p.last_name
            FROM hms_prescriptions pr
            LEFT JOIN hms_encounters e ON pr.encounter_id = e.id
            LEFT JOIN hms_patients p ON e.patient_id = p.id
            WHERE pr.status = 'Dispensed'
            ORDER BY pr.updated_at DESC LIMIT 100
          `);
          return res.json(txAll(r.rows));
        } catch(e) { return res.json([]); }
      }
      // GET /pharmacy/formulary
      if (segments[1] === 'formulary' && method === 'GET') {
        try {
          const r = await pool.query(`SELECT * FROM hms_formulary WHERE is_active = true ORDER BY drug_name`);
          return res.json(txAll(r.rows));
        } catch(e) {
          // Fall back to Products table
          try {
            const r2 = await pool.query(`SELECT * FROM "Products" ORDER BY "productName"`);
            return res.json(txAll(r2.rows));
          } catch(e2) { return res.json([]); }
        }
      }
      // GET /pharmacy/prescriptions/:id
      if (segments[1] === 'prescriptions' && segments.length >= 3 && method === 'GET') {
        try {
          const r = await pool.query(`
            SELECT pr.*, pi.*, p.first_name, p.last_name
            FROM hms_prescriptions pr
            LEFT JOIN hms_prescription_items pi ON pr.id = pi.prescription_id
            LEFT JOIN hms_encounters e ON pr.encounter_id = e.id
            LEFT JOIN hms_patients p ON e.patient_id = p.id
            WHERE pr.id = $1`, [segments[2]]);
          return res.json(txAll(r.rows));
        } catch(e) { return res.json([]); }
      }
      // POST /pharmacy/prescriptions/:id/dispense
      if (segments[1] === 'prescriptions' && segments[3] === 'dispense' && method === 'POST') {
        try {
          await pool.query(`UPDATE hms_prescriptions SET status='Dispensed', dispensed_at=NOW(), updated_at=NOW() WHERE id=$1`, [segments[2]]);
          return res.json({ message: 'Prescription dispensed' });
        } catch(e) { return res.json({ message: 'Dispensed (stub)' }); }
      }
    }

    // ========== ADMIN PANEL ==========
    if (segments[0] === 'admin') {
      // GET /admin/users
      if (segments[1] === 'users' && method === 'GET') {
        const r = await pool.query(`
          SELECT id, name, email, role, created_at, updated_at
          FROM hms_users ORDER BY id
        `);
        return res.json(txAll(r.rows));
      }
      // POST /admin/users
      if (segments[1] === 'users' && method === 'POST') {
        const b = req.body || {};
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(b.password || '1234', 10);
        const r = await pool.query(
          `INSERT INTO hms_users (name, email, password, role, created_at, updated_at)
           VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id, name, email, role`,
          [b.name, b.email, hash, b.role || 'user']
        );
        return res.status(201).json(tx(r.rows[0]));
      }
      // GET /admin/roles
      if (segments[1] === 'roles' && method === 'GET') {
        const r = await pool.query('SELECT * FROM hms_user_roles ORDER BY id');
        return res.json(txAll(r.rows));
      }
      // GET /admin/audit-log
      if ((segments[1] === 'audit-log' || segments[1] === 'audit_log') && method === 'GET') {
        try {
          const from = req.query?.from || '2020-01-01';
          const to = req.query?.to || '2099-12-31';
          const resource = req.query?.resource;
          let q = `SELECT * FROM hms_audit_log WHERE created_at >= $1::date AND created_at <= $2::date`;
          const params: any[] = [from, to];
          if (resource && resource !== 'all') {
            q += ` AND resource_name = $3`;
            params.push(resource);
          }
          q += ` ORDER BY created_at DESC LIMIT 200`;
          const r = await pool.query(q, params);
          return res.json(txAll(r.rows));
        } catch(e) { return res.json([]); }
      }
      // GET /admin/settings
      if (segments[1] === 'settings' && method === 'GET') {
        try {
          const r = await pool.query('SELECT * FROM hms_settings');
          const settings: Record<string, any> = {};
          r.rows.forEach((row: any) => { settings[row.setting_key] = row.setting_value; });
          return res.json(settings);
        } catch(e) {
          return res.json({
            facility_name: 'Hospital Management System',
            currency: 'KES',
            timezone: 'Africa/Nairobi',
            date_format: 'DD/MM/YYYY'
          });
        }
      }
    }

    // ========== JOB TITLES ==========
    if (segments[0] === 'job-titles') {
      if (method === 'GET') {
        try {
          const r = await pool.query('SELECT * FROM hms_job_titles WHERE is_active = true ORDER BY title');
          return res.json(txAll(r.rows));
        } catch(e) {
          // Return default job titles
          return res.json([
            'Doctor', 'Nurse', 'Pharmacist', 'Lab Technician', 'Radiologist',
            'Receptionist', 'Administrator', 'Accountant', 'Surgeon', 'Dentist',
            'Physiotherapist', 'Clinical Officer', 'Community Health Worker'
          ]);
        }
      }
    }

    // ========== ICD-10 SEARCH ==========
    if (segments[0] === 'icd10') {
      if (segments[1] === 'search' && method === 'GET') {
        const q = (String(req.query?.q || '')).trim().toLowerCase();
        if (!q || q.length < 2) return res.json([]);

        // Comprehensive ICD-10 code dataset
        const ICD10_CODES: { code: string; description: string }[] = [
          // Infectious & Parasitic Diseases
          { code: 'A00', description: 'Cholera' },
          { code: 'A01.0', description: 'Typhoid fever' },
          { code: 'A02.0', description: 'Salmonella enteritis' },
          { code: 'A03.9', description: 'Shigellosis, unspecified' },
          { code: 'A04.7', description: 'Enterocolitis due to Clostridium difficile' },
          { code: 'A05.9', description: 'Bacterial foodborne intoxication, unspecified' },
          { code: 'A06.0', description: 'Acute amoebic dysentery' },
          { code: 'A06.9', description: 'Amoebiasis, unspecified' },
          { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified' },
          { code: 'A15.0', description: 'Tuberculosis of lung' },
          { code: 'A15.9', description: 'Respiratory tuberculosis unspecified' },
          { code: 'A16.9', description: 'Respiratory tuberculosis, unspecified, without bacteriological confirmation' },
          { code: 'A17.0', description: 'Tuberculous meningitis' },
          { code: 'A18.0', description: 'Tuberculosis of bones and joints' },
          { code: 'A30.9', description: 'Leprosy, unspecified' },
          { code: 'A37.9', description: 'Whooping cough, unspecified' },
          { code: 'A38', description: 'Scarlet fever' },
          { code: 'A39.0', description: 'Meningococcal meningitis' },
          { code: 'A41.9', description: 'Sepsis, unspecified organism' },
          { code: 'A46', description: 'Erysipelas' },
          { code: 'A49.9', description: 'Bacterial infection, unspecified' },
          { code: 'A50.9', description: 'Congenital syphilis, unspecified' },
          { code: 'A54.9', description: 'Gonococcal infection, unspecified' },
          { code: 'A60.0', description: 'Herpesviral infection of genitalia' },
          { code: 'A69.2', description: 'Lyme disease' },
          { code: 'A82.9', description: 'Rabies, unspecified' },
          { code: 'A90', description: 'Dengue fever (classical dengue)' },
          { code: 'A91', description: 'Dengue haemorrhagic fever' },
          { code: 'A95.9', description: 'Yellow fever, unspecified' },
          { code: 'B00.9', description: 'Herpesviral infection, unspecified' },
          { code: 'B01.9', description: 'Varicella (chickenpox) without complication' },
          { code: 'B02.9', description: 'Zoster (herpes zoster/shingles) without complication' },
          { code: 'B05.9', description: 'Measles without complication' },
          { code: 'B06.9', description: 'Rubella without complication' },
          { code: 'B15.9', description: 'Hepatitis A without hepatic coma' },
          { code: 'B16.9', description: 'Acute hepatitis B without delta-agent' },
          { code: 'B17.1', description: 'Acute hepatitis C' },
          { code: 'B18.1', description: 'Chronic viral hepatitis B' },
          { code: 'B18.2', description: 'Chronic viral hepatitis C' },
          { code: 'B20', description: 'Human immunodeficiency virus [HIV] disease' },
          { code: 'B24', description: 'Unspecified human immunodeficiency virus [HIV] disease' },
          { code: 'B26.9', description: 'Mumps without complication' },
          { code: 'B35.0', description: 'Tinea barbae and tinea capitis (ringworm)' },
          { code: 'B35.1', description: 'Tinea unguium (nail fungus)' },
          { code: 'B36.0', description: 'Pityriasis versicolor' },
          { code: 'B37.0', description: 'Candidal stomatitis (oral thrush)' },
          { code: 'B37.3', description: 'Candidiasis of vulva and vagina' },
          { code: 'B50.9', description: 'Plasmodium falciparum malaria, unspecified' },
          { code: 'B51.9', description: 'Plasmodium vivax malaria without complication' },
          { code: 'B54', description: 'Unspecified malaria' },
          { code: 'B65.1', description: 'Schistosomiasis due to S. mansoni (bilharzia)' },
          { code: 'B68.9', description: 'Taeniasis, unspecified (tapeworm)' },
          { code: 'B73', description: 'Onchocerciasis (river blindness)' },
          { code: 'B76.9', description: 'Hookworm disease, unspecified' },
          { code: 'B77.9', description: 'Ascariasis, unspecified (roundworm)' },
          { code: 'B82.0', description: 'Intestinal helminthiasis, unspecified' },
          { code: 'B86', description: 'Scabies' },

          // Neoplasms
          { code: 'C18.9', description: 'Malignant neoplasm of colon, unspecified' },
          { code: 'C34.9', description: 'Malignant neoplasm of bronchus or lung, unspecified' },
          { code: 'C50.9', description: 'Malignant neoplasm of breast, unspecified' },
          { code: 'C53.9', description: 'Malignant neoplasm of cervix uteri, unspecified' },
          { code: 'C56', description: 'Malignant neoplasm of ovary' },
          { code: 'C61', description: 'Malignant neoplasm of prostate' },
          { code: 'C67.9', description: 'Malignant neoplasm of bladder, unspecified' },
          { code: 'C71.9', description: 'Malignant neoplasm of brain, unspecified' },
          { code: 'C73', description: 'Malignant neoplasm of thyroid gland' },
          { code: 'C91.0', description: 'Acute lymphoblastic leukaemia' },
          { code: 'D50.9', description: 'Iron deficiency anaemia, unspecified' },

          // Endocrine, Nutritional & Metabolic
          { code: 'E03.9', description: 'Hypothyroidism, unspecified' },
          { code: 'E05.9', description: 'Thyrotoxicosis (hyperthyroidism), unspecified' },
          { code: 'E10', description: 'Type 1 diabetes mellitus' },
          { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications' },
          { code: 'E11', description: 'Type 2 diabetes mellitus' },
          { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
          { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
          { code: 'E13.9', description: 'Other specified diabetes mellitus without complications' },
          { code: 'E40', description: 'Kwashiorkor' },
          { code: 'E41', description: 'Nutritional marasmus' },
          { code: 'E43', description: 'Unspecified severe protein-calorie malnutrition' },
          { code: 'E44.0', description: 'Moderate protein-calorie malnutrition' },
          { code: 'E46', description: 'Unspecified protein-calorie malnutrition' },
          { code: 'E55.9', description: 'Vitamin D deficiency, unspecified' },
          { code: 'E66.9', description: 'Obesity, unspecified' },
          { code: 'E78.5', description: 'Hyperlipidaemia, unspecified' },
          { code: 'E86.0', description: 'Dehydration' },
          { code: 'E87.6', description: 'Hypokalaemia' },

          // Mental & Behavioural Disorders
          { code: 'F10.2', description: 'Alcohol dependence syndrome' },
          { code: 'F20.9', description: 'Schizophrenia, unspecified' },
          { code: 'F31.9', description: 'Bipolar affective disorder, unspecified' },
          { code: 'F32.9', description: 'Depressive episode, unspecified' },
          { code: 'F33.9', description: 'Recurrent depressive disorder, unspecified' },
          { code: 'F41.0', description: 'Panic disorder' },
          { code: 'F41.1', description: 'Generalized anxiety disorder' },
          { code: 'F41.9', description: 'Anxiety disorder, unspecified' },
          { code: 'F43.1', description: 'Post-traumatic stress disorder' },
          { code: 'F45.9', description: 'Somatoform disorder, unspecified' },

          // Diseases of the Nervous System
          { code: 'G03.9', description: 'Meningitis, unspecified' },
          { code: 'G20', description: "Parkinson's disease" },
          { code: 'G30.9', description: "Alzheimer's disease, unspecified" },
          { code: 'G40.9', description: 'Epilepsy, unspecified' },
          { code: 'G43.9', description: 'Migraine, unspecified' },
          { code: 'G44.1', description: 'Vascular headache, not elsewhere classified' },
          { code: 'G47.0', description: 'Insomnia' },
          { code: 'G51.0', description: "Bell's palsy (facial nerve palsy)" },
          { code: 'G61.0', description: 'Guillain-Barré syndrome' },

          // Diseases of the Eye
          { code: 'H10.9', description: 'Conjunctivitis, unspecified' },
          { code: 'H25.9', description: 'Senile cataract, unspecified' },
          { code: 'H40.9', description: 'Glaucoma, unspecified' },
          { code: 'H66.9', description: 'Otitis media, unspecified' },

          // Diseases of the Circulatory System
          { code: 'I10', description: 'Essential (primary) hypertension' },
          { code: 'I11.9', description: 'Hypertensive heart disease without heart failure' },
          { code: 'I13.9', description: 'Hypertensive heart and renal disease, unspecified' },
          { code: 'I20.9', description: 'Angina pectoris, unspecified' },
          { code: 'I21.9', description: 'Acute myocardial infarction, unspecified' },
          { code: 'I25.9', description: 'Chronic ischaemic heart disease, unspecified' },
          { code: 'I42.9', description: 'Cardiomyopathy, unspecified' },
          { code: 'I48.9', description: 'Atrial fibrillation and flutter, unspecified' },
          { code: 'I50.9', description: 'Heart failure, unspecified' },
          { code: 'I63.9', description: 'Cerebral infarction (stroke), unspecified' },
          { code: 'I64', description: 'Stroke, not specified as haemorrhage or infarction' },
          { code: 'I70.9', description: 'Generalized atherosclerosis' },
          { code: 'I80.9', description: 'Deep vein thrombosis (DVT), unspecified' },
          { code: 'I83.9', description: 'Varicose veins of lower extremities' },

          // Diseases of the Respiratory System
          { code: 'J00', description: 'Acute nasopharyngitis (common cold)' },
          { code: 'J01.9', description: 'Acute sinusitis, unspecified' },
          { code: 'J02.9', description: 'Acute pharyngitis (sore throat), unspecified' },
          { code: 'J03.9', description: 'Acute tonsillitis, unspecified' },
          { code: 'J04.0', description: 'Acute laryngitis' },
          { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
          { code: 'J09', description: 'Influenza due to identified novel influenza A virus' },
          { code: 'J10.1', description: 'Influenza with other respiratory manifestations' },
          { code: 'J11.1', description: 'Influenza with other respiratory manifestations, virus not identified' },
          { code: 'J12.9', description: 'Viral pneumonia, unspecified' },
          { code: 'J15.9', description: 'Bacterial pneumonia, unspecified' },
          { code: 'J18.0', description: 'Bronchopneumonia, unspecified' },
          { code: 'J18.9', description: 'Pneumonia, unspecified organism' },
          { code: 'J20.9', description: 'Acute bronchitis, unspecified' },
          { code: 'J21.9', description: 'Acute bronchiolitis, unspecified' },
          { code: 'J30.1', description: 'Allergic rhinitis due to pollen' },
          { code: 'J31.0', description: 'Chronic rhinitis' },
          { code: 'J40', description: 'Bronchitis, not specified as acute or chronic' },
          { code: 'J42', description: 'Unspecified chronic bronchitis' },
          { code: 'J44.9', description: 'Chronic obstructive pulmonary disease (COPD), unspecified' },
          { code: 'J45.9', description: 'Asthma, unspecified' },
          { code: 'J46', description: 'Status asthmaticus (acute severe asthma)' },
          { code: 'J90', description: 'Pleural effusion, not elsewhere classified' },
          { code: 'J96.9', description: 'Respiratory failure, unspecified' },

          // Diseases of the Digestive System
          { code: 'K02.9', description: 'Dental caries, unspecified' },
          { code: 'K04.7', description: 'Periapical abscess without sinus' },
          { code: 'K21.0', description: 'Gastro-oesophageal reflux disease (GERD)' },
          { code: 'K25.9', description: 'Gastric ulcer, unspecified' },
          { code: 'K26.9', description: 'Duodenal ulcer, unspecified' },
          { code: 'K27.9', description: 'Peptic ulcer, site unspecified' },
          { code: 'K29.7', description: 'Gastritis, unspecified' },
          { code: 'K30', description: 'Functional dyspepsia' },
          { code: 'K35.9', description: 'Acute appendicitis, unspecified' },
          { code: 'K40.9', description: 'Inguinal hernia without obstruction or gangrene' },
          { code: 'K52.9', description: 'Non-infective gastroenteritis and colitis, unspecified' },
          { code: 'K56.6', description: 'Intestinal obstruction, unspecified' },
          { code: 'K58.9', description: 'Irritable bowel syndrome (IBS)' },
          { code: 'K59.0', description: 'Constipation' },
          { code: 'K70.3', description: 'Alcoholic cirrhosis of liver' },
          { code: 'K74.6', description: 'Other and unspecified cirrhosis of liver' },
          { code: 'K76.0', description: 'Fatty (change of) liver, not elsewhere classified' },
          { code: 'K80.2', description: 'Calculus of gallbladder without cholecystitis (gallstones)' },
          { code: 'K85.9', description: 'Acute pancreatitis, unspecified' },
          { code: 'K92.0', description: 'Haematemesis (vomiting blood)' },
          { code: 'K92.2', description: 'Gastrointestinal haemorrhage, unspecified' },

          // Diseases of the Skin
          { code: 'L02.9', description: 'Cutaneous abscess, furuncle and carbuncle, unspecified' },
          { code: 'L03.9', description: 'Cellulitis, unspecified' },
          { code: 'L08.9', description: 'Local infection of skin, unspecified' },
          { code: 'L20.9', description: 'Atopic dermatitis (eczema), unspecified' },
          { code: 'L30.9', description: 'Dermatitis, unspecified' },
          { code: 'L40.9', description: 'Psoriasis, unspecified' },
          { code: 'L50.9', description: 'Urticaria (hives), unspecified' },
          { code: 'L60.0', description: 'Ingrowing nail' },
          { code: 'L70.0', description: 'Acne vulgaris' },
          { code: 'L72.0', description: 'Epidermal cyst' },

          // Diseases of the Musculoskeletal System
          { code: 'M06.9', description: 'Rheumatoid arthritis, unspecified' },
          { code: 'M10.9', description: 'Gout, unspecified' },
          { code: 'M13.9', description: 'Arthritis, unspecified' },
          { code: 'M17.9', description: 'Osteoarthritis of knee' },
          { code: 'M19.9', description: 'Osteoarthritis, unspecified' },
          { code: 'M25.5', description: 'Pain in joint' },
          { code: 'M54.5', description: 'Low back pain' },
          { code: 'M54.9', description: 'Dorsalgia (back pain), unspecified' },
          { code: 'M79.1', description: 'Myalgia (muscle pain)' },
          { code: 'M79.3', description: 'Panniculitis, unspecified' },

          // Diseases of the Genitourinary System
          { code: 'N10', description: 'Acute tubulo-interstitial nephritis (pyelonephritis)' },
          { code: 'N12', description: 'Tubulo-interstitial nephritis, not specified as acute or chronic' },
          { code: 'N17.9', description: 'Acute kidney failure, unspecified' },
          { code: 'N18.9', description: 'Chronic kidney disease, unspecified' },
          { code: 'N20.0', description: 'Calculus of kidney (kidney stones)' },
          { code: 'N23', description: 'Unspecified renal colic' },
          { code: 'N30.0', description: 'Acute cystitis' },
          { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
          { code: 'N40', description: 'Benign prostatic hyperplasia (enlarged prostate)' },
          { code: 'N72', description: 'Inflammatory disease of cervix uteri' },
          { code: 'N73.0', description: 'Acute parametritis and pelvic cellulitis' },
          { code: 'N76.0', description: 'Acute vaginitis' },
          { code: 'N92.0', description: 'Excessive and frequent menstruation with regular cycle' },
          { code: 'N94.6', description: 'Dysmenorrhoea, unspecified' },

          // Pregnancy, Childbirth & Puerperium
          { code: 'O03.9', description: 'Complete or unspecified spontaneous abortion' },
          { code: 'O06.9', description: 'Unspecified abortion, complete, without complication' },
          { code: 'O13', description: 'Gestational hypertension without significant proteinuria' },
          { code: 'O14.9', description: 'Pre-eclampsia, unspecified' },
          { code: 'O15.0', description: 'Eclampsia in pregnancy' },
          { code: 'O20.0', description: 'Threatened abortion' },
          { code: 'O24.9', description: 'Diabetes mellitus in pregnancy, unspecified' },
          { code: 'O42.9', description: 'Premature rupture of membranes, unspecified' },
          { code: 'O46.9', description: 'Antepartum haemorrhage, unspecified' },
          { code: 'O60.0', description: 'Preterm labour without delivery' },
          { code: 'O72.1', description: 'Postpartum haemorrhage' },
          { code: 'O80', description: 'Single spontaneous delivery (normal delivery)' },
          { code: 'O85', description: 'Puerperal sepsis' },
          { code: 'O99.0', description: 'Anaemia complicating pregnancy, childbirth and puerperium' },
          { code: 'Z34.0', description: 'Supervision of normal first pregnancy' },
          { code: 'Z34.9', description: 'Supervision of normal pregnancy, unspecified' },

          // Perinatal Period
          { code: 'P07.3', description: 'Other preterm infants' },
          { code: 'P22.9', description: 'Respiratory distress of newborn, unspecified' },
          { code: 'P36.9', description: 'Bacterial sepsis of newborn, unspecified' },
          { code: 'P59.9', description: 'Neonatal jaundice, unspecified' },

          // Symptoms, Signs & Abnormal Findings
          { code: 'R05', description: 'Cough' },
          { code: 'R06.0', description: 'Dyspnoea (shortness of breath)' },
          { code: 'R07.9', description: 'Chest pain, unspecified' },
          { code: 'R10.4', description: 'Other and unspecified abdominal pain' },
          { code: 'R10.9', description: 'Unspecified abdominal pain' },
          { code: 'R11', description: 'Nausea and vomiting' },
          { code: 'R19.7', description: 'Diarrhoea, unspecified' },
          { code: 'R21', description: 'Rash and other nonspecific skin eruption' },
          { code: 'R31', description: 'Haematuria' },
          { code: 'R42', description: 'Dizziness and giddiness' },
          { code: 'R50.9', description: 'Fever, unspecified' },
          { code: 'R51', description: 'Headache' },
          { code: 'R53', description: 'Malaise and fatigue' },
          { code: 'R55', description: 'Syncope and collapse (fainting)' },
          { code: 'R56.0', description: 'Febrile convulsions' },
          { code: 'R60.0', description: 'Localized oedema (swelling)' },
          { code: 'R63.0', description: 'Anorexia (loss of appetite)' },
          { code: 'R73.9', description: 'Hyperglycaemia, unspecified' },

          // Injury & Poisoning
          { code: 'S00.9', description: 'Superficial injury of head, unspecified' },
          { code: 'S01.9', description: 'Open wound of head, unspecified' },
          { code: 'S06.0', description: 'Concussion' },
          { code: 'S09.9', description: 'Unspecified injury of head' },
          { code: 'S22.3', description: 'Fracture of rib' },
          { code: 'S42.0', description: 'Fracture of clavicle' },
          { code: 'S52.9', description: 'Fracture of forearm, unspecified' },
          { code: 'S62.6', description: 'Fracture of other finger' },
          { code: 'S72.9', description: 'Fracture of femur, unspecified' },
          { code: 'S82.9', description: 'Fracture of lower leg, unspecified' },
          { code: 'S93.4', description: 'Sprain and strain of ankle' },
          { code: 'T14.9', description: 'Injury, unspecified' },
          { code: 'T30.0', description: 'Burn of unspecified body region, unspecified degree' },
          { code: 'T63.0', description: 'Toxic effect of snake venom' },
          { code: 'T65.9', description: 'Toxic effect of unspecified substance' },
          { code: 'T78.4', description: 'Allergy, unspecified' },

          // External Causes
          { code: 'V89.2', description: 'Road traffic accident (RTA), unspecified' },
          { code: 'W19', description: 'Unspecified fall' },
          { code: 'X58', description: 'Exposure to other specified factors' },

          // Factors Influencing Health Status
          { code: 'Z00.0', description: 'General medical examination' },
          { code: 'Z01.0', description: 'Examination of eyes and vision' },
          { code: 'Z09.9', description: 'Follow-up examination after treatment, unspecified' },
          { code: 'Z23', description: 'Need for immunization against single bacterial diseases' },
          { code: 'Z30.0', description: 'General counselling on contraception' },
          { code: 'Z71.1', description: 'Person with feared complaint - no diagnosis made' },
          { code: 'Z76.0', description: 'Issue of repeat prescription' },

          // Blood Diseases
          { code: 'D50.0', description: 'Iron deficiency anaemia secondary to blood loss' },
          { code: 'D56.9', description: 'Thalassaemia, unspecified' },
          { code: 'D57.1', description: 'Sickle-cell disease without crisis' },
          { code: 'D64.9', description: 'Anaemia, unspecified' },
          { code: 'D69.6', description: 'Thrombocytopenia, unspecified' },
        ];

        const results = ICD10_CODES.filter(entry =>
          entry.code.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q)
        ).slice(0, 30);

        return res.json(results);
      }
      return res.status(404).json({ message: 'ICD-10 route not found' });
    }

    // ========== FALLBACK ==========
    console.warn(`⚠️ No handler: ${method} ${path}`);
    return res.status(404).json({ message: `Route not found: ${method} ${path}` });

  } catch (error: any) {
    console.error(`❌ Error (${method} ${path}):`, error.message);
    // If table doesn't exist, return empty array
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      return res.json([]);
    }
    return res.status(500).json({ error: error.message, path });
  }
};
