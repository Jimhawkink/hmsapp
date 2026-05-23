import { Router } from 'express';
import { getPrescriptionQueue, getPrescriptionDetail, dispensePrescription, getDispensingHistory, getFormulary } from '../controllers/pharmacyController';

const router = Router();

router.get('/queue', getPrescriptionQueue);
router.get('/prescriptions/:id', getPrescriptionDetail);
router.post('/prescriptions/:id/dispense', dispensePrescription);
router.get('/history', getDispensingHistory);
router.get('/formulary', getFormulary);

export default router;
