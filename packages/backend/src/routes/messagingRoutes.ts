import { Router } from 'express';
import { sendSingleSMS, sendBulkSMSHandler, getSMSHistory, getTemplates } from '../controllers/messagingController';

const router = Router();

router.post('/send', sendSingleSMS);
router.post('/bulk', sendBulkSMSHandler);
router.get('/history', getSMSHistory);
router.get('/templates', getTemplates);

export default router;
