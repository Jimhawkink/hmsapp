import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

export const createAdmission = async (req: Request, res: Response) => {
  try {
    const { patient_id, encounter_id, ward_id, bed_id, admitting_clinician_id, admitting_diagnosis } = req.body;
    if (!patient_id || !ward_id || !bed_id || !admitting_clinician_id) {
      return res.status(400).json({ message: 'patient_id, ward_id, bed_id, admitting_clinician_id required' });
    }

    // Property 3: Bed Exclusivity — check bed is Vacant
    const [bed]: any = await sequelize.query(
      `SELECT id, status FROM hms_beds WHERE id = $1`,
      { bind: [bed_id], type: QueryTypes.SELECT }
    );
    if (!bed) return res.status(404).json({ message: 'Bed not found' });
    if (bed.status !== 'Vacant') {
      return res.status(409).json({ message: `Bed is currently ${bed.status}. Cannot admit patient to an occupied bed.` });
    }

    const [admission]: any = await sequelize.query(
      `INSERT INTO hms_admissions
         (patient_id, encounter_id, ward_id, bed_id, admitting_clinician_id, admitting_diagnosis)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      { bind: [patient_id, encounter_id || null, ward_id, bed_id, admitting_clinician_id, admitting_diagnosis || null],
        type: QueryTypes.SELECT }
    );

    // Mark bed as Occupied
    await sequelize.query(
      `UPDATE hms_beds SET status='Occupied', current_admission_id=$1, updated_at=NOW() WHERE id=$2`,
      { bind: [admission.id, bed_id] }
    );

    res.status(201).json(admission);
  } catch (err) {
    console.error('createAdmission error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAdmissions = async (_req: Request, res: Response) => {
  try {
    const rows = await sequelize.query(
      `SELECT a.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.phone AS patient_phone, p.gender,
              w.ward_name, w.ward_type,
              b.bed_number,
              s.first_name || ' ' || s.last_name AS clinician_name
       FROM hms_admissions a
       JOIN hms_patients p ON a.patient_id = p.id
       JOIN hms_wards w ON a.ward_id = w.id
       JOIN hms_beds b ON a.bed_id = b.id
       JOIN hms_staff s ON a.admitting_clinician_id = s.id
       WHERE a.status = 'Admitted'
       ORDER BY a.admission_date DESC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAdmissionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [admission]: any = await sequelize.query(
      `SELECT a.*,
              p.first_name || ' ' || p.last_name AS patient_name,
              p.phone, p.gender, p.dob,
              w.ward_name, b.bed_number,
              s.first_name || ' ' || s.last_name AS clinician_name
       FROM hms_admissions a
       JOIN hms_patients p ON a.patient_id = p.id
       JOIN hms_wards w ON a.ward_id = w.id
       JOIN hms_beds b ON a.bed_id = b.id
       JOIN hms_staff s ON a.admitting_clinician_id = s.id
       WHERE a.id = $1`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const notes = await sequelize.query(
      `SELECT n.*, s.first_name || ' ' || s.last_name AS clinician_name
       FROM hms_ward_notes n
       LEFT JOIN hms_staff s ON n.clinician_id = s.id
       WHERE n.admission_id = $1 ORDER BY n.created_at DESC`,
      { bind: [id], type: QueryTypes.SELECT }
    );

    res.json({ ...admission, notes });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const dischargePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { discharge_diagnosis, discharge_summary, discharge_medications } = req.body;

    const [admission]: any = await sequelize.query(
      'SELECT * FROM hms_admissions WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    await sequelize.query(
      `UPDATE hms_admissions SET
         status='Discharged', discharge_date=NOW(),
         discharge_diagnosis=$1, discharge_summary=$2,
         discharge_medications=$3, updated_at=NOW()
       WHERE id=$4`,
      { bind: [discharge_diagnosis || null, discharge_summary || null,
               JSON.stringify(discharge_medications || []), id] }
    );

    // Free the bed
    await sequelize.query(
      `UPDATE hms_beds SET status='Vacant', current_admission_id=NULL, updated_at=NOW() WHERE id=$1`,
      { bind: [admission.bed_id] }
    );

    res.json({ message: 'Patient discharged successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addWardNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { clinician_id, clinician_name, note_type, observations } = req.body;
    if (!observations) return res.status(400).json({ message: 'observations required' });

    const [admission]: any = await sequelize.query(
      'SELECT patient_id FROM hms_admissions WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    if (!admission) return res.status(404).json({ message: 'Admission not found' });

    const [note]: any = await sequelize.query(
      `INSERT INTO hms_ward_notes (admission_id, patient_id, clinician_id, clinician_name, note_type, observations)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      { bind: [id, admission.patient_id, clinician_id || null, clinician_name || null,
               note_type || 'Ward Round', observations],
        type: QueryTypes.SELECT }
    );
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getWardNotes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notes = await sequelize.query(
      `SELECT n.*, s.first_name || ' ' || s.last_name AS staff_name
       FROM hms_ward_notes n
       LEFT JOIN hms_staff s ON n.clinician_id = s.id
       WHERE n.admission_id = $1 ORDER BY n.created_at DESC`,
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
