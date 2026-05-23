import { Router } from 'express';
import { getClinicalReport, getFinancialReport, getInventoryReport, getPatientReport } from '../controllers/reportController';

const router = Router();

router.get('/clinical', getClinicalReport);
router.get('/financial', getFinancialReport);
router.get('/inventory', getInventoryReport);
router.get('/patients', getPatientReport);

export default router;
