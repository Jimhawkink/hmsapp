import { Router } from 'express';
import { getSchemes, createScheme, updateScheme, getPatientInsurance, savePatientInsurance } from '../controllers/insuranceController';

const router = Router();

router.get('/schemes', getSchemes);
router.post('/schemes', createScheme);
router.put('/schemes/:id', updateScheme);
router.get('/patients/:id', getPatientInsurance);
router.post('/patients/:id', savePatientInsurance);

export default router;
