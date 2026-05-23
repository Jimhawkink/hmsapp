import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

export const getWards = async (_req: Request, res: Response) => {
  try {
    const wards = await sequelize.query(
      `SELECT w.*,
              COUNT(b.id) AS total_beds,
              COUNT(CASE WHEN b.status = 'Occupied' THEN 1 END) AS occupied_beds,
              COUNT(CASE WHEN b.status = 'Vacant' THEN 1 END) AS vacant_beds
       FROM hms_wards w
       LEFT JOIN hms_beds b ON b.ward_id = w.id
       WHERE w.is_active = TRUE
       GROUP BY w.id ORDER BY w.ward_name`,
      { type: QueryTypes.SELECT }
    );
    res.json(wards);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createWard = async (req: Request, res: Response) => {
  try {
    const { ward_name, ward_type, total_beds } = req.body;
    if (!ward_name || !ward_type) return res.status(400).json({ message: 'ward_name and ward_type required' });

    const [ward]: any = await sequelize.query(
      `INSERT INTO hms_wards (ward_name, ward_type, total_beds) VALUES ($1,$2,$3) RETURNING *`,
      { bind: [ward_name, ward_type, total_beds || 0], type: QueryTypes.SELECT }
    );

    // Auto-create beds if total_beds specified
    if (total_beds && total_beds > 0) {
      for (let i = 1; i <= total_beds; i++) {
        await sequelize.query(
          `INSERT INTO hms_beds (ward_id, bed_number, status) VALUES ($1,$2,'Vacant')`,
          { bind: [ward.id, `${ward_name.substring(0, 3).toUpperCase()}-${String(i).padStart(2, '0')}`] }
        );
      }
    }

    res.status(201).json(ward);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getWardBeds = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const beds = await sequelize.query(
      `SELECT b.*,
              a.id AS admission_id,
              p.first_name || ' ' || p.last_name AS patient_name,
              a.admission_date, a.admitting_diagnosis
       FROM hms_beds b
       LEFT JOIN hms_admissions a ON a.id = b.current_admission_id AND a.status = 'Admitted'
       LEFT JOIN hms_patients p ON a.patient_id = p.id
       WHERE b.ward_id = $1 ORDER BY b.bed_number`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(beds);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addBed = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bed_number } = req.body;
    if (!bed_number) return res.status(400).json({ message: 'bed_number required' });

    const [bed]: any = await sequelize.query(
      `INSERT INTO hms_beds (ward_id, bed_number, status) VALUES ($1,$2,'Vacant') RETURNING *`,
      { bind: [id, bed_number], type: QueryTypes.SELECT }
    );
    res.status(201).json(bed);
  } catch (err: any) {
    if (err?.parent?.code === '23505') return res.status(409).json({ message: 'Bed number already exists in this ward' });
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateBedStatus = async (req: Request, res: Response) => {
  try {
    const { bedId } = req.params;
    const { status } = req.body;
    const valid = ['Vacant', 'Reserved', 'Maintenance'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status. Use Vacant, Reserved, or Maintenance' });

    await sequelize.query(
      `UPDATE hms_beds SET status=$1, updated_at=NOW() WHERE id=$2`,
      { bind: [status, bedId] }
    );
    res.json({ message: 'Bed status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
