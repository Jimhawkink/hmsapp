import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

export const getDashboardStats = async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      todayPatients, todayRevenue, pendingInvestigations,
      bedOccupancy, totalPatients, totalEncounters
    ] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(*) AS count FROM hms_encounters WHERE DATE(created_at) = $1`,
        { bind: [today], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS total FROM hms_pos_sales WHERE DATE(created_at) = $1 AND status = 'Completed'`,
        { bind: [today], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS count FROM hms_investigation_requests WHERE status NOT IN ('results_posted')`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT
           COUNT(*) AS total_beds,
           COUNT(CASE WHEN status = 'Occupied' THEN 1 END) AS occupied_beds
         FROM hms_beds`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query('SELECT COUNT(*) AS count FROM hms_patients', { type: QueryTypes.SELECT }),
      sequelize.query('SELECT COUNT(*) AS count FROM hms_encounters', { type: QueryTypes.SELECT }),
    ]);

    const beds: any = bedOccupancy[0] || { total_beds: 0, occupied_beds: 0 };
    const occupancyPct = beds.total_beds > 0 ? Math.round((beds.occupied_beds / beds.total_beds) * 100) : 0;

    res.json({
      today_patients: (todayPatients[0] as any)?.count || 0,
      today_revenue: (todayRevenue[0] as any)?.total || 0,
      pending_investigations: (pendingInvestigations[0] as any)?.count || 0,
      bed_occupancy_pct: occupancyPct,
      total_beds: beds.total_beds,
      occupied_beds: beds.occupied_beds,
      total_patients: (totalPatients[0] as any)?.count || 0,
      total_encounters: (totalEncounters[0] as any)?.count || 0,
    });
  } catch (err) {
    console.error('getDashboardStats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDashboardAlerts = async (_req: Request, res: Response) => {
  try {
    const [lowStock, expiringDrugs, overdueLabResults, overdueAppointments] = await Promise.all([
      sequelize.query(
        `SELECT name, category, quantity FROM hms_stock WHERE quantity <= 10 AND quantity > 0 ORDER BY quantity ASC LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT name, expiry_date, quantity,
                (expiry_date::date - CURRENT_DATE) AS days_to_expiry
         FROM hms_stock
         WHERE expiry_date IS NOT NULL
           AND expiry_date::date <= CURRENT_DATE + INTERVAL '30 days'
           AND expiry_date::date >= CURRENT_DATE
         ORDER BY expiry_date ASC LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT r.id, r.test_name, p.first_name || ' ' || p.last_name AS patient_name,
                EXTRACT(EPOCH FROM (NOW() - r.date_requested))/3600 AS hours_elapsed
         FROM hms_investigation_requests r
         JOIN hms_encounters e ON r.encounter_id = e.id
         JOIN hms_patients p ON e.patient_id = p.id
         WHERE r.status NOT IN ('results_posted')
           AND r.date_requested < NOW() - INTERVAL '2 hours'
         ORDER BY r.date_requested ASC LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT a.id, a.appointment_date, a.appointment_time, a.status,
                p.first_name || ' ' || p.last_name AS patient_name
         FROM hms_appointments a
         JOIN hms_patients p ON a.patient_id = p.id
         WHERE a.appointment_date < CURRENT_DATE
           AND a.status = 'Scheduled'
         ORDER BY a.appointment_date DESC LIMIT 10`,
        { type: QueryTypes.SELECT }
      ),
    ]);

    res.json({ lowStock, expiringDrugs, overdueLabResults, overdueAppointments });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDashboardActivity = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT * FROM hms_audit_log ORDER BY created_at DESC LIMIT 20`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
