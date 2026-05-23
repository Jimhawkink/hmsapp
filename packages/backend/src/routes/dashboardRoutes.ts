import { Router } from 'express';
import { getDashboardStats, getDashboardAlerts, getDashboardActivity } from '../controllers/dashboardController';

const router = Router();

router.get('/stats', getDashboardStats);
router.get('/alerts', getDashboardAlerts);
router.get('/activity', getDashboardActivity);

export default router;
