import { Request, Response } from 'express';
import { sequelize } from '../config/db';
import { QueryTypes } from 'sequelize';

// ─── Helper ──────────────────────────────────────────────────────────────────

const encounterExists = async (id: string): Promise<boolean> => {
  const rows = await sequelize.query(
    'SELECT id FROM hms_encounters WHERE id = $1 LIMIT 1',
    { bind: [id], type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

const patientExists = async (id: string): Promise<boolean> => {
  const rows = await sequelize.query(
    'SELECT id FROM hms_patients WHERE id = $1 LIMIT 1',
    { bind: [id], type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

// ─── HPI ─────────────────────────────────────────────────────────────────────

export const saveHPI = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await encounterExists(id))) return res.status(404).json({ message: 'Encounter not found' });

    const enc: any = (await sequelize.query(
      'SELECT patient_id FROM hms_encounters WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    ))[0];

    const { onset, character, radiation, associated_symptoms, timing,
            exacerbating_factors, relieving_factors, narrative } = req.body;

    // Upsert
    await sequelize.query(
      `INSERT INTO hms_hpi
         (encounter_id, patient_id, onset, character, radiation, associated_symptoms,
          timing, exacerbating_factors, relieving_factors, narrative, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (encounter_id) DO UPDATE SET
         onset=$3, character=$4, radiation=$5, associated_symptoms=$6,
         timing=$7, exacerbating_factors=$8, relieving_factors=$9,
         narrative=$10, updated_at=NOW()`,
      { bind: [id, enc.patient_id, onset||null, character||null, radiation||null,
               associated_symptoms||null, timing||null, exacerbating_factors||null,
               relieving_factors||null, narrative||null] }
    );

    const [saved] = await sequelize.query(
      'SELECT * FROM hms_hpi WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(saved);
  } catch (err) {
    console.error('saveHPI error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getHPI = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [row] = await sequelize.query(
      'SELECT * FROM hms_hpi WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Structured Visit Forms ───────────────────────────────────────────────────

export const saveStructuredForm = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await encounterExists(id))) return res.status(404).json({ message: 'Encounter not found' });

    const enc: any = (await sequelize.query(
      'SELECT patient_id FROM hms_encounters WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    ))[0];

    const { form_type, form_data } = req.body;
    if (!form_type || !form_data) return res.status(400).json({ message: 'form_type and form_data required' });

    const validTypes = ['ANC','PNC','CWC','FP','HIV_TB'];
    if (!validTypes.includes(form_type)) return res.status(400).json({ message: 'Invalid form_type' });

    await sequelize.query(
      `INSERT INTO hms_structured_visit_forms
         (encounter_id, patient_id, form_type, form_data, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (encounter_id, form_type) DO UPDATE SET
         form_data=$4, updated_at=NOW()`,
      { bind: [id, enc.patient_id, form_type, JSON.stringify(form_data)] }
    );

    const rows = await sequelize.query(
      'SELECT * FROM hms_structured_visit_forms WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    console.error('saveStructuredForm error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getStructuredForms = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await sequelize.query(
      'SELECT * FROM hms_structured_visit_forms WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Review of Systems ────────────────────────────────────────────────────────

export const saveROS = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await encounterExists(id))) return res.status(404).json({ message: 'Encounter not found' });

    const { ros_data } = req.body;
    if (!ros_data) return res.status(400).json({ message: 'ros_data required' });

    await sequelize.query(
      `INSERT INTO hms_review_of_systems (encounter_id, ros_data, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (encounter_id) DO UPDATE SET ros_data=$2, updated_at=NOW()`,
      { bind: [id, JSON.stringify(ros_data)] }
    );

    const [saved] = await sequelize.query(
      'SELECT * FROM hms_review_of_systems WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getROS = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [row] = await sequelize.query(
      'SELECT * FROM hms_review_of_systems WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Medication History ───────────────────────────────────────────────────────

export const saveMedicationHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // patient id
    if (!(await patientExists(id))) return res.status(404).json({ message: 'Patient not found' });

    const { current_medications, past_medical_history, surgical_history,
            family_history, social_history } = req.body;

    await sequelize.query(
      `INSERT INTO hms_medication_history
         (patient_id, current_medications, past_medical_history, surgical_history,
          family_history, social_history, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (patient_id) DO UPDATE SET
         current_medications=$2, past_medical_history=$3, surgical_history=$4,
         family_history=$5, social_history=$6, updated_at=NOW()`,
      { bind: [id,
               JSON.stringify(current_medications || []),
               past_medical_history || null,
               surgical_history || null,
               family_history || null,
               JSON.stringify(social_history || {})] }
    );

    const [saved] = await sequelize.query(
      'SELECT * FROM hms_medication_history WHERE patient_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMedicationHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [row] = await sequelize.query(
      'SELECT * FROM hms_medication_history WHERE patient_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Allergies ────────────────────────────────────────────────────────────────

export const addAllergy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await patientExists(id))) return res.status(404).json({ message: 'Patient not found' });

    const { allergen, allergy_type, reaction_type, severity } = req.body;
    if (!allergen) return res.status(400).json({ message: 'allergen required' });

    const [saved]: any = await sequelize.query(
      `INSERT INTO hms_allergies (patient_id, allergen, allergy_type, reaction_type, severity)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      { bind: [id, allergen, allergy_type||'Drug', reaction_type||null, severity||'Mild'],
        type: QueryTypes.SELECT }
    );
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllergies = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await sequelize.query(
      'SELECT * FROM hms_allergies WHERE patient_id = $1 ORDER BY created_at DESC',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteAllergy = async (req: Request, res: Response) => {
  try {
    const { allergyId } = req.params;
    await sequelize.query('DELETE FROM hms_allergies WHERE id = $1', { bind: [allergyId] });
    res.json({ message: 'Allergy removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Physical Examination ─────────────────────────────────────────────────────

export const saveExamination = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await encounterExists(id))) return res.status(404).json({ message: 'Encounter not found' });

    const { general_appearance, heent, neck, chest_lungs, heart,
            abdomen, extremities, neurological, skin, exam_data } = req.body;

    await sequelize.query(
      `INSERT INTO hms_physical_examination
         (encounter_id, general_appearance, heent, neck, chest_lungs, heart,
          abdomen, extremities, neurological, skin, exam_data, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (encounter_id) DO UPDATE SET
         general_appearance=$2, heent=$3, neck=$4, chest_lungs=$5, heart=$6,
         abdomen=$7, extremities=$8, neurological=$9, skin=$10,
         exam_data=$11, updated_at=NOW()`,
      { bind: [id, general_appearance||null, heent||null, neck||null,
               chest_lungs||null, heart||null, abdomen||null, extremities||null,
               neurological||null, skin||null, JSON.stringify(exam_data||{})] }
    );

    const [saved] = await sequelize.query(
      'SELECT * FROM hms_physical_examination WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(saved);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getExamination = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [row] = await sequelize.query(
      'SELECT * FROM hms_physical_examination WHERE encounter_id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(row || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Diagnoses ────────────────────────────────────────────────────────────────

export const saveDiagnoses = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await encounterExists(id))) return res.status(404).json({ message: 'Encounter not found' });

    const enc: any = (await sequelize.query(
      'SELECT patient_id FROM hms_encounters WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    ))[0];

    const { diagnoses } = req.body; // array of diagnosis objects
    if (!diagnoses || !Array.isArray(diagnoses) || diagnoses.length === 0) {
      return res.status(400).json({ message: 'At least one diagnosis required' });
    }

    // Delete existing diagnoses for this encounter and re-insert
    await sequelize.query('DELETE FROM hms_diagnoses WHERE encounter_id = $1', { bind: [id] });

    for (const d of diagnoses) {
      if (!d.icd10_code) continue;
      await sequelize.query(
        `INSERT INTO hms_diagnoses
           (encounter_id, patient_id, icd10_code, icd10_description, diagnosis_type,
            clinical_notes, management_plan, follow_up_instructions, referral_type, referral_details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        { bind: [id, enc.patient_id, d.icd10_code, d.icd10_description||'',
                 d.diagnosis_type||'Primary', d.clinical_notes||null,
                 d.management_plan||null, d.follow_up_instructions||null,
                 d.referral_type||'None', d.referral_details||null] }
      );
    }

    const saved = await sequelize.query(
      'SELECT * FROM hms_diagnoses WHERE encounter_id = $1 ORDER BY diagnosis_type',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(saved);
  } catch (err) {
    console.error('saveDiagnoses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getDiagnoses = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await sequelize.query(
      'SELECT * FROM hms_diagnoses WHERE encounter_id = $1 ORDER BY diagnosis_type',
      { bind: [id], type: QueryTypes.SELECT }
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Prescriptions ────────────────────────────────────────────────────────────

export const createPrescription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // encounter id
    const { patient_id, prescriber_id, items, notes } = req.body;

    // Validate references (Property 5)
    if (!(await encounterExists(id))) return res.status(422).json({ message: 'Invalid encounter_id' });
    if (!(await patientExists(String(patient_id)))) return res.status(422).json({ message: 'Invalid patient_id' });

    const [rx]: any = await sequelize.query(
      `INSERT INTO hms_prescriptions (encounter_id, patient_id, prescriber_id, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      { bind: [id, patient_id, prescriber_id, notes||null], type: QueryTypes.SELECT }
    );

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await sequelize.query(
          `INSERT INTO hms_prescription_items
             (prescription_id, drug_name, dose, frequency, duration, route, instructions, quantity_prescribed, stock_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          { bind: [rx.id, item.drug_name, item.dose||null, item.frequency||null,
                   item.duration||null, item.route||'Oral', item.instructions||null,
                   item.quantity_prescribed||1, item.stock_id||null] }
        );
      }
    }

    const prescription = await getPrescriptionById(rx.id);
    res.status(201).json(prescription);
  } catch (err) {
    console.error('createPrescription error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPrescriptionById = async (rxId: number) => {
  const [rx]: any = await sequelize.query(
    `SELECT p.*, s.first_name || ' ' || s.last_name AS prescriber_name,
            pat.first_name || ' ' || pat.last_name AS patient_name
     FROM hms_prescriptions p
     LEFT JOIN hms_staff s ON p.prescriber_id = s.id
     LEFT JOIN hms_patients pat ON p.patient_id = pat.id
     WHERE p.id = $1`,
    { bind: [rxId], type: QueryTypes.SELECT }
  );
  const items = await sequelize.query(
    'SELECT * FROM hms_prescription_items WHERE prescription_id = $1',
    { bind: [rxId], type: QueryTypes.SELECT }
  );
  return { ...rx, items };
};

export const getPrescriptions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rxList: any[] = await sequelize.query(
      `SELECT p.*, s.first_name || ' ' || s.last_name AS prescriber_name,
              pat.first_name || ' ' || pat.last_name AS patient_name
       FROM hms_prescriptions p
       LEFT JOIN hms_staff s ON p.prescriber_id = s.id
       LEFT JOIN hms_patients pat ON p.patient_id = pat.id
       WHERE p.encounter_id = $1 ORDER BY p.created_at DESC`,
      { bind: [id], type: QueryTypes.SELECT }
    );

    const result = await Promise.all(
      rxList.map(async (rx: any) => {
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

export const updatePrescriptionStatus = async (req: Request, res: Response) => {
  try {
    const { rxId } = req.params;
    const { status } = req.body;
    const valid = ['Pending','Dispensed','Cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    await sequelize.query(
      'UPDATE hms_prescriptions SET status=$1, updated_at=NOW() WHERE id=$2',
      { bind: [status, rxId] }
    );
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Appointment from Encounter ───────────────────────────────────────────────

export const bookAppointmentFromEncounter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await encounterExists(id))) return res.status(404).json({ message: 'Encounter not found' });

    const { patient_id, provider_id, appointment_date, appointment_time,
            appointment_type_id, notes, reason_for_visit } = req.body;

    // Check for time-slot conflict
    const conflicts: any[] = await sequelize.query(
      `SELECT id FROM hms_appointments
       WHERE provider_id=$1 AND appointment_date=$2 AND appointment_time=$3
         AND status NOT IN ('Cancelled','No-show')`,
      { bind: [provider_id, appointment_date, appointment_time], type: QueryTypes.SELECT }
    );
    if (conflicts.length > 0) return res.status(409).json({ message: 'Time slot already booked for this provider' });

    const [appt]: any = await sequelize.query(
      `INSERT INTO hms_appointments
         (patient_id, provider_id, appointment_type_id, appointment_date, appointment_time,
          status, notes, reason_for_visit, booked_by, booking_source)
       VALUES ($1,$2,$3,$4,$5,'Scheduled',$6,$7,$8,'Encounter') RETURNING *`,
      { bind: [patient_id, provider_id, appointment_type_id||null, appointment_date,
               appointment_time, notes||null, reason_for_visit||null, provider_id],
        type: QueryTypes.SELECT }
    );
    res.status(201).json(appt);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Patient Bills from Encounter ────────────────────────────────────────────

export const createBillFromEncounter = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!(await encounterExists(id))) return res.status(404).json({ message: 'Encounter not found' });

    const enc: any = (await sequelize.query(
      'SELECT patient_id FROM hms_encounters WHERE id = $1',
      { bind: [id], type: QueryTypes.SELECT }
    ))[0];

    const { items } = req.body; // [{ description, amount }]
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one line item required' });
    }

    // Property 1: total = sum of all line item amounts
    const total = items.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);

    const invoiceNumber = `INV-${Date.now()}`;
    const [invoice]: any = await sequelize.query(
      `INSERT INTO hms_invoices (patient_id, invoice_number, amount, status)
       VALUES ($1,$2,$3,'unpaid') RETURNING *`,
      { bind: [enc.patient_id, invoiceNumber, total], type: QueryTypes.SELECT }
    );

    res.status(201).json({ ...invoice, items, total });
  } catch (err) {
    console.error('createBillFromEncounter error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
