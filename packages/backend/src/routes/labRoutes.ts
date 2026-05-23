import { Router } from 'express';
import { getLabWorklist, markSampleCollected, getTestParameters, saveResults, validateResults, getLabReport } from '../controllers/labController';

const router = Router();

router.get('/worklist', getLabWorklist);
router.patch('/requests/:id/collect', markSampleCollected);
router.get('/requests/:id/parameters', getTestParameters);
router.post('/requests/:id/results', saveResults);
router.patch('/requests/:id/validate', validateResults);
router.get('/requests/:id/report', getLabReport);

export default router;
