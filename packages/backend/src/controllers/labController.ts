import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

// ─── Lab Worklist ─────────────────────────────────────────────────────────────
export const getLabWorklist = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT r.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.gender, p.dob,
              s.first_name || ' ' || s.last_name AS requested_by_name,
              e.encounter_number,
              EXTRACT(EPOCH FROM (NOW() - r.date_requested))/3600 AS hours_elapsed
       FROM hms_investigation_requests r
       JOIN hms_encounters e ON r.encounter_id = e.id
       JOIN hms_patients p ON e.patient_id = p.id
       JOIN hms_staff s ON r.requested_by = s.id
       ORDER BY r.date_requested ASC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Mark Sample Collected ────────────────────────────────────────────────────
export const markSampleCollected = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [request]: any = await sequelize.query(
      'SELECT id FROM hms_investigation_requests WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!request) return res.status(404).json({ message: 'Investigation request not found' });

    await sequelize.query(
      `UPDATE hms_investigation_requests
       SET status = 'collected', updated_at = NOW()
       WHERE id = $1`,
      { bind: [id] }
    );
    res.json({ message: 'Sample marked as collected' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Test Parameters ──────────────────────────────────────────────────────
export const getTestParameters = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [request]: any = await sequelize.query(
      `SELECT r.*, t.parameters, t.name AS test_name, t.department
       FROM hms_investigation_requests r
       LEFT JOIN hms_investigation_tests t ON r.test_name = t.name
       WHERE r.id = $1`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!request) return res.status(404).json({ message: 'Request not found' });

    let parameters = [];
    if (request.parameters) {
      try { parameters = JSON.parse(request.parameters); } catch { parameters = []; }
    }
    res.json({ ...request, parameters });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Save Results ─────────────────────────────────────────────────────────────
export const saveResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Property 6: Validate request_id exists
    const [request]: any = await sequelize.query(
      'SELECT id FROM hms_investigation_requests WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!request) return res.status(422).json({ message: 'Invalid request_id — investigation request not found' });

    const { results, entered_by } = req.body;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ message: 'results array required' });
    }

    // Delete existing results for this request
    await sequelize.query('DELETE FROM hms_investigation_results WHERE request_id = $1', { bind: [id] });

    // Insert new results with auto-flagging
    for (const result of results) {
      let flag = null;
      if (result.reference_range && result.value) {
        const rangeMatch = result.reference_range.match(/^([\d.]+)[-–]([\d.]+)$/);
        if (rangeMatch) {
          const low = parseFloat(rangeMatch[1]);
          const high = parseFloat(rangeMatch[2]);
          const val = parseFloat(result.value);
          if (!isNaN(val)) {
            if (val < low * 0.7 || val > high * 1.5) flag = 'Critical';
            else if (val < low) flag = 'L';
            else if (val > high) flag = 'H';
          }
        }
      }

      await sequelize.query(
        `INSERT INTO hms_investigation_results
           (request_id, parameter, value, unit, reference_range, flag, notes, entered_by, date_entered)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        { bind: [id, result.parameter || null, result.value, result.unit || null,
                 result.reference_range || null, flag, result.notes || null,
                 entered_by || 1] }
      );
    }

    // Update status to 'results_posted'
    await sequelize.query(
      `UPDATE hms_investigation_requests SET status = 'results_posted', updated_at = NOW() WHERE id = $1`,
      { bind: [id] }
    );

    res.json({ message: 'Results saved successfully' });
  } catch (err) {
    console.error('saveResults error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Validate Results ─────────────────────────────────────────────────────────
export const validateResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { validator_id } = req.body;

    await sequelize.query(
      `UPDATE hms_investigation_requests
       SET status = 'results_posted', updated_at = NOW()
       WHERE id = $1`,
      { bind: [id] }
    );

    res.json({ message: 'Results validated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Get Report Data ──────────────────────────────────────────────────────────
export const getLabReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [request]: any = await sequelize.query(
      `SELECT r.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.gender, p.dob, p.phone,
              s.first_name || ' ' || s.last_name AS requested_by_name,
              e.encounter_number,
              EXTRACT(EPOCH FROM (r.updated_at - r.date_requested))/3600 AS turnaround_hours
       FROM hms_investigation_requests r
       JOIN hms_encounters e ON r.encounter_id = e.id
       JOIN hms_patients p ON e.patient_id = p.id
       JOIN hms_staff s ON r.requested_by = s.id
       WHERE r.id = $1`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!request) return res.status(404).json({ message: 'Request not found' });

    const results = await sequelize.query(
      'SELECT * FROM hms_investigation_results WHERE request_id = $1 ORDER BY id',
      { bind: [id], type: QueryTypes.SELECT }
    );

    res.json({ ...request, results });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
