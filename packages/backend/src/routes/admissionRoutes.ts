import { Router } from 'express';
import { createAdmission, getAdmissions, getAdmissionDetail, dischargePatient, addWardNote, getWardNotes } from '../controllers/admissionController';

const router = Router();

router.post('/', createAdmission);
router.get('/', getAdmissions);
router.get('/:id', getAdmissionDetail);
router.post('/:id/discharge', dischargePatient);
router.post('/:id/notes', addWardNote);
router.get('/:id/notes', getWardNotes);

export default router;
