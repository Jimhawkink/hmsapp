import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

// ─── Insurance Schemes ────────────────────────────────────────────────────────
export const getSchemes = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query('SELECT * FROM hms_insurance_schemes WHERE is_active = TRUE ORDER BY scheme_name', { type: QueryTypes.SELECT });
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const createScheme = async (req: Request, res: Response) => {
  try {
    const { scheme_name, scheme_code, benefit_packages } = req.body;
    if (!scheme_name) return res.status(400).json({ message: 'scheme_name required' });
    const [scheme]: any = await sequelize.query(
      `INSERT INTO hms_insurance_schemes (scheme_name, scheme_code, benefit_packages) VALUES ($1,$2,$3) RETURNING *`,
      { bind: [scheme_name, scheme_code || null, JSON.stringify(benefit_packages || [])], type: QueryTypes.SELECT }
    );
    res.status(201).json(scheme);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const updateScheme = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheme_name, benefit_packages } = req.body;
    await sequelize.query(
      `UPDATE hms_insurance_schemes SET scheme_name=$1, benefit_packages=$2, updated_at=NOW() WHERE id=$3`,
      { bind: [scheme_name, JSON.stringify(benefit_packages || []), id] }
    );
    res.json({ message: 'Scheme updated' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ─── Patient Insurance ────────────────────────────────────────────────────────
export const getPatientInsurance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [row] = await sequelize.query(
      `SELECT pi.*, s.scheme_name, s.scheme_code, s.benefit_packages
       FROM hms_patient_insurance pi
       LEFT JOIN hms_insurance_schemes s ON pi.scheme_id = s.id
       WHERE pi.patient_id = $1 AND pi.is_active = TRUE`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(row || null);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

export const savePatientInsurance = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { scheme_id, sha_number, nhif_number, member_number, policy_number } = req.body;
    await sequelize.query(
      `INSERT INTO hms_patient_insurance (patient_id, scheme_id, sha_number, nhif_number, member_number, policy_number)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (patient_id) DO UPDATE SET
         scheme_id=$2, sha_number=$3, nhif_number=$4, member_number=$5, policy_number=$6, updated_at=NOW()`,
      { bind: [id, scheme_id || null, sha_number || null, nhif_number || null, member_number || null, policy_number || null] }
    );
    res.json({ message: 'Insurance saved' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};
