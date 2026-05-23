import { Router } from 'express';
import {
  saveHPI, getHPI,
  saveStructuredForm, getStructuredForms,
  saveROS, getROS,
  saveMedicationHistory, getMedicationHistory,
  addAllergy, getAllergies, deleteAllergy,
  saveExamination, getExamination,
  saveDiagnoses, getDiagnoses,
  createPrescription, getPrescriptions, updatePrescriptionStatus,
  bookAppointmentFromEncounter,
  createBillFromEncounter,
} from '../controllers/encounterClinicalController';

const router = Router();

// HPI
router.post('/encounters/:id/hpi', saveHPI);
router.get('/encounters/:id/hpi', getHPI);

// Structured Visit Forms
router.post('/encounters/:id/structured-forms', saveStructuredForm);
router.get('/encounters/:id/structured-forms', getStructuredForms);

// Review of Systems
router.post('/encounters/:id/ros', saveROS);
router.get('/encounters/:id/ros', getROS);

// Medication History (patient-level)
router.post('/patients/:id/medication-history', saveMedicationHistory);
router.get('/patients/:id/medication-history', getMedicationHistory);

// Allergies (patient-level)
router.post('/patients/:id/allergies', addAllergy);
router.get('/patients/:id/allergies', getAllergies);
router.delete('/patients/:id/allergies/:allergyId', deleteAllergy);

// Physical Examination
router.post('/encounters/:id/examination', saveExamination);
router.get('/encounters/:id/examination', getExamination);

// Diagnoses
router.post('/encounters/:id/diagnoses', saveDiagnoses);
router.get('/encounters/:id/diagnoses', getDiagnoses);

// Prescriptions
router.post('/encounters/:id/prescriptions', createPrescription);
router.get('/encounters/:id/prescriptions', getPrescriptions);
router.patch('/prescriptions/:rxId/status', updatePrescriptionStatus);

// Appointment from encounter
router.post('/encounters/:id/appointments', bookAppointmentFromEncounter);

// Bills from encounter
router.post('/encounters/:id/bills', createBillFromEncounter);

export default router;
