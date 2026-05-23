import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

const getDateRange = (req: Request) => {
  const from = req.query.from as string || new Date(new Date().setDate(1)).toISOString().split('T')[0];
  const to = req.query.to as string || new Date().toISOString().split('T')[0];
  return { from, to };
};

// ─── Clinical Reports ─────────────────────────────────────────────────────────
export const getClinicalReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(req);

    const [patientVisits, encounterTypes, topDiagnoses, providerWorkload] = await Promise.all([
      // Patient visits by date
      sequelize.query(
        `SELECT DATE(created_at) AS visit_date, COUNT(*) AS count
         FROM hms_encounters
         WHERE DATE(created_at) BETWEEN $1 AND $2
         GROUP BY DATE(created_at) ORDER BY visit_date`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
      // Encounter type breakdown
      sequelize.query(
        `SELECT encounter_type, COUNT(*) AS count
         FROM hms_encounters
         WHERE DATE(created_at) BETWEEN $1 AND $2
         GROUP BY encounter_type ORDER BY count DESC`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
      // Top 10 diagnoses
      sequelize.query(
        `SELECT icd10_code, icd10_description, COUNT(*) AS count
         FROM hms_diagnoses
         WHERE DATE(created_at) BETWEEN $1 AND $2
         GROUP BY icd10_code, icd10_description
         ORDER BY count DESC LIMIT 10`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
      // Provider workload
      sequelize.query(
        `SELECT s.first_name || ' ' || s.last_name AS provider_name,
                s.job_title, COUNT(e.id) AS encounter_count
         FROM hms_encounters e
         JOIN hms_staff s ON e.provider_id = s.id
         WHERE DATE(e.created_at) BETWEEN $1 AND $2
         GROUP BY s.id, s.first_name, s.last_name, s.job_title
         ORDER BY encounter_count DESC`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
    ]);

    res.json({ from, to, patientVisits, encounterTypes, topDiagnoses, providerWorkload });
  } catch (err) {
    console.error('getClinicalReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Financial Reports ────────────────────────────────────────────────────────
export const getFinancialReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(req);

    const [revenueByMethod, outstandingInvoices, dailySummary, posRevenue] = await Promise.all([
      // Revenue by payment method
      sequelize.query(
        `SELECT payment_method, COUNT(*) AS transaction_count,
                SUM(total_amount) AS total_revenue
         FROM hms_pos_sales
         WHERE DATE(created_at) BETWEEN $1 AND $2
           AND status = 'Completed'
         GROUP BY payment_method`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
      // Outstanding invoices
      sequelize.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
         FROM hms_invoices
         WHERE status = 'unpaid'`,
        { type: QueryTypes.SELECT }
      ),
      // Daily revenue summary
      sequelize.query(
        `SELECT DATE(created_at) AS sale_date,
                COUNT(*) AS transactions,
                SUM(total_amount) AS revenue
         FROM hms_pos_sales
         WHERE DATE(created_at) BETWEEN $1 AND $2
           AND status = 'Completed'
         GROUP BY DATE(created_at) ORDER BY sale_date`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
      // Total POS revenue
      sequelize.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue,
                COUNT(*) AS total_transactions
         FROM hms_pos_sales
         WHERE DATE(created_at) BETWEEN $1 AND $2
           AND status = 'Completed'`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
    ]);

    res.json({ from, to, revenueByMethod, outstandingInvoices, dailySummary, posRevenue });
  } catch (err) {
    console.error('getFinancialReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Inventory Reports ────────────────────────────────────────────────────────
export const getInventoryReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(req);

    const [stockLevels, lowStock, expiringItems] = await Promise.all([
      // All stock levels
      sequelize.query(
        `SELECT name, category, quantity AS available_qty,
                selling_price, expiry_date, status
         FROM hms_stock
         ORDER BY category, name`,
        { type: QueryTypes.SELECT }
      ),
      // Low stock (below 10 units)
      sequelize.query(
        `SELECT name, category, quantity AS available_qty, selling_price
         FROM hms_stock
         WHERE quantity <= 10 AND quantity > 0
         ORDER BY quantity ASC`,
        { type: QueryTypes.SELECT }
      ),
      // Expiring within 30 days
      sequelize.query(
        `SELECT name, category, quantity AS available_qty,
                expiry_date,
                (expiry_date::date - CURRENT_DATE) AS days_to_expiry
         FROM hms_stock
         WHERE expiry_date IS NOT NULL
           AND expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'
           AND expiry_date::date >= CURRENT_DATE
         ORDER BY expiry_date ASC`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    res.json({ from, to, stockLevels, lowStock, expiringItems });
  } catch (err) {
    console.error('getInventoryReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Patient Reports ──────────────────────────────────────────────────────────
export const getPatientReport = async (req: Request, res: Response) => {
  try {
    const { from, to } = getDateRange(req);

    const [newRegistrations, genderBreakdown, ageGroups, countyBreakdown] = await Promise.all([
      // New registrations by date
      sequelize.query(
        `SELECT DATE(created_at) AS reg_date, COUNT(*) AS count
         FROM hms_patients
         WHERE DATE(created_at) BETWEEN $1 AND $2
         GROUP BY DATE(created_at) ORDER BY reg_date`,
        { bind: [from, to], type: QueryTypes.SELECT }
      ),
      // Gender breakdown
      sequelize.query(
        `SELECT gender, COUNT(*) AS count
         FROM hms_patients
         GROUP BY gender`,
        { type: QueryTypes.SELECT }
      ),
      // Age groups
      sequelize.query(
        `SELECT
           CASE
             WHEN EXTRACT(YEAR FROM AGE(dob)) < 5 THEN 'Under 5'
             WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 5 AND 17 THEN '5-17'
             WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 18 AND 35 THEN '18-35'
             WHEN EXTRACT(YEAR FROM AGE(dob)) BETWEEN 36 AND 60 THEN '36-60'
             ELSE 'Over 60'
           END AS age_group,
           COUNT(*) AS count
         FROM hms_patients
         GROUP BY age_group ORDER BY age_group`,
        { type: QueryTypes.SELECT }
      ),
      // County breakdown (top 10)
      sequelize.query(
        `SELECT county, COUNT(*) AS count
         FROM hms_patients
         WHERE county IS NOT NULL AND county != ''
         GROUP BY county ORDER BY count DESC LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    const [totalPatients] = await sequelize.query(
      'SELECT COUNT(*) AS total FROM hms_patients',
      { type: QueryTypes.SELECT }
    ) as any[];

    res.json({ from, to, totalPatients: totalPatients?.total || 0, newRegistrations, genderBreakdown, ageGroups, countyBreakdown });
  } catch (err) {
    console.error('getPatientReport error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
