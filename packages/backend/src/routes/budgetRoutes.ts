import { Router } from 'express';
import { getBudgets, setBudget } from '../controllers/expenseController';

const router = Router();

router.get('/', getBudgets);
router.post('/', setBudget);

export default router;
