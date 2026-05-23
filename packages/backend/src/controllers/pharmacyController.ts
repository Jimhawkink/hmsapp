import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

// ─── Prescription Queue ───────────────────────────────────────────────────────
export const getPrescriptionQueue = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT p.*,
              pat.first_name || ' ' || pat.last_name AS patient_name,
              pat.phone AS patient_phone,
              s.first_name || ' ' || s.last_name AS prescriber_name,
              e.encounter_number
       FROM hms_prescriptions p
       JOIN hms_patients pat ON p.patient_id = pat.id
       JOIN hms_staff s ON p.prescriber_id = s.id
       JOIN hms_encounters e ON p.encounter_id = e.id
       WHERE p.status = 'Pending'
       ORDER BY p.created_at ASC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPrescriptionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [rx]: any = await sequelize.query(
      `SELECT p.*,
              pat.first_name || ' ' || pat.last_name AS patient_name,
              s.first_name || ' ' || s.last_name AS prescriber_name,
              e.encounter_number, e.encounter_type
       FROM hms_prescriptions p
       JOIN hms_patients pat ON p.patient_id = pat.id
       JOIN hms_staff s ON p.prescriber_id = s.id
       JOIN hms_encounters e ON p.encounter_id = e.id
       WHERE p.id = $1`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!rx) return res.status(404).json({ message: 'Prescription not found' });

    const items = await sequelize.query(
      'SELECT * FROM hms_prescription_items WHERE prescription_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json({ ...rx, items });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Dispense Prescription ────────────────────────────────────────────────────
export const dispensePrescription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dispensed_items } = req.body; // [{ item_id, stock_id, quantity_dispensed }]

    const [rx]: any = await sequelize.query(
      'SELECT * FROM hms_prescriptions WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!rx) return res.status(404).json({ message: 'Prescription not found' });

    // Process each dispensed item — Property 2: stock never goes negative
    for (const item of (dispensed_items || [])) {
      if (!item.stock_id) continue;

      const [stock]: any = await sequelize.query(
        'SELECT id, quantity FROM hms_stock WHERE id = $1',
        { bind: [item.stock_id], type: QueryTypes.SELECT }
      );

      if (!stock) continue;

      const newQty = Number(stock.quantity) - Number(item.quantity_dispensed || 1);
      if (newQty < 0) {
        return res.status(409).json({
          message: `Insufficient stock for item. Available: ${stock.quantity}, Requested: ${item.quantity_dispensed}`,
        });
      }

      await sequelize.query(
        'UPDATE hms_stock SET quantity = $1, available_units = $1, updated_at = NOW() WHERE id = $2',
        { bind: [newQty, item.stock_id] }
      );
    }

    // Mark prescription as Dispensed
    await sequelize.query(
      `UPDATE hms_prescriptions SET status = 'Dispensed', updated_at = NOW() WHERE id = $1`,
      { bind: [id] }
    );

    res.json({ message: 'Prescription dispensed successfully' });
  } catch (err) {
    console.error('dispensePrescription error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Dispensing History ───────────────────────────────────────────────────────
export const getDispensingHistory = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT p.*,
              pat.first_name || ' ' || pat.last_name AS patient_name,
              s.first_name || ' ' || s.last_name AS prescriber_name
       FROM hms_prescriptions p
       JOIN hms_patients pat ON p.patient_id = pat.id
       JOIN hms_staff s ON p.prescriber_id = s.id
       WHERE p.status = 'Dispensed'
       ORDER BY p.updated_at DESC LIMIT 100`,
      { type: QueryTypes.SELECT }
    );

    const result = await Promise.all(
      (rows as any[]).map(async (rx: any) => {
        const items = await sequelize.query(
          'SELECT * FROM hms_prescription_items WHERE prescription_id = $1',
          { bind: [rx.id], type: QueryTypes.SELECT }
        );
        return { ...rx, items };
      })
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Formulary (Drug List from hms_stock) ────────────────────────────────────
export const getFormulary = async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string || '';
    let sql = `SELECT * FROM hms_stock WHERE 1=1`;
    const bind: any[] = [];
    if (search) { sql += ` AND LOWER(name) LIKE $1`; bind.push(`%${search.toLowerCase()}%`); }
    sql += ` ORDER BY name LIMIT 50`;
    const rows = await sequelize.query(sql, { bind, type: QueryTypes.SELECT });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
