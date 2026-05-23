import { Router } from 'express';
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseSummary } from '../controllers/expenseController';

const router = Router();

router.get('/', getExpenses);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
router.get('/summary', getExpenseSummary);

export default router;
